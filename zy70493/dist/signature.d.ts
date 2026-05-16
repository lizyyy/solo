import { BuildArtifact } from './types';
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
export declare function calculateFileChecksum(filePath: string, algorithm?: string): string;
export declare function calculateDirectoryChecksum(dirPath: string, algorithm?: string): string;
export declare function signData(data: string, privateKey?: string): string;
export declare function signArtifact(artifactPath: string, options: SignOptions): Promise<BuildArtifact>;
export declare function verifySignature(checksum: string, signature: string, artifactName: string, version: string, buildNumber: string, buildDate: string, publicKey?: string): boolean;
export declare function generateKeyPair(outputDir: string): void;
