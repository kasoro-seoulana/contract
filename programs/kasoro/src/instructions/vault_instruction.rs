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

//TODO!: Claim 함   수