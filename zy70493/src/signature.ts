import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { BuildArtifact } from './types';
import { insertBuildArtifact } from './database';

export interface SignOptions {
  privateKey?: string;
  signer: string;
  buildNumber: string;
  version: string;
  branch: string;
  commitHash: string;
  buildAgent: string;
  metadata?: Record<string, any>;
}

export function calculateFileChecksum(filePath: string, algorithm: string = 'sha256'): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash(algorithm);
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

export function calculateDirectoryChecksum(dirPath: string, algorithm: string = 'sha256'): string {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`目录不存在: ${dirPath}`);
  }

  const hashSum = crypto.createHash(algorithm);
  const files = getAllFiles(dirPath);
  
  files.sort().forEach(file => {
    const relativePath = path.relative(dirPath, file);
    hashSum.update(relativePath);
    const fileBuffer = fs.readFileSync(file);
    hashSum.update(fileBuffer);
  });

  return hashSum.digest('hex');
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

export function signData(data: string, privateKey?: string): string {
  if (privateKey && fs.existsSync(privateKey)) {
    const key = fs.readFileSync(privateKey, 'utf8');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    return sign.sign(key, 'base64');
  } else {
    const hmac = crypto.createHmac('sha256', 'audit-sign-tool-default-secret-key');
    hmac.update(data);
    return hmac.digest('base64');
  }
}

export async function signArtifact(
  artifactPath: string,
  options: SignOptions
): Promise<BuildArtifact> {
  const isDirectory = fs.existsSync(artifactPath) && fs.statSync(artifactPath).isDirectory();
  
  const checksum = isDirectory 
    ? calculateDirectoryChecksum(artifactPath)
    : calculateFileChecksum(artifactPath);
  
  const artifactName = path.basename(artifactPath);
  const buildDate = new Date().toISOString();
  
  const signatureData = `${checksum}:${artifactName}:${options.version}:${options.buildNumber}:${buildDate}`;
  const signature = signData(signatureData, options.privateKey);
  
  const artifact: Omit<BuildArtifact, 'id'> = {
    artifactName,
    version: options.version,
    buildNumber: options.buildNumber,
    checksum,
    signature,
    signer: options.signer,
    signedAt: new Date().toISOString(),
    buildDate,
    commitHash: options.commitHash,
    branch: options.branch,
    buildAgent: options.buildAgent,
    metadata: options.metadata || {}
  };
  
  await insertBuildArtifact(artifact);
  
  return {
    ...artifact,
    id: await insertBuildArtifact(artifact)
  };
}

export function verifySignature(
  checksum: string,
  signature: string,
  artifactName: string,
  version: string,
  buildNumber: string,
  buildDate: string,
  publicKey?: string
): boolean {
  const signatureData = `${checksum}:${artifactName}:${version}:${buildNumber}:${buildDate}`;
  
  if (publicKey && fs.existsSync(publicKey)) {
    const key = fs.readFileSync(publicKey, 'utf8');
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signatureData);
    return verify.verify(key, signature, 'base64');
  } else {
    const hmac = crypto.createHmac('sha256', 'audit-sign-tool-default-secret-key');
    hmac.update(signatureData);
    const expectedSignature = hmac.digest('base64');
    return signature === expectedSignature;
  }
}

export function generateKeyPair(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  fs.writeFileSync(path.join(outputDir, 'public.pem'), publicKey);
  fs.writeFileSync(path.join(outputDir, 'private.pem'), privateKey);
}
