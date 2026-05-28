import { VoucherRepository } from '../repositories/VoucherRepository';
import { ParseService } from './ParseService';
import { SubjectService } from './SubjectService';
import type { CashVoucher, VoucherStatus } from '../../shared/types';

export class VoucherService {
  static createVoucher(data: {
    customerName: string;
    amount: number;
    date: string;
    description?: string;
    uploadedBy: string;
    imageFileName?: string;
    imageFilePath?: string;
    imageFileSize?: number;
  }): CashVoucher {
    const voucherNo = VoucherRepository.generateVoucherNo();
    const voucher = VoucherRepository.create({
      voucherNo,
      customerName: data.customerName,
      amount: data.amount,
      date: data.date,
      description: data.description,
    });

    if (data.imageFileName && data.imageFilePath && data.imageFileSize) {
      const clarity = ParseService.detectClarity(data.imageFilePath, data.imageFileName);
      VoucherRepository.addImage({
        voucherId: voucher.id,
        fileName: data.imageFileName,
        filePath: data.imageFilePath,
        fileSize: data.imageFileSize,
        clarity,
        uploadedBy: data.uploadedBy,
      });

      if (clarity < 70) {
        VoucherRepository.update(voucher.id, { status: 'exception' });
        VoucherRepository.addRevision({
          voucherId: voucher.id,
          fieldName: 'status',
          oldValue: 'pending',
          newValue: 'exception',
          reason: `票据清晰度${clarity}%，低于70%阈值，标记为待复核`,
          revisedBy: 'system',
        });
      }
    }

    return VoucherRepository.findById(voucher.id)!;
  }

  static parseVoucher(voucherId: string, operator: string): CashVoucher | null {
    const voucher = VoucherRepository.findById(voucherId);
    if (!voucher) return null;

    VoucherRepository.update(voucherId, { status: 'parsing' });

    const image = voucher.images[0];
    if (image) {
      const parseResult = ParseService.simulateParse(image.filePath, image.fileName);
      parseResult.voucherId = voucherId;
      VoucherRepository.setParseResult(parseResult);

      VoucherRepository.update(voucherId, {
        amount: voucher.amount,
        date: voucher.date,
        description: parseResult.description || voucher.description,
        status: parseResult.confidence >= 70 ? 'reviewing' : 'exception',
      });

      VoucherRepository.addRevision({
        voucherId,
        fieldName: 'parse',
        oldValue: null,
        newValue: JSON.stringify(parseResult),
        reason: `OCR解析完成，置信度${parseResult.confidence}%`,
        revisedBy: operator,
      });

      if (parseResult.description && parseResult.amount) {
        this.autoSuggestMapping(voucherId, parseResult.description, parseResult.amount, operator);
      }
    }

    return VoucherRepository.findById(voucherId);
  }

  static autoSuggestMapping(voucherId: string, description: string, amount: number, operator: string): void {
    const isIncome = description.includes('收入') || description.includes('销售') || description.includes('货款');
    const suggestions = SubjectService.suggestSubjects(description, amount, isIncome);

    VoucherRepository.deleteMappingsByVoucherId(voucherId);

    if (suggestions.length > 0) {
      const suggestion = suggestions[0];
      VoucherRepository.setMapping({
        voucherId,
        subjectId: suggestion.subjectId,
        direction: isIncome ? 'credit' : 'debit',
        amount,
        isSuggested: true,
        suggestionReason: suggestion.reason,
      });

      const cashSubjectId = 'sub_001';
      VoucherRepository.setMapping({
        voucherId,
        subjectId: cashSubjectId,
        direction: isIncome ? 'debit' : 'credit',
        amount,
        isSuggested: true,
        suggestionReason: isIncome ? '现金收入增加库存现金' : '现金支出减少库存现金',
      });

      VoucherRepository.addRevision({
        voucherId,
        fieldName: 'subject_mapping',
        oldValue: null,
        newValue: `建议科目：${suggestion.subjectCode} ${suggestion.subjectName}，置信度${suggestion.confidence}%`,
        reason: '系统自动推荐科目映射',
        revisedBy: 'system',
      });
    }
  }

  static updateSubjectMapping(voucherId: string, mappings: {
    subjectId: string;
    direction: 'debit' | 'credit';
    amount: number;
    adjustmentReason: string;
  }[], operator: string): CashVoucher | null {
    const voucher = VoucherRepository.findById(voucherId);
    if (!voucher) return null;

    VoucherRepository.deleteMappingsByVoucherId(voucherId);

    for (const mapping of mappings) {
      const validation = SubjectService.validateMapping(
        mapping.subjectId,
        mapping.direction,
        mapping.amount,
        voucher.description || ''
      );

      VoucherRepository.setMapping({
        voucherId,
        subjectId: mapping.subjectId,
        direction: mapping.direction,
        amount: mapping.amount,
        isSuggested: false,
        suggestionReason: null,
        adjustedBy: operator,
        adjustmentReason: mapping.adjustmentReason + (validation.warnings.length > 0 ? ` | 系统提示：${validation.warnings.join('; ')}` : ''),
      });
    }

    VoucherRepository.update(voucherId, { status: 'revised' });

    VoucherRepository.addRevision({
      voucherId,
      fieldName: 'subject_mapping',
      oldValue: JSON.stringify(voucher.mappings),
      newValue: JSON.stringify(mappings),
      reason: '人工调整科目映射',
      revisedBy: operator,
    });

    return VoucherRepository.findById(voucherId);
  }

  static completeVoucher(voucherId: string, operator: string): CashVoucher | null {
    const voucher = VoucherRepository.findById(voucherId);
    if (!voucher) return null;

    if (voucher.mappings.length === 0) {
      throw new Error('请先完成科目映射');
    }

    const totalDebit = voucher.mappings.filter(m => m.direction === 'debit').reduce((sum, m) => sum + m.amount, 0);
    const totalCredit = voucher.mappings.filter(m => m.direction === 'credit').reduce((sum, m) => sum + m.amount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`借贷不平衡，借方合计¥${totalDebit.toFixed(2)}，贷方合计¥${totalCredit.toFixed(2)}`);
    }

    VoucherRepository.update(voucherId, { status: 'completed' });

    VoucherRepository.addRevision({
      voucherId,
      fieldName: 'status',
      oldValue: voucher.status,
      newValue: 'completed',
      reason: '凭证审核完成',
      revisedBy: operator,
    });

    return VoucherRepository.findById(voucherId);
  }

  static addNote(voucherId: string, content: string, createdBy: string): CashVoucher | null {
    VoucherRepository.addNote({
      voucherId,
      content,
      createdBy,
    });
    return VoucherRepository.findById(voucherId);
  }

  static getSubjectSuggestions(description: string, amount: number, isIncome: boolean) {
    return SubjectService.suggestSubjects(description, amount, isIncome);
  }
}
