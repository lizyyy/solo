import dayjs from 'dayjs';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';
import {
  AttachmentItem,
  AttachmentStatus,
  ValidationResult,
  FilterParams,
  ExportRow,
} from '../types';
import { localStorage } from '../storage/localStorage';
import { config } from '../config';

const STATUS_TEXT_MAP: Record<AttachmentStatus, string> = {
  [AttachmentStatus.PENDING_UPLOAD]: '待补传',
  [AttachmentStatus.UPLOADED]: '已上传',
  [AttachmentStatus.VALIDATION_FAILED]: '校验失败',
  [AttachmentStatus.ARCHIVED]: '已归档',
};

const VALIDATION_RESULT_TEXT_MAP: Record<ValidationResult, string> = {
  [ValidationResult.PASS]: '通过',
  [ValidationResult.FAIL]: '失败',
  [ValidationResult.VERSION_MISMATCH]: '版本不匹配',
};

function getResponsiblePerson(item: AttachmentItem): string {
  if (item.uploadedBy) return item.uploadedBy;
  return '系统分配';
}

export class AttachmentService {
  async getAttachmentList(filters?: FilterParams) {
    let items = await localStorage.getAttachmentItems();
    const contracts = await localStorage.getContracts();
    const contractMap = new Map(contracts.map((c) => [c.id, c]));

    if (filters) {
      if (filters.startDate) {
        items = items.filter((item) => {
          if (!item.uploadedAt) return false;
          return dayjs(item.uploadedAt).isAfter(dayjs(filters.startDate).startOf('day'));
        });
      }

      if (filters.endDate) {
        items = items.filter((item) => {
          if (!item.uploadedAt) return false;
          return dayjs(item.uploadedAt).isBefore(dayjs(filters.endDate).endOf('day'));
        });
      }

      if (filters.status) {
        items = items.filter((item) => item.status === filters.status);
      }

      if (filters.responsiblePerson) {
        items = items.filter((item) =>
          item.uploadedBy?.includes(filters.responsiblePerson!)
        );
      }

      if (filters.businessObject) {
        items = items.filter((item) => {
          const contract = contractMap.get(item.contractId);
          return contract?.businessObject.includes(filters.businessObject!);
        });
      }
    }

    return items.map((item) => {
      const contract = contractMap.get(item.contractId);
      return {
        ...item,
        contractNo: contract?.contractNo,
        contractName: contract?.contractName,
        businessObject: contract?.businessObject,
        contractVersion: contract?.contractVersion,
        statusText: STATUS_TEXT_MAP[item.status],
        responsiblePerson: getResponsiblePerson(item),
      };
    });
  }

  async getAttachmentDetail(id: string) {
    const item = await localStorage.getAttachmentItemById(id);
    if (!item) return null;

    const contract = await localStorage.getContractById(item.contractId);
    const supplementRecords = await localStorage.getSupplementRecordsByAttachmentItemId(id);
    const historyRecords = await localStorage.getHistoryRecordsByAttachmentItemId(id);

    return {
      ...item,
      contract,
      supplementRecords,
      historyRecords,
      statusText: STATUS_TEXT_MAP[item.status],
      responsiblePerson: getResponsiblePerson(item),
    };
  }

  async uploadAttachment(
    attachmentItemId: string,
    uploadedBy: string,
    fileName: string,
    fileSize: number,
    fileVersion: string
  ) {
    const item = await localStorage.getAttachmentItemById(attachmentItemId);
    if (!item) {
      throw new Error('附件项不存在');
    }

    if (item.status === AttachmentStatus.ARCHIVED) {
      throw new Error('已归档的附件不能重新上传');
    }

    const beforeStatus = item.status;
    const now = dayjs().toISOString();

    const versionMismatch = fileVersion !== item.expectedVersion;

    let validationResult: ValidationResult;
    let validationMessage: string | undefined;

    if (versionMismatch) {
      validationResult = ValidationResult.VERSION_MISMATCH;
      validationMessage = `附件版本${fileVersion}与合同正文版本${item.expectedVersion}不匹配`;
    } else {
      validationResult = ValidationResult.PASS;
    }

    await localStorage.addSupplementRecord({
      attachmentItemId,
      contractId: item.contractId,
      uploadedBy,
      uploadedAt: now,
      fileVersion,
      fileName,
      fileSize,
      validationResult,
      validationMessage,
      versionMismatch,
    });

    const afterStatus = versionMismatch
      ? AttachmentStatus.UPLOADED
      : AttachmentStatus.UPLOADED;

    await localStorage.updateAttachmentItem(attachmentItemId, {
      status: afterStatus,
      currentVersion: fileVersion,
      uploadedBy,
      uploadedAt: now,
      validationResult,
      validationMessage,
      versionMismatch,
    });

    await localStorage.addHistoryRecord({
      attachmentItemId,
      contractId: item.contractId,
      action: '上传附件',
      operator: uploadedBy,
      operateAt: now,
      beforeStatus,
      afterStatus,
      remark: validationMessage,
      versionMismatch,
      details: {
        fileName,
        fileSize,
        fileVersion,
        expectedVersion: item.expectedVersion,
      },
    });

    return this.getAttachmentDetail(attachmentItemId);
  }

  async validateAttachment(attachmentItemId: string, operator: string) {
    const item = await localStorage.getAttachmentItemById(attachmentItemId);
    if (!item) {
      throw new Error('附件项不存在');
    }

    if (item.status !== AttachmentStatus.UPLOADED) {
      throw new Error('只有已上传状态的附件可以校验');
    }

    const beforeStatus = item.status;
    const now = dayjs().toISOString();

    let afterStatus: AttachmentStatus;
    let validationResult: ValidationResult;
    let validationMessage: string | undefined;

    if (item.versionMismatch) {
      afterStatus = AttachmentStatus.VALIDATION_FAILED;
      validationResult = ValidationResult.VERSION_MISMATCH;
      validationMessage = `附件版本${item.currentVersion}与合同正文版本${item.expectedVersion}不匹配，校验失败`;
    } else if (Math.random() > 0.3) {
      afterStatus = AttachmentStatus.ARCHIVED;
      validationResult = ValidationResult.PASS;
      validationMessage = '校验通过，已归档';
    } else {
      afterStatus = AttachmentStatus.VALIDATION_FAILED;
      validationResult = ValidationResult.FAIL;
      validationMessage = '文件内容校验失败，请重新上传';
    }

    await localStorage.updateAttachmentItem(attachmentItemId, {
      status: afterStatus,
      validationResult,
      validationMessage,
    });

    await localStorage.addHistoryRecord({
      attachmentItemId,
      contractId: item.contractId,
      action: '校验附件',
      operator,
      operateAt: now,
      beforeStatus,
      afterStatus,
      remark: validationMessage,
      versionMismatch: item.versionMismatch,
      details: {
        currentVersion: item.currentVersion,
        expectedVersion: item.expectedVersion,
      },
    });

    return this.getAttachmentDetail(attachmentItemId);
  }

  async archiveAttachment(attachmentItemId: string, operator: string) {
    const item = await localStorage.getAttachmentItemById(attachmentItemId);
    if (!item) {
      throw new Error('附件项不存在');
    }

    if (item.status !== AttachmentStatus.UPLOADED) {
      throw new Error('只有已上传状态的附件可以归档');
    }

    const beforeStatus = item.status;
    const now = dayjs().toISOString();

    await localStorage.updateAttachmentItem(attachmentItemId, {
      status: AttachmentStatus.ARCHIVED,
      validationResult: ValidationResult.PASS,
      validationMessage: '手动归档',
    });

    await localStorage.addHistoryRecord({
      attachmentItemId,
      contractId: item.contractId,
      action: '手动归档',
      operator,
      operateAt: now,
      beforeStatus,
      afterStatus: AttachmentStatus.ARCHIVED,
      remark: '手动归档',
    });

    return this.getAttachmentDetail(attachmentItemId);
  }

  async exportAttachments(filters?: FilterParams): Promise<string> {
    const list = await this.getAttachmentList(filters);

    const exportRows: ExportRow[] = list.map((item) => ({
      contractNo: item.contractNo || '',
      contractName: item.contractName || '',
      businessObject: item.businessObject || '',
      contractVersion: item.contractVersion || '',
      attachmentName: item.attachmentName,
      attachmentType: item.attachmentType,
      status: item.status,
      statusText: STATUS_TEXT_MAP[item.status],
      uploadedBy: item.uploadedBy,
      uploadedAt: item.uploadedAt,
      validationResult: item.validationResult,
      validationResultText: item.validationResult
        ? VALIDATION_RESULT_TEXT_MAP[item.validationResult]
        : undefined,
      validationMessage: item.validationMessage,
      versionMismatch: item.versionMismatch,
      versionMismatchText: item.versionMismatch ? '是' : '否',
      currentVersion: item.currentVersion,
      expectedVersion: item.expectedVersion,
      responsiblePerson: getResponsiblePerson(item),
    }));

    const exportDir = path.resolve(config.exportPath);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const fileName = `附件补传导出_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    const filePath = path.join(exportDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      encoding: 'utf8',
      header: [
        { id: 'contractNo', title: '合同编号' },
        { id: 'contractName', title: '合同名称' },
        { id: 'businessObject', title: '业务对象' },
        { id: 'contractVersion', title: '合同版本' },
        { id: 'attachmentName', title: '附件名称' },
        { id: 'attachmentType', title: '附件类型' },
        { id: 'statusText', title: '状态' },
        { id: 'uploadedBy', title: '补传人' },
        { id: 'uploadedAt', title: '上传时间' },
        { id: 'validationResultText', title: '校验结果' },
        { id: 'validationMessage', title: '校验说明' },
        { id: 'versionMismatchText', title: '版本是否不匹配' },
        { id: 'currentVersion', title: '当前版本' },
        { id: 'expectedVersion', title: '期望版本' },
        { id: 'responsiblePerson', title: '负责人' },
      ],
    });

    await csvWriter.writeRecords(exportRows);

    return filePath;
  }

  async getHistory(attachmentItemId: string) {
    return localStorage.getHistoryRecordsByAttachmentItemId(attachmentItemId);
  }

  async getStatusStats() {
    const items = await localStorage.getAttachmentItems();
    const stats = {
      [AttachmentStatus.PENDING_UPLOAD]: 0,
      [AttachmentStatus.UPLOADED]: 0,
      [AttachmentStatus.VALIDATION_FAILED]: 0,
      [AttachmentStatus.ARCHIVED]: 0,
      total: items.length,
    };

    items.forEach((item) => {
      stats[item.status]++;
    });

    return {
      待补传: stats[AttachmentStatus.PENDING_UPLOAD],
      已上传: stats[AttachmentStatus.UPLOADED],
      校验失败: stats[AttachmentStatus.VALIDATION_FAILED],
      已归档: stats[AttachmentStatus.ARCHIVED],
      总计: stats.total,
    };
  }
}

export const attachmentService = new AttachmentService();
