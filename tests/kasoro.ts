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
    const communityName = "TestDAO3";
    const timeLimit = new anchor.BN(60 * 60 * 24); // 24시간
    const baseFee = new anchor.BN(5);
    const feeMultiplier = 3;
    const lstAddr = Keypair.generate().publicKey; // 임의의 Pubkey
    const aiModeration = true;

    // 고정된 ratio 및 len 값 설정
    const fixedRatio = [0.4, 0.3, 0.2, 0.1];
    const fixedLen = 4;

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

    // it("1) 커뮤니티를 초기화 (initialize)", async () => {
    //     try {
    //         console.log("=========== Initialize ===========");
    //         console.log("Program ID:", program.programId.toBase58());
    //         console.log("Initializer:", wallet.toBase58());
    //         console.log("communityPda:", communityPda.toBase58());
    //         console.log("vaultPda:", vaultPda.toBase58());
    //         console.log("==================================");
    //         // kasoro::initialize(...)
    //         const txSig = await program.methods
    //             .initialize(
    //                 communityName,
    //                 timeLimit,       // u64(BN)
    //                 baseFee,         // u64(BN)
    //                 feeMultiplier,   // u8
    //                 lstAddr,         // Pubkey
    //                 aiModeration     // bool
    //             )
    //             .accounts({
    //                 initializer: wallet,
    //                 community: communityPda,
    //                 vault: vaultPda,             // vault Account
    //                 systemProgram: anchor.web3.SystemProgram.programId,
    //             })
    //             .rpc();

    //         console.log("TxSig (initialize):", txSig);
    //         // 확인을 위해 fetch
    //         const communityAccount = await program.account.communityState.fetch(communityPda);
    //         console.log("CommunityState data:", communityAccount);

    //         // 간단 검증
    //         // assert.strictEqual(communityAccount.communityName, communityName);
    //         // assert.strictEqual(communityAccount.initBaseFee.toNumber(), baseFee.toNumber());
    //         // assert.strictEqual(communityAccount.feeMultiplier, feeMultiplier);
    //         // assert.strictEqual(communityAccount.aiModeration, aiModeration);
    //         console.log("✅ 커뮤니티 초기화 OK!\n");
    //     } catch (err) {
    //         console.error("initializeCommunity 에러:", err);
    //         throw err;
    //     }
    // });

    it("2) Bounty Deposit (deposit) 호출", async () => {
        try {
            console.log("=========== Bounty Deposit ===========");
            /////////////////////////////////////////////////////////////////////////////
            communityPda = new PublicKey("5GTddhhfBDwk3rLc6DpRce2rxWy23YWeAntvUxaPfm8");
            vaultPda = new PublicKey("HMuRLhJBYiijLtRMN8YqRj6U79egrKHHZZBrYfTP31Fi");
            /////////////////////////////////////////////////////////////////////////////
            const depositLamports = new anchor.BN(0.01234 * LAMPORTS_PER_SOL);
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
            // assert.ok(found, "디포짓 정보가 저장되지 않았습니다!");
            // assert.strictEqual(found.bountyAmount.toNumber(), depositLamports.toNumber());

            console.log("✅ Bounty deposit OK!\n");
        } catch (err) {
            console.error("bountyDeposit 에러:", err);
            throw err;
        }
    });

    // it("3) 콘텐츠 제출 (submit_content) 호출", async () => {
    //     try {
    //         console.log("=========== Submit Content ===========");
    //         /////////////////////////////////////////////////////////////////////////////
    //         communityPda = new PublicKey("5GTddhhfBDwk3rLc6DpRce2rxWy23YWeAntvUxaPfm8");
    //         vaultPda = new PublicKey("HMuRLhJBYiijLtRMN8YqRj6U79egrKHHZZBrYfTP31Fi");
    //         /////////////////////////////////////////////////////////////////////////////
    //         // 테스트용 콘텐츠 데이터
    //         const contentText = "테스트 콘텐츠2";
    //         const imageUri = "https://example.com/test-image2.jpg";
            
    //         // 함수 실행 전 상태 확인
    //         console.log("함수 실행 전 상태:");
    //         const beforeCommunity = await program.account.communityState.fetch(communityPda);
    //         const beforeVaultBalance = await provider.connection.getBalance(vaultPda);
            
    //         console.log("이전 prize_ratio:", beforeCommunity.prizeRatio);
    //         console.log("이전 콘텐츠 개수:", beforeCommunity.contents.length);
    //         console.log("이전 콘텐츠 목록:", beforeCommunity.contents);
    //         console.log("이전 vault 계정 잔액:", beforeVaultBalance);
            
    //         // submit_content 함수 호출
    //         const txSig = await program.methods
    //             .submitContent(
    //                 contentText, 
    //                 imageUri
    //             )
    //             .accounts({
    //                 author: wallet,
    //                 community: communityPda,
    //                 vault: vaultPda,
    //                 systemProgram: anchor.web3.SystemProgram.programId,
    //             })
    //             .rpc();
            
    //         console.log("TxSig (submit_content):", txSig);
            
    //         // 함수 실행 후 상태 확인
    //         console.log("\n함수 실행 후 상태:");
    //         const afterCommunity = await program.account.communityState.fetch(communityPda);
    //         const afterVaultBalance = await provider.connection.getBalance(vaultPda);
            
    //         console.log("이후 prize_ratio:", afterCommunity.prizeRatio);
    //         console.log("이후 콘텐츠 개수:", afterCommunity.contents.length);
    //         console.log("이후 콘텐츠 목록:", afterCommunity.contents);
    //         console.log("이후 vault 계정 잔액:", afterVaultBalance);
            
    //         // 변경된 내용 확인
            
    //         // 1. 콘텐츠가 추가되었는지 확인
    //         assert.strictEqual(afterCommunity.contents.length, beforeCommunity.contents.length + 1, 
    //             "콘텐츠가 추가되지 않았습니다");
            
    //         // 2. 추가된 콘텐츠의 내용 확인
    //         const lastContent = afterCommunity.contents[afterCommunity.contents.length - 1];
    //         assert.strictEqual(lastContent.text, contentText, "콘텐츠 텍스트가 일치하지 않습니다");
    //         assert.strictEqual(lastContent.imageUri, imageUri, "이미지 URI가 일치하지 않습니다");
    //         assert.strictEqual(lastContent.author.toBase58(), wallet.toBase58(), "작성자가 일치하지 않습니다");
            
    //         // 3. 베이스 수수료가 vault로 이체되었는지 확인
    //         const feeAmount = beforeCommunity.initBaseFee.toNumber();
    //         assert.strictEqual(afterVaultBalance - beforeVaultBalance, feeAmount, 
    //             "베이스 수수료가 vault로 올바르게 이체되지 않았습니다");
            
    //         // 4. 챌린저 목록이 업데이트되었는지 확인
    //         // 4-1. 이전보다 챌린저가 더 많거나 같아야 함
    //         assert.ok(
    //             afterCommunity.prizeRatio.challengers.length >= beforeCommunity.prizeRatio.challengers.length,
    //             "챌린저 목록이 업데이트되지 않았습니다"
    //         );
            
    //         // 4-2. prize_ratio 챌린저 큐에 새로운 작성자가 추가되었는지 확인
    //         const newChallengerAdded = afterCommunity.prizeRatio.challengers.some(
    //             challenger => challenger.toBase58() === wallet.toBase58()
    //         );
    //         assert.ok(newChallengerAdded, "새로운 챌린저가 추가되지 않았습니다");
            
    //         // 5. 챌린저 큐가 고정 길이를 유지하는지 확인
    //         assert.ok(
    //             afterCommunity.prizeRatio.challengers.length <= afterCommunity.prizeRatio.len, 
    //             "챌린저 큐가 최대 길이를 초과했습니다"
    //         );
            
    //         console.log("✅ 콘텐츠 제출 OK!\n");
    //     } catch (err) {
    //         console.error("submitContent 에러:", err);
    //         throw err;
    //     }
    // });
});
