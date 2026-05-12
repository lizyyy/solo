import { Member, Benefit, LedgerEntry, IdempotentRecord } from '../types';

class InMemoryStorage {
  private members: Map<string, Member> = new Map();
  private benefits: Map<string, Benefit> = new Map();
  private ledgers: Map<string, LedgerEntry> = new Map();
  private idempotentRecords: Map<string, IdempotentRecord> = new Map();

  saveMember(member: Member): void {
    this.members.set(member.memberId, member);
  }

  getMember(memberId: string): Member | undefined {
    return this.members.get(memberId);
  }

  getMemberByPhone(phone: string): Member | undefined {
    for (const member of this.members.values()) {
      if (member.phone === phone) {
        return member;
      }
    }
    return undefined;
  }

  saveBenefit(benefit: Benefit): void {
    this.benefits.set(benefit.benefitId, benefit);
  }

  getBenefit(benefitId: string): Benefit | undefined {
    return this.benefits.get(benefitId);
  }

  getBenefitsByMember(memberId: string): Benefit[] {
    const result: Benefit[] = [];
    for (const benefit of this.benefits.values()) {
      if (benefit.memberId === memberId) {
        result.push(benefit);
      }
    }
    return result;
  }

  saveLedger(entry: LedgerEntry): void {
    this.ledgers.set(entry.ledgerId, entry);
  }

  getLedger(ledgerId: string): LedgerEntry | undefined {
    return this.ledgers.get(ledgerId);
  }

  getLedgersByBenefit(benefitId: string): LedgerEntry[] {
    const result: LedgerEntry[] = [];
    for (const ledger of this.ledgers.values()) {
      if (ledger.benefitId === benefitId) {
        result.push(ledger);
      }
    }
    return result.sort((a, b) => a.createdAt - b.createdAt);
  }

  getLedgersByMember(memberId: string): LedgerEntry[] {
    const result: LedgerEntry[] = [];
    for (const ledger of this.ledgers.values()) {
      if (ledger.memberId === memberId) {
        result.push(ledger);
      }
    }
    return result.sort((a, b) => a.createdAt - b.createdAt);
  }

  saveIdempotentRecord(record: IdempotentRecord): void {
    this.idempotentRecords.set(record.requestId, record);
  }

  getIdempotentRecord(requestId: string): IdempotentRecord | undefined {
    return this.idempotentRecords.get(requestId);
  }

  clearAll(): void {
    this.members.clear();
    this.benefits.clear();
    this.ledgers.clear();
    this.idempotentRecords.clear();
  }

  getAllMembers(): Member[] {
    return Array.from(this.members.values());
  }

  getAllBenefits(): Benefit[] {
    return Array.from(this.benefits.values());
  }

  getAllLedgers(): LedgerEntry[] {
    return Array.from(this.ledgers.values());
  }
}

export const storage = new InMemoryStorage();
