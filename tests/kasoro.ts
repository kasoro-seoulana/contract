import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Kasoro } from "../target/types/kasoro";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import assert from "assert";

describe("Kasoro Program Tests - Full Flow", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Kasoro as Program<Kasoro>;
    const wallet = provider.wallet.publicKey;

    // 테스트용 기본 파라미터
    const communityName = "TestDAO";
    const timeLimit = new anchor.BN(60 * 60 * 24);
    const baseFee = new anchor.BN(5);
    const feeMultiplier = 3;
    const lstAddr = Keypair.generate().publicKey;
    const aiModeration = true;
    const ratio = [0.9,0.1]; // 길이=1, 합=1.0

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
    it("1) initialize", async () => {
        const txSig = await program.methods
            .initialize(
                communityName,
                timeLimit,
                baseFee,
                feeMultiplier,
                lstAddr,
                aiModeration,
                ratio // Vec<f32>
            )
            .accounts({
                initializer: wallet,
                community: communityPda,
                vault: vaultPda,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("[initialize] txSig:", txSig);

        const communityData = await program.account.communityState.fetch(communityPda);
        console.log("Community data after init:", communityData);
        // 검증
        assert.equal(communityData.communityName, communityName);
    });

    // it(2) : deposit
    it("2) deposit", async () => {
        const depositLamports = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
        const txSig = await program.methods
            .deposit(communityPda, vaultPda, depositLamports)
            .accounts({
                payer: wallet,
                community: communityPda,
                vault: vaultPda,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("[deposit] txSig:", txSig);
        // 커뮤니티 PDA 잔액, vaultAccount deposit_info 등 확인
        const communityBalance = await provider.connection.getBalance(communityPda);
        console.log("communityPda balance:------------------", communityBalance);
        const vaultAccount = await program.account.basefeeVault.fetch(vaultPda);
        console.log("vault depositInfo:", vaultAccount.depositInfo);
        // assert...
    });

    // it(3) : submitContent → 여기에 challenger 등록 로직
    it("3) submitContent", async () => {
        const text = "Hello anchor";
        const imageUri = "https://somewhere.com/myimage.png";

        // submitContent(author: wallet, community: communityPda, vault: vaultPda)
        const txSig = await program.methods
            .submitContent(text, imageUri)
            .accounts({
                author: wallet,
                community: communityPda,
                vault: vaultPda,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("[submitContent] txSig:", txSig);

        const txSig_ = await program.methods
            .submitContent(text, imageUri)
            .accounts({
                author: wallet,
                community: communityPda,
                vault: vaultPda,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("[submitContent] txSig:", txSig_);



        const communityDa = await program.account.communityState.fetch(communityPda);
        console.log("Community data after init:", communityDa);


        // community.contents, community.prize_ratio.challengers
        const communityData = await program.account.communityState.fetch(communityPda);
        //console.log("Community data after submitContent:", communityData);

        // 만약 submit_content 내부에서 prize_ratio.challengers.push(author) 했다면,
        // challengers 배열 길이가 1이 되어야 bountyDistribute가 ratio_vec.len=1, challenger_vec.len=1 로 맞아떨어짐
        assert.equal(communityData.contents.length, 2, "contents should have 1 item");
        assert.equal(communityData.prizeRatio.challengers.length, 2, "challengers should have 1 item");


        let beforeData = await provider.connection.getBalance(communityPda);
        console.log("before" , beforeData);

        const txSig1 = await program.methods
            .bountyDistribute(
                communityPda,
                vaultPda
            )
            .accounts({
                authority: wallet,
                community: communityPda,
                vault: vaultPda,
                winner: wallet,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();



        console.log("[claim] txSig:", txSig);
        let afterData = await provider.connection.getBalance(communityPda);

        console.log("after" , afterData);

    });




});