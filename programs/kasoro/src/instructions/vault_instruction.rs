//WARNING: Basefee 증감시키는 Instruction들이 여기 있음

//TODO!: Submit Content - Vault 쪽에다가 Base fee 받고, CommunityState 쪽에 있는 Vec<Challenger>에 챌린저 밀어넣는 Instruction 구현

// submit_contents 함수
// 1. contents(text, image_uri) 정보는 CommunityState의 contents(CreatorContent 구조체)에 저장
// 2. base fee SOL은 BasefeeVault로 전송하여 저장
// 3. Vec<Challenger>의 값 업데이트
//    3-1. Challengers의 ratio, len의 값은 고정
//    3-2. challengers는 queue 형식으로 꽉 찬 상태에서 새로운 값이 들어오면 가장 오래된 값이 사라지고 새로운 값이 들어옴
//    3-3. 예를 들어 len이 4면 4개의 챌린저가 들어오고 5개의 챌린저가 들어오면 가장 오래된 챌린저가 사라지고 새로운 챌린저가 들어옴

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::states::basefee_vault::BasefeeVault;
use crate::states::community_dao::{CommunityState, CreatorContent};
use crate::ErrorCode;

#[derive(Accounts)]
pub struct SubmitContent<'info> {
    #[account(mut)]
    pub author: Signer<'info>,
    
    #[account(mut)]
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

//TODO!: Claim 함수
// 1. depositor가 클레임 함수 실행하면 CommunityState account에 있는 잔액을 분모로 하고, deposit_info의 해당 주소가 제출한 amount를 분자로 하여 비율을 계산하기
// 2. vault account에 있는 잔액*비율 만큼의 amount를 vault account에서 클레임을 요청한 depositor에게 이체하기

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
    
    // 전체 deposit 금액 계산
    let mut total_deposit = 0;
    for deposit in &vault.deposit_info {
        total_deposit += deposit.bounty_amount;
    }
    
    // 해당 depositor의 deposit 금액 찾기
    let mut depositor_amount = 0;
    let mut depositor_index = None;
    
    for (i, deposit) in vault.deposit_info.iter().enumerate() {
        if deposit.deposit_address == depositor.key() {
            depositor_amount = deposit.bounty_amount;
            depositor_index = Some(i);
            break;
        }
    }
    
    // depositor가 deposit_info에 없으면 에러 반환
    if depositor_index.is_none() {
        return Err(error!(ErrorCode::NoDeposit));
    }
    
    // 비율 계산 (float 대신 u64 사용)
    let claim_amount = if total_deposit > 0 {
        (vault.to_account_info().lamports() * depositor_amount) / total_deposit
    } else {
        0
    };
    
    // 0보다 큰 amount만 처리
    if claim_amount > 0 {
        // depositor에게 amount 전송
        **vault.to_account_info().try_borrow_mut_lamports()? -= claim_amount;
        **depositor.to_account_info().try_borrow_mut_lamports()? += claim_amount;
    }
    
    Ok(())
}
