import { createHash } from "crypto";

export class HashService {
  static generateHash(data: string): string {
    return createHash("sha256").update(data).digest("hex");
  }

  static generateEventHash(
    eventId: string,
    timestamp: string,
    eventContent: Record<string, any>,
    previousHash: string
  ): string {
    const content = JSON.stringify(eventContent);
    const contentHash = this.generateHash(content);
    const dataToHash = `${eventId}|${timestamp}|${contentHash}|${previousHash}`;
    return this.generateHash(dataToHash);
  }

  static verifyHash(
    eventId: string,
    timestamp: string,
    eventContent: Record<string, any>,
    previousHash: string,
    expectedHash: string
  ): boolean {
    const computedHash = this.generateEventHash(eventId, timestamp, eventContent, previousHash);
    return computedHash === expectedHash;
  }

  static generateIdempotencyKey(requester: string, topicId: string, rangeIdentifier: string): string {
    const data = `${requester}|${topicId}|${rangeIdentifier}|${Date.now()}`;
    return this.generateHash(data);
  }

  static generateContentHash(content: Record<string, any>): string {
    return this.generateHash(JSON.stringify(content));
  }
}
