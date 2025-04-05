use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::states::basefee_vault::BasefeeVault;
use crate::states::community_dao::CommunityState;
use crate::states::{Challengers, DepositersInfo};


use std::str::FromStr;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::system_instruction::transfer;

// for from_str in code
pub const ADMIN_PUBKEY: &str = "wPrpTY68NWWQQqJbiHaiYNPMk2QRtgWBb3tmEj5nfxY";

#[derive(Accounts)]
#[instruction(community_name: String)] // 여기에 파라미터 추가
pub struct InitializeCommunity<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    #[account(
        init,
        payer = initializer,
        space = 8 + CommunityState::INIT_SPACE,
        seeds = [
            b"community",
            initializer.key().as_ref(),
            community_name.as_bytes() // 단순히 DAO 이름을 시드로 사용
        ],
        bump
    )]
    pub community: Account<'info, CommunityState>,
    #[account(
        init,
        payer = initializer,
        space = 8 + BasefeeVault::INIT_SPACE,
        seeds = [
            b"vault",
            initializer.key().as_ref(),
            community_name.as_bytes() // 단순히 DAO 이름을 시드로 사용
        ],
        bump
    )]
    pub vault: Account<'info, BasefeeVault>,
    pub system_program: Program<'info, System>,
}


pub fn initialize_community(
    ctx: Context<InitializeCommunity>,
    community_name: String,
    time_limit: u64,
    base_fee: u64,
    fee_multiplier: u8,
    lst_addr: Pubkey,
    ai_moderation: bool,
    vec: Vec<f32>
) -> Result<()> {
    let basefee_vault_addr = ctx.accounts.vault.key();

    let community = &mut ctx.accounts.community;
    community.community_name = community_name;
    community.time_limit = time_limit;
    community.init_base_fee = base_fee;
    community.fee_multiplier = fee_multiplier;
    community.ai_moderation = ai_moderation;
    community.voted = 0_f32;
    community.vote_period = 0;
    community.active = true;
    community.basefee_vault = basefee_vault_addr;
    community.initializer = ctx.accounts.initializer.key();
    community.lst_addr = lst_addr;

    let len: u8 = vec.len().try_into().expect("Vector length exceeds u8::MAX");

    let sum:f32 = vec.iter().sum();
    require_eq!(
        sum,
        1_f32
    );
    community.prize_ratio = Challengers{
        ratio: vec.into(),
        challengers: vec![],
        len
    };
    community.contents = vec![];

    Ok(())
}


//WARNING: Bounty를 증감시키는 Instruction들이 여기 있음

//TODO!: Community 쪽에서 Bounty 받고, Vault 쪽에 있는 Vec<DepositInfo>에 Depositer 추가하는 Instruction 구현

#[derive(Accounts)]
pub struct BountyDepositContext<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub community: Account<'info, CommunityState>,

    #[account(mut)]
    pub vault: Account<'info, BasefeeVault>,

    pub system_program: Program<'info, System>,
}

pub fn bounty_deposit(
    ctx: Context<BountyDepositContext>,
    target_pda: Pubkey,
    vault_pda: Pubkey,
    amount: u64
) -> Result<()> {

    require_eq!(
        ctx.accounts.community.key(),
        target_pda,
        ErrorCode::InvalidProgramId
    );

    require_eq!(
        ctx.accounts.community.basefee_vault,
        vault_pda,
        ErrorCode::InvalidProgramId
    );

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.community.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_ctx, amount)?;

    let vault = &mut ctx.accounts.vault;


    let mut flag = false ; // 미리 있는지 없는지 flag
    vault.deposit_info.iter_mut().for_each(|x| {
        if x.deposit_address == ctx.accounts.payer.key() {
            x.bounty_amount += amount;
            flag = true;
        }
    });

    if !flag {
        vault.deposit_info.push(DepositersInfo{
            deposit_address: ctx.accounts.payer.key(),
            bounty_amount: amount
        });
    }

    Ok(())
}

//TODO!: Bounty 다 털어서 Vec<Challenger> 에게 나눠주는 instruction


pub fn re_derive_pda_bump(
    authority: &Pubkey,
    community_name: &str,
) -> (Pubkey, u8) {
    let seeds: &[&[u8]] = &[
        b"community",
        authority.as_ref(),
        community_name.as_bytes(),
    ];
    Pubkey::find_program_address(seeds, &crate::ID)
}



#[derive(Accounts)]
pub struct BountyDistributeContext<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub community: Account<'info, CommunityState>,

    #[account(mut)]
    pub vault: Account<'info, BasefeeVault>,


    pub system_program: Program<'info, System>,
}

pub fn bounty_distribute(
    ctx: Context<BountyDistributeContext>,
    target_pda: Pubkey,
    vault_pda: Pubkey
) -> Result<()> {

    let ra =ctx.remaining_accounts;
    let amount = ctx.accounts.community.get_lamports()* 9 /10;

    msg!("{}", amount);
    let mut ratios = vec![];


    for i in 0..ra.len(){
        ratios.push(ctx.accounts.community.prize_ratio.ratio[i]);
    }

    let (pda_address, pda_bump) = Pubkey::find_program_address(
        &[
            b"community",
            &ctx.accounts.community.initializer.as_ref(),
            ctx.accounts.community.community_name.as_bytes(),
        ],
        &crate::ID
    );

    require_keys_eq!(pda_address, ctx.accounts.community.key());

    let signer_seeds: &[&[u8]] = &[
        b"community",
        &ctx.accounts.community.initializer.as_ref(),
        ctx.accounts.community.community_name.as_bytes(),
        &[pda_bump],
    ];


    if ratios.len() < 0 {
        **ctx.accounts.community.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.community.to_account_info().try_borrow_mut_lamports()? -= amount;
        Ok(())
    }
    else{
        for i in 0..ra.len(){

            let share = (amount as f32 * ratios[i]) as u64;

            msg!("이거다 {}", ratios[i]);

            **ctx.accounts.community.to_account_info().try_borrow_mut_lamports()? -= share;
            **ra[i].to_account_info().try_borrow_mut_lamports()? += share;

            msg!("통과!1");

        }
        Ok(())
    }

}