pub mod instructions;
pub mod states;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
pub use instructions::*;

declare_id!("8ekNZbxSK8Zn2B4ATKPyKuYMWP42iv4e7tyaUQcR9uNs");

pub const MASTER_WALLET: &str = "3CGS3fzHZzP6BBuM7oHe4YPxopMTkP4VCr1RixVVy43q";

#[program]
pub mod kasoro {

    use super::*;

    //WARNING
    // 구조체는 그냥 이름 쌩으로 쓰고
    // 함수는 mod::func_name 이렇게 쓰기
    pub fn initialize(
        ctx: Context<InitializeCommunity>,
        community_name: String,
        time_limit: u64,
        base_fee: u64,
        fee_multiplier: u8,
        lst_addr: Pubkey,
        ai_moderation: bool,
    ) -> Result<()> {
        community_instruction::initialize_community(ctx, community_name, time_limit, base_fee , fee_multiplier, lst_addr, ai_moderation);
        Ok(())
    }


    pub fn deposit(
        ctx: Context<BountyDepositContext>,
        target_pda: Pubkey, // target address,
        vault_pda: Pubkey, // target address
        amount: u64
    ) -> Result<()> {
        community_instruction::bounty_deposit(ctx, target_pda, vault_pda, amount);
        Ok(())
    }

    pub fn submit_content(
        ctx: Context<SubmitContent>,
        text: String,
        image_uri: String,
    ) -> Result<()> {
        vault_instruction::submit_content(ctx, text, image_uri)
    }}

