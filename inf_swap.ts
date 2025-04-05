import { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, Keypair, VersionedTransaction } from '@solana/web3.js';
import fetch from 'node-fetch';
import { Buffer } from 'buffer';
import * as fs from 'fs';

/**
 * SOL을 mSOL로 스왑하는 함수
 * @param privateKey 개인키
 * @param amount 스왑할 SOL 양 (lamports 단위, 1 SOL = 10^9 lamports)
 * @returns 트랜잭션 서명
 */
export async function swapSolToMSol(privateKey: Uint8Array, amount: number): Promise<string> {
  try {
    // 키페어 생성
    const keypair = Keypair.fromSecretKey(privateKey);
    
    // Solana 연결 설정 (devnet 또는 mainnet-beta)
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    // 스왑 API 호출하여 트랜잭션 데이터 가져오기
    const response = await fetch('https://sanctum-s-api.fly.dev/v1/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount.toString(),
        dstLstAcc: null,
        input: "So11111111111111111111111111111111111111112", // SOL 민트 주소
        mode: "ExactIn",
        outputLstMint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL 민트 주소
        priorityFee: {
          Auto: {
            max_unit_price_micro_lamports: 3000,
            unit_limit: 1000000
          }
        },
        quotedAmount: Math.floor(amount * 0.99).toString(), // 1% 슬리피지 허용
        signer: keypair.publicKey.toString(),
        srcAcc: null,
        swapSrc: "Stakedex"
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 호출 실패: ${response.status} - ${errorText}`);
    }
    
    const swapData = await response.json();
    
    // 직렬화된 트랜잭션 디코딩 (VersionedTransaction 사용)
    const serializedTransaction = Buffer.from(swapData.tx, 'base64');
    const transaction = VersionedTransaction.deserialize(serializedTransaction);
    
    // 트랜잭션에 서명 추가
    transaction.sign([keypair]);
    
    // 서명된 트랜잭션 전송
    const signature = await connection.sendTransaction(transaction);
    
    // 트랜잭션 확인
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('스왑 트랜잭션 성공:', signature);
    return signature;
    
  } catch (error) {
    console.error('스왑 실패:', error);
    throw error;
  }
}

/**
 * 사용 예시
 */
async function example() {
  try {
    // 키페어 파일 경로 설정 (JSON 형식으로 저장된 비밀키)
    const privateKeyPath = './testkey1.json';
    
    // 키페어 파일 읽기 및 파싱
    const privateKeyJSON = fs.readFileSync(privateKeyPath, 'utf-8');
    const privateKey = new Uint8Array(JSON.parse(privateKeyJSON));
    
    // SOL을 mSOL로 스왑 (0.01 SOL = 10,000,000 lamports)
    const amount = 10000000;
    console.log(`${amount / 1000000000} SOL을 mSOL로 스왑 시작...`);
    
    const signature = await swapSolToMSol(privateKey, amount);
    console.log('트랜잭션 서명:', signature);
    console.log(`Solana Explorer에서 확인: https://explorer.solana.com/tx/${signature}`);
  } catch (error) {
    console.error('스왑 실패:', error);
  }
}

// 스크립트를 직접 실행할 경우 예제 함수 호출
if (require.main === module) {
  example();
}
