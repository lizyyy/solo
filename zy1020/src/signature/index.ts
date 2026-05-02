import crypto from 'crypto';

export interface SignatureResult {
  signature: string;
  digest: string;
  timestamp: number;
}

export class SignatureService {
  private algorithm = 'sha256';
  private encoding: crypto.BinaryToTextEncoding = 'hex';

  generateSignature(
    payload: Record<string, unknown>,
    secret: string,
    timestamp?: number
  ): SignatureResult {
    const payloadString = JSON.stringify(payload);
    const actualTimestamp = timestamp ?? Date.now();
    
    const digest = this.generateDigest(payloadString);
    const signature = this.generateHmac(
      `${actualTimestamp}.${payloadString}`,
      secret
    );

    return {
      signature,
      digest,
      timestamp: actualTimestamp,
    };
  }

  verifySignature(
    payload: Record<string, unknown>,
    signature: string,
    secret: string,
    timestamp: number,
    toleranceMs: number = 300000
  ): boolean {
    const payloadString = JSON.stringify(payload);
    
    const now = Date.now();
    if (Math.abs(now - timestamp) > toleranceMs) {
      return false;
    }

    const expectedSignature = this.generateHmac(
      `${timestamp}.${payloadString}`,
      secret
    );

    return this.secureCompare(signature, expectedSignature);
  }

  generateDigest(payloadString: string): string {
    return crypto
      .createHash(this.algorithm)
      .update(payloadString)
      .digest(this.encoding);
  }

  private generateHmac(data: string, secret: string): string {
    return crypto
      .createHmac(this.algorithm, secret)
      .update(data)
      .digest(this.encoding);
  }

  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(a, this.encoding),
      Buffer.from(b, this.encoding)
    );
  }

  buildSignatureHeader(signature: string, timestamp: number): string {
    return `t=${timestamp},v1=${signature}`;
  }

  parseSignatureHeader(header: string): { timestamp: number; signature: string } | null {
    const match = header.match(/^t=(\d+),v1=([a-f0-9]+)$/);
    if (!match) {
      return null;
    }
    return {
      timestamp: parseInt(match[1], 10),
      signature: match[2],
    };
  }
}

export const signatureService = new SignatureService();
