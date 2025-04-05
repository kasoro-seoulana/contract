import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Kasoro } from "../target/types/kasoro";
import assert from "assert";

describe("Kasoro Program Tests - Full Flow with claimBasefee", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Kasoro as Program<Kasoro>;
    const wallet = provider.wallet.publicKey;

    // 테스트용 기본 파라미터
    const communityName = "123456";
    const timeLimit = new anchor.BN(60 * 60 * 24);
    const baseFee = new anchor.BN(0.1*LAMPORTS_PER_SOL); // lamports 단위로 가정
    const feeMultiplier = 3;
    const lstAddr = Keypair.generate().publicKey;
    const aiModeration = true;
    const ratio = [0.9, 0.1]; // 길이=1, 합=1.0

    let communityPda: PublicKey;
    let vaultPda: PublicKey;

    // 1) PDA 계산
    {
        const [cPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("community"),
                wallet.toBuffer(),
                Buffer.from(communityName),
            ],
            program.programId
        );
        communityPda = cPda;

        const [vPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("vault"),
                wallet.toBuffer(),
                Buffer.from(communityName),
            ],
            program.programId
        );
        vaultPda = vPda;
    }

    // it(1) : 커뮤니티 초기화
    // it("1) initialize", async () => {
    //     const txSig = await program.methods
    //         .initialize(
    //             communityName,
    //             timeLimit,
    //             baseFee,
    //             feeMultiplier,
    //             lstAddr,
    //             aiModeration,
    //             ratio // Vec<f32>
    //         )
    //         .accounts({
    //             initializer: wallet,
    //             community: communityPda,
    //             vault: vaultPda,
    //             systemProgram: anchor.web3.SystemProgram.programId,
    //         })
    //         .rpc();

    //     console.log("[initialize] txSig:", txSig);

    //     const communityData = await program.account.communityState.fetch(communityPda);
    //     console.log("Community data after init:", communityData);
    //     // 검증
    //     assert.equal(communityData.communityName, communityName);
    // });

    // // it(2) : deposit
    // it("2) deposit", async () => {
    //     const depositLamports = new anchor.BN(1.1 * LAMPORTS_PER_SOL);
    //     const txSig = await program.methods
    //         .deposit(communityPda, vaultPda, depositLamports)
    //         .accounts({
    //             payer: wallet,
    //             community: communityPda,
    //             vault: vaultPda,
    //             systemProgram: anchor.web3.SystemProgram.programId,
    //         })
    //         .rpc();
    //     // 원하는 만큼 검증(assert) 가능
    // });

    // // it(3) : submitContent
    // it("3) submitContent", async () => {
    //     const text = "Hello anchor";
    //     const imageUri = "https://somewhere.com/myimage.png";

    //     // 1회차
    //     const txSig = await program.methods
    //         .submitContent(text, imageUri)
    //         .accounts({
    //             author: wallet,
    //             community: communityPda,
    //             vault: vaultPda,
    //             systemProgram: anchor.web3.SystemProgram.programId,
    //         })
    //         .rpc();


    //         // 1회차
    //     const txSig_ = await program.methods
    //     .submitContent(text, imageUri)
    //     .accounts({
    //         author: wallet,
    //         community: communityPda,
    //         vault: vaultPda,
    //         systemProgram: anchor.web3.SystemProgram.programId,
    //     })
    //     .rpc();
    // });

    // //it(4) : claimBasefee WARNING: 이거 vaultpda를 fail시키니까 조심해
    // it("4) claimBasefee", async () => {

    //     const vaultBeforeLamports = await provider.connection.getBalance(vaultPda);
    //     console.log("Before claim, vault lamports:", vaultBeforeLamports);

    //     const txSig = await program.methods
    //         .claim()
    //         .accounts({
    //             depositor: wallet,
    //             community: communityPda,
    //             vault: vaultPda,
    //             systemProgram: anchor.web3.SystemProgram.programId,
    //         })
    //         .rpc();
    //     console.log("[claimBasefee] txSig:", txSig);


    //     const vaultAfterLamports = await provider.connection.getBalance(vaultPda);

    //     console.log("After claim, vault lamports:", vaultAfterLamports);
    // });


    it("5) Distribution", async () => {
        communityPda = new PublicKey("G1anyis2ddsB8wpFJQypYHzeybotToyDK6Rix5q4Saug");   
        vaultPda = new PublicKey("FidEh8Pk7SLkqPa96sXPk8BYNeVfDUz1HUbqgG1atbiU");

        const depositorBeforeLamports = await provider.connection.getBalance(communityPda);
        console.log("Before distribute, depositor lamports:", depositorBeforeLamports);

        let list = await program.account.communityState.fetch(communityPda);
        let winners = list.prizeRatio.challengers.map((x)=> ({
                pubkey: x,
                isSigner: false,    // 챌린저는 서명할 필요 없음
                isWritable: true,   // 램포트 수령 => writable = true
            }));

        const txSig = await program.methods
            .bountyDistribute(communityPda, vaultPda)
            .accounts({
                authority: wallet,
                community: communityPda,
                vault: vaultPda,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .remainingAccounts(winners)
            .rpc();
        console.log("[claimBasefee] txSig:", txSig);

        const depositorAfterLamports = await provider.connection.getBalance(communityPda);
        console.log("After distribute, depositor lamports:", depositorAfterLamports);

        console.log("이만큼 분배댐 ", depositorBeforeLamports - depositorAfterLamports);

    });
});