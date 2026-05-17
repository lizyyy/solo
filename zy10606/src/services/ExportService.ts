import { Parser } from 'json2csv';
import { Repository } from 'typeorm';
import { AppDataSource } from '../database';
import { ApprovalOrder } from '../entities/ApprovalOrder';
import { ApprovalStatusLabel, OperationTypeLabel, SignStatusLabel } from '../types/enums';
import * as moment from 'moment';

const exportFields = [
  { label: '审批单号', value: 'orderNo' },
  { label: '审批标题', value: 'title' },
  { label: '申请人ID', value: 'applicantId' },
  { label: '申请人姓名', value: 'applicantName' },
  { label: '申请部门', value: 'applicantDept' },
  { label: '审批内容', value: 'content' },
  { label: '审批状态', value: 'statusLabel' },
  { label: '申请时间', value: 'applyTimeFormatted' },
  { label: '超时时间', value: 'timeoutTimeFormatted' },
  { label: '办结时间', value: 'completeTimeFormatted' },
  { label: '当前加签人', value: 'currentSigner' },
  { label: '加签人部门', value: 'currentSignerDept' },
  { label: '加签状态', value: 'signStatusLabel' },
  { label: '是否离职', value: 'isResignedLabel' },
  { label: '催办次数', value: 'remindCount' },
  { label: '是否历史导入', value: 'isImportedLabel' },
  { label: '人工备注', value: 'currentRemark' }
];

export class ExportService {
  private approvalRepo: Repository<ApprovalOrder>;

  constructor() {
    this.approvalRepo = AppDataSource.getRepository(ApprovalOrder);
  }

  async exportToCSV(params: {
    status?: string;
    orderNo?: string;
    applicantName?: string;
    isTimeout?: boolean;
  }): Promise<string> {
    const query = this.approvalRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.signRecords', 'sign')
      .orderBy('order.applyTime', 'DESC');

    if (params.status) {
      query.andWhere('order.status = :status', { status: params.status });
    }

    if (params.orderNo) {
      query.andWhere('order.orderNo LIKE :orderNo', { orderNo: `%${params.orderNo}%` });
    }

    if (params.applicantName) {
      query.andWhere('order.applicantName LIKE :applicantName', { applicantName: `%${params.applicantName}%` });
    }

    if (params.isTimeout !== undefined) {
      const now = new Date();
      if (params.isTimeout) {
        query.andWhere('order.timeoutTime < :now', { now });
      } else {
        query.andWhere('order.timeoutTime >= :now OR order.timeoutTime IS NULL');
      }
    }

    const orders = await query.getMany();
    const formattedData = orders.map(order => this.formatOrderForExport(order));

    const parser = new Parser({ fields: exportFields });
    return parser.parse(formattedData);
  }

  private formatOrderForExport(order: ApprovalOrder) {
    const currentSign = order.signRecords?.find(s => s.status === 'pending') || order.signRecords?.[0];

    return {
      orderNo: order.orderNo,
      title: order.title,
      applicantId: order.applicantId,
      applicantName: order.applicantName,
      applicantDept: order.applicantDept,
      content: order.content || '',
      statusLabel: ApprovalStatusLabel[order.status] || order.status,
      applyTimeFormatted: moment(order.applyTime).format('YYYY-MM-DD HH:mm:ss'),
      timeoutTimeFormatted: order.timeoutTime ? moment(order.timeoutTime).format('YYYY-MM-DD HH:mm:ss') : '',
      completeTimeFormatted: order.completeTime ? moment(order.completeTime).format('YYYY-MM-DD HH:mm:ss') : '',
      currentSigner: currentSign?.signerName || '',
      currentSignerDept: currentSign?.signerDept || '',
      signStatusLabel: currentSign ? (SignStatusLabel[currentSign.status] || currentSign.status) : '',
      isResignedLabel: currentSign?.isResigned ? '是' : '否',
      remindCount: order.remindCount,
      isImportedLabel: order.isImported ? '是' : '否',
      currentRemark: currentSign?.remark || ''
    };
  }

  async exportSingleOrder(orderId: string): Promise<string> {
    const order = await this.approvalRepo.findOne({
      where: { id: orderId },
      relations: ['signRecords', 'remindRecords', 'operationHistories']
    });

    if (!order) {
      throw new Error('审批单不存在');
    }

    const basicInfo = this.formatOrderForExport(order);

    const signRecords = order.signRecords.map(sign => ({
      signerName: sign.signerName,
      signerDept: sign.signerDept,
      isResigned: sign.isResigned ? '是' : '否',
      signOrder: sign.signOrder,
      statusLabel: SignStatusLabel[sign.status] || sign.status,
      signStartTime: moment(sign.signStartTime).format('YYYY-MM-DD HH:mm:ss'),
      signCompleteTime: sign.signCompleteTime ? moment(sign.signCompleteTime).format('YYYY-MM-DD HH:mm:ss') : '',
      timeoutTime: sign.timeoutTime ? moment(sign.timeoutTime).format('YYYY-MM-DD HH:mm:ss') : '',
      opinion: sign.opinion || '',
      remark: sign.remark || '',
      transferToName: sign.transferToName || ''
    }));

    const histories = order.operationHistories.map(h => ({
      operationTypeLabel: OperationTypeLabel[h.operationType] || h.operationType,
      operatorName: h.operatorName,
      detail: h.detail || '',
      operateTime: moment(h.operateTime).format('YYYY-MM-DD HH:mm:ss')
    }));

    const result = {
      basicInfo,
      signRecords,
      histories
    };

    return JSON.stringify(result, null, 2);
  }
}
