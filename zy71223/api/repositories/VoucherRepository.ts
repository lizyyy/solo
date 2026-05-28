import { db, saveDatabase, generateId } from '../db/init';
import type { CashVoucher, VoucherStatus, ReceiptImage, ParseResult, SubjectMapping, CustomerNote, Revision } from '../../shared/types';

export class VoucherRepository {
  static findAll(params?: { status?: VoucherStatus; customer?: string; startDate?: string; endDate?: string }): CashVoucher[] {
    let vouchers = [...db.cashVoucher];

    if (params?.status) {
      vouchers = vouchers.filter(v => v.status === params.status);
    }
    if (params?.customer) {
      vouchers = vouchers.filter(v => v.customerName.includes(params.customer!));
    }
    if (params?.startDate) {
      vouchers = vouchers.filter(v => v.date >= params.startDate!);
    }
    if (params?.endDate) {
      vouchers = vouchers.filter(v => v.date <= params.endDate!);
    }

    vouchers.sort((a, b) => {
      const statusOrder: { [key: string]: number } = { exception: 0, reviewing: 1, pending: 2, parsing: 3, revised: 4, completed: 5 };
      const orderA = statusOrder[a.status] ?? 6;
      const orderB = statusOrder[b.status] ?? 6;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return vouchers.map(v => this.populateVoucher(v));
  }

  static findById(id: string): CashVoucher | null {
    const voucher = db.cashVoucher.find(v => v.id === id);
    if (!voucher) return null;
    return this.populateVoucher(voucher);
  }

  private static populateVoucher(voucher: CashVoucher): CashVoucher {
    return {
      ...voucher,
      images: this.findImagesByVoucherId(voucher.id),
      parseResult: this.findParseResultByVoucherId(voucher.id),
      mappings: this.findMappingsByVoucherId(voucher.id),
      notes: this.findNotesByVoucherId(voucher.id),
      revisions: this.findRevisionsByVoucherId(voucher.id),
    };
  }

  static findImagesByVoucherId(voucherId: string): ReceiptImage[] {
    return db.receiptImage
      .filter(i => i.voucherId === voucherId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  static findParseResultByVoucherId(voucherId: string): ParseResult | null {
    return db.parseResult.find(p => p.voucherId === voucherId) || null;
  }

  static findMappingsByVoucherId(voucherId: string): SubjectMapping[] {
    return db.subjectMapping
      .filter(m => m.voucherId === voucherId)
      .map(m => {
        const subject = db.accountSubject.find(s => s.id === m.subjectId);
        return {
          ...m,
          subjectCode: subject?.code,
          subjectName: subject?.name,
        };
      })
      .sort((a, b) => a.direction === 'debit' ? -1 : 1);
  }

  static findNotesByVoucherId(voucherId: string): CustomerNote[] {
    return db.customerNote
      .filter(n => n.voucherId === voucherId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static findRevisionsByVoucherId(voucherId: string): Revision[] {
    return db.revision
      .filter(r => r.voucherId === voucherId)
      .sort((a, b) => new Date(b.revisedAt).getTime() - new Date(a.revisedAt).getTime());
  }

  static create(data: {
    voucherNo: string;
    customerName: string;
    amount: number;
    date: string;
    description?: string;
  }): CashVoucher {
    const id = generateId('vou');
    const now = new Date().toISOString();
    const voucher: CashVoucher = {
      id,
      voucherNo: data.voucherNo,
      customerName: data.customerName,
      status: 'pending',
      amount: data.amount,
      date: data.date,
      description: data.description || null,
      createdAt: now,
      updatedAt: now,
      images: [],
      parseResult: null,
      mappings: [],
      notes: [],
      revisions: [],
    };
    db.cashVoucher.push(voucher);
    saveDatabase();
    return this.findById(id)!;
  }

  static update(id: string, data: {
    customerName?: string;
    amount?: number;
    date?: string;
    description?: string;
    status?: VoucherStatus;
  }): CashVoucher | null {
    const index = db.cashVoucher.findIndex(v => v.id === id);
    if (index === -1) return null;

    const voucher = db.cashVoucher[index];
    if (data.customerName !== undefined) voucher.customerName = data.customerName;
    if (data.amount !== undefined) voucher.amount = data.amount;
    if (data.date !== undefined) voucher.date = data.date;
    if (data.description !== undefined) voucher.description = data.description;
    if (data.status !== undefined) voucher.status = data.status;
    voucher.updatedAt = new Date().toISOString();

    saveDatabase();
    return this.findById(id);
  }

  static addImage(data: Omit<ReceiptImage, 'id' | 'uploadedAt'>): ReceiptImage {
    const id = generateId('img');
    const now = new Date().toISOString();
    const image: ReceiptImage = {
      ...data,
      id,
      uploadedAt: now,
    };
    db.receiptImage.push(image);
    saveDatabase();
    return image;
  }

  static setParseResult(data: Omit<ParseResult, 'id' | 'parsedAt'>): ParseResult {
    const existing = db.parseResult.findIndex(p => p.voucherId === data.voucherId);
    const now = new Date().toISOString();

    if (existing !== -1) {
      db.parseResult[existing] = {
        ...db.parseResult[existing],
        ...data,
        parsedAt: now,
      };
      saveDatabase();
      return db.parseResult[existing];
    } else {
      const id = generateId('parse');
      const result: ParseResult = {
        ...data,
        id,
        parsedAt: now,
      };
      db.parseResult.push(result);
      saveDatabase();
      return result;
    }
  }

  static setMapping(data: Omit<SubjectMapping, 'id' | 'subjectName' | 'subjectCode' | 'adjustedBy' | 'adjustedAt' | 'adjustmentReason'> & {
    adjustedBy?: string;
    adjustmentReason?: string;
  }): SubjectMapping {
    const existing = db.subjectMapping.findIndex(
      m => m.voucherId === data.voucherId && m.subjectId === data.subjectId && m.direction === data.direction
    );
    const now = new Date().toISOString();

    if (existing !== -1) {
      db.subjectMapping[existing] = {
        ...db.subjectMapping[existing],
        amount: data.amount,
        isSuggested: data.isSuggested,
        suggestionReason: data.suggestionReason,
        adjustedBy: data.adjustedBy || null,
        adjustedAt: data.adjustedBy ? now : null,
        adjustmentReason: data.adjustmentReason || null,
      };
      saveDatabase();
      return this.findMappingsByVoucherId(data.voucherId).find(m => m.id === db.subjectMapping[existing].id)!;
    } else {
      const id = generateId('map');
      const mapping: SubjectMapping = {
        id,
        voucherId: data.voucherId,
        subjectId: data.subjectId,
        direction: data.direction,
        amount: data.amount,
        isSuggested: data.isSuggested,
        suggestionReason: data.suggestionReason,
        adjustedBy: data.adjustedBy || null,
        adjustedAt: data.adjustedBy ? now : null,
        adjustmentReason: data.adjustmentReason || null,
      };
      db.subjectMapping.push(mapping);
      saveDatabase();
      return this.findMappingsByVoucherId(data.voucherId).find(m => m.id === id)!;
    }
  }

  static updateMapping(mappingId: string, data: {
    subjectId?: string;
    adjustedBy?: string;
    adjustmentReason?: string;
  }): SubjectMapping | null {
    const index = db.subjectMapping.findIndex(m => m.id === mappingId);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const mapping = db.subjectMapping[index];

    if (data.subjectId) {
      mapping.subjectId = data.subjectId;
      mapping.isSuggested = false;
    }
    if (data.adjustedBy) {
      mapping.adjustedBy = data.adjustedBy;
      mapping.adjustedAt = now;
    }
    if (data.adjustmentReason) {
      mapping.adjustmentReason = data.adjustmentReason;
    }

    saveDatabase();
    const voucherId = mapping.voucherId;
    return this.findMappingsByVoucherId(voucherId).find(m => m.id === mappingId) || null;
  }

  static deleteMappingsByVoucherId(voucherId: string): void {
    db.subjectMapping = db.subjectMapping.filter(m => m.voucherId !== voucherId);
    saveDatabase();
  }

  static addNote(data: Omit<CustomerNote, 'id' | 'createdAt'>): CustomerNote {
    const id = generateId('note');
    const now = new Date().toISOString();
    const note: CustomerNote = {
      ...data,
      id,
      createdAt: now,
    };
    db.customerNote.push(note);
    saveDatabase();
    return note;
  }

  static addRevision(data: Omit<Revision, 'id' | 'revisedAt'>): Revision {
    const id = generateId('rev');
    const now = new Date().toISOString();
    const revision: Revision = {
      ...data,
      id,
      revisedAt: now,
    };
    db.revision.push(revision);
    saveDatabase();
    return revision;
  }

  static getSummary() {
    const total = db.cashVoucher.length;
    return {
      total,
      pending: db.cashVoucher.filter(v => v.status === 'pending').length,
      parsing: db.cashVoucher.filter(v => v.status === 'parsing').length,
      reviewing: db.cashVoucher.filter(v => v.status === 'reviewing').length,
      revised: db.cashVoucher.filter(v => v.status === 'revised').length,
      completed: db.cashVoucher.filter(v => v.status === 'completed').length,
      exception: db.cashVoucher.filter(v => v.status === 'exception').length,
    };
  }

  static generateVoucherNo(): string {
    const today = new Date();
    const prefix = `XJ${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const existing = db.cashVoucher
      .filter(v => v.voucherNo.startsWith(prefix))
      .sort((a, b) => b.voucherNo.localeCompare(a.voucherNo))[0];
    let seq = 1;
    if (existing) {
      seq = parseInt(existing.voucherNo.slice(-4)) + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
