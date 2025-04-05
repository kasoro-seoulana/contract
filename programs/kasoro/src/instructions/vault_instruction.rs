use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::states::basefee_vault::BasefeeVault;
use crate::states::community_dao::{CommunityState, CreatorContent};

#[derive(Accounts)]
pub struct SubmitContent<'info> {
    #[account(mut)]
    pub author: Signer<'info>,

    #[account(mut )]
    pub community: Account<'info, CommunityState>,

    #[account(
        mut,
        address = community.basefee_vault
    )]
    pub vault: Account<'info, BasefeeVault>,

    pub system_program: Program<'info, System>,
}

pub fn submit_content(
    ctx: Context<SubmitContent>,
    text: String,
    image_uri: String
) -> Result<()> {
    let author = &ctx.accounts.author;
    let community = &mut ctx.accounts.community;
    let vault = &mut ctx.accounts.vault;


    // 1. contents 정보 저장
    let new_content = CreatorContent {
        author: author.key(),
        text,
        image_uri,
    };

    community.contents.push(new_content);

    // 2. Base fee SOL 전송
    let base_fee = community.init_base_fee;
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: author.to_account_info(),
                to: vault.to_account_info(),
            },
        ),
        base_fee,
    )?;

    // 3. Vec<Challenger> 업데이트
    // 3-1 & 3-2 & 3-3: challengers를 FIFO 큐로 처리
    let prize_ratio = &mut community.prize_ratio;

    // 만약 challengers 배열이 꽉 찼다면 가장 오래된 챌린저 제거
    if prize_ratio.challengers.len() >= prize_ratio.len as usize {
        // 가장 오래된 챌린저(첫 번째 요소) 제거
        prize_ratio.challengers.remove(0);
    }

    // 새로운 챌린저 추가
    prize_ratio.challengers.push(author.key());

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimBasefee<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(mut)]
    pub community: Account<'info, CommunityState>,

    #[account(
        mut,
        address = community.basefee_vault
    )]
    pub vault: Account<'info, BasefeeVault>,

    pub system_program: Program<'info, System>,
}

pub fn claim_basefee(ctx: Context<ClaimBasefee>) -> Result<()> {
    let depositor = &ctx.accounts.depositor;
    let vault = &mut ctx.accounts.vault;


    let mut total_deposit = 0;
    for deposit in &vault.deposit_info {
        total_deposit += deposit.bounty_amount;
    }

    let mut depositor_amount = 0;
    let mut depositor_index = None;

    for (i, deposit) in vault.deposit_info.iter().enumerate() {
        if deposit.deposit_address == depositor.key() {
            depositor_amount = deposit.bounty_amount;
            depositor_index = Some(i);
            break;
        }
    }

    if depositor_index.is_none() {
        return Err(error!(ErrorCode::InvalidProgramId));
    }

    let claim_amount = if total_deposit > 0 {
        (vault.to_account_info().lamports() * depositor_amount) / total_deposit
    } else {
        0
    };

    if claim_amount > 0 {
        // depositor에게 amount 전송
        **vault.to_account_info().try_borrow_mut_lamports()? -= claim_amount;
        **depositor.to_account_info().try_borrow_mut_lamports()? += claim_amount;
    }

    Ok(())
}