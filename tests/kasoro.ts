import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Kasoro } from "../target/types/kasoro";  // 빌드된 IDL의 타입(이름은 실제와 맞추기)
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import assert from "assert";

describe("Kasoro Program Tests", () => {
    // 1) Provider, Program 설정
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Kasoro as Program<Kasoro>;
    const wallet = provider.wallet.publicKey;

    // 2) 테스트용 파라미터
    const communityName = "TestDAO";
    const timeLimit = new anchor.BN(60 * 60 * 24); // 24시간
    const baseFee = new anchor.BN(5);
    const feeMultiplier = 3;
    const lstAddr = Keypair.generate().publicKey; // 임의의 Pubkey
    const aiModeration = true;

    // 커뮤니티 PDA
    let communityPda: PublicKey;
    // Vault PDA
    let vaultPda: PublicKey;

    {
        // Rust 쪽 InitializeCommunity에서:
        // seeds = ["community", initializer, communityName]
        // seeds = ["vault", initializer, communityName]
        const [commPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("community"),
                wallet.toBuffer(),
                Buffer.from(communityName),
            ],
            program.programId
        );
        communityPda = commPda;

        const [vltPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("vault"),
                wallet.toBuffer(),
                Buffer.from(communityName),
            ],
            program.programId
        );
        vaultPda = vltPda;
    }

    it("1) 커뮤니티를 초기화 (initialize)", async () => {
        try {
            console.log("=========== Initialize ===========");
            console.log("Program ID:", program.programId.toBase58());
            console.log("Initializer:", wallet.toBase58());
            console.log("communityPda:", communityPda.toBase58());
            console.log("vaultPda:", vaultPda.toBase58());

            // kasoro::initialize(...)
            const txSig = await program.methods
                .initialize(
                    communityName,
                    timeLimit,       // u64(BN)
                    baseFee,         // u64(BN)
                    feeMultiplier,   // u8
                    lstAddr,         // Pubkey
                    aiModeration     // bool
                )
                .accounts({
                    initializer: wallet,
                    community: communityPda,
                    vault: vaultPda,             // vault Account
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            console.log("TxSig (initialize):", txSig);
            // 확인을 위해 fetch
            const communityAccount = await program.account.communityState.fetch(communityPda);
            console.log("CommunityState data:", communityAccount);

            // 간단 검증
            assert.strictEqual(communityAccount.communityName, communityName);
            assert.strictEqual(communityAccount.initBaseFee.toNumber(), baseFee.toNumber());
            assert.strictEqual(communityAccount.feeMultiplier, feeMultiplier);
            assert.strictEqual(communityAccount.aiModeration, aiModeration);
            console.log("✅ 커뮤니티 초기화 OK!\n");
        } catch (err) {
            console.error("initializeCommunity 에러:", err);
            throw err;
        }
    });

    it("2) Bounty Deposit (deposit) 호출", async () => {
        try {
            console.log("=========== Bounty Deposit ===========");
            const depositLamports = new anchor.BN(0.0001 * LAMPORTS_PER_SOL);
            console.log("depositLamports:", depositLamports.toString());

            // kasoro::deposit(...)
            // deposit(ctx, target_pda, vault_pda, amount)
            // => BountyDepositContext { payer, community, vault, system_program }
            const txSig = await program.methods
                .deposit(
                    communityPda,  // target_pda
                    vaultPda,      // vault_pda
                    depositLamports
                )
                .accounts({
                    payer: wallet,
                    community: communityPda,
                    vault: vaultPda,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            console.log("TxSig (deposit):", txSig);

            // 커뮤니티 PDA의 잔액이 늘어났는지 확인 가능
            const communityBalance = await provider.connection.getBalance(communityPda);
            console.log("Community PDA balance after deposit:", communityBalance);

            // vault 계정의 deposit_info에 기록이 생겼는지 확인
            const vaultAccount = await program.account.basefeeVault.fetch(vaultPda);
            console.log("BasefeeVault data:", vaultAccount);

            // push 된 deposit_info array 체크
            // vault.deposit_info.push({ deposit_address, bounty_amount })
            // depositAddress == wallet
            // bountyAmount == depositLamports
            const found = vaultAccount.depositInfo.find((d: any) =>
                d.depositAddress.toBase58() === wallet.toBase58()
            );
            assert.ok(found, "디포짓 정보가 저장되지 않았습니다!");
            assert.strictEqual(found.bountyAmount.toNumber(), depositLamports.toNumber());

            console.log("✅ Bounty deposit OK!\n");
        } catch (err) {
            console.error("bountyDeposit 에러:", err);
            throw err;
        }
    });
});
