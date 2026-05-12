import { Member, Benefit, LedgerEntry, IdempotentRecord } from '../types';
declare class InMemoryStorage {
    private members;
    private benefits;
    private ledgers;
    private idempotentRecords;
    saveMember(member: Member): void;
    getMember(memberId: string): Member | undefined;
    getMemberByPhone(phone: string): Member | undefined;
    saveBenefit(benefit: Benefit): void;
    getBenefit(benefitId: string): Benefit | undefined;
    getBenefitsByMember(memberId: string): Benefit[];
    saveLedger(entry: LedgerEntry): void;
    getLedger(ledgerId: string): LedgerEntry | undefined;
    getLedgersByBenefit(benefitId: string): LedgerEntry[];
    getLedgersByMember(memberId: string): LedgerEntry[];
    saveIdempotentRecord(record: IdempotentRecord): void;
    getIdempotentRecord(requestId: string): IdempotentRecord | undefined;
    clearAll(): void;
    getAllMembers(): Member[];
    getAllBenefits(): Benefit[];
    getAllLedgers(): LedgerEntry[];
}
export declare const storage: InMemoryStorage;
export {};
