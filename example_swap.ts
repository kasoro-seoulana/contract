import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import { swapSolToMSol } from './inf_swap';

/**
 * SOL을 mSOL로 스왑하는 예제 스크립트
 * 
 * 사용법:
 * 1. privateKeyPath 변수에 비밀키 파일 경로를 설정하세요.
 * 2. solAmount 변수에 스왑할 SOL 양을 lamports 단위로 설정하세요.
 * 3. `ts-node example_swap.ts` 명령으로 실행하세요.
 */
async function main() {
  try {
    // 키페어 파일 경로 설정 (JSON 형식으로 저장된 비밀키)
    const privateKeyPath = './testkey1.json';
    
    // 스왑할 SOL 양 설정 (lamports 단위, 0.001 SOL = 1,000,000 lamports)
    const solAmount = 1000000;
    
    console.log(`${solAmount / 1000000000} SOL을 mSOL로 스왑 시작...`);
    
    // 키페어 파일 읽기 및 파싱
    const privateKeyJSON = fs.readFileSync(privateKeyPath, 'utf-8');
    const privateKey = new Uint8Array(JSON.parse(privateKeyJSON));
    
    // 키페어 생성 및 공개키 출력
    const keypair = Keypair.fromSecretKey(privateKey);
    console.log(`계정 주소: ${keypair.publicKey.toString()}`);
    
    // SOL을 mSOL로 스왑
    const signature = await swapSolToMSol(privateKey, solAmount);
    
    console.log('\n=== 스왑 성공! ===');
    console.log(`트랜잭션 서명: ${signature}`);
    console.log(`Solana Explorer에서 확인: https://explorer.solana.com/tx/${signature}`);
    
  } catch (error) {
    console.error('스왑 실패:', error);
  }
}

// 스크립트 실행
main(); 