use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BasefeeVault {
    #[max_len(10)]
    pub deposit_info: Vec<DepositersInfo>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct DepositersInfo {
    pub deposit_address: Pubkey,
    pub bounty_amount: u64,
}

