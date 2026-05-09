import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Bill, BillStatus } from '../bills/bill.entity';
import { GroupsService } from '../groups/groups.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/audit-log.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    private readonly groupsService: GroupsService,
    private readonly auditService: AuditService,
  ) {}

  async generateExcelReport(
    groupId: string,
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Buffer> {
    const isMember = await this.groupsService.isGroupMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('您不是该分组成员');
    }

    const group = await this.groupsService.findOne(groupId, userId);
    const members = await this.groupsService.getMembers(groupId, userId);
    const bills = await this.billRepository.find({
      where: { groupId },
      relations: ['shares'],
      order: { date: 'DESC' },
    });

    let filteredBills = bills;
    if (startDate || endDate) {
      filteredBills = bills.filter((bill) => {
        const billDate = new Date(bill.date);
        if (startDate && billDate < new Date(startDate)) return false;
        if (endDate && billDate > new Date(endDate)) return false;
        return true;
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bill Splitter';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('汇总');
    this.buildSummarySheet(summarySheet, filteredBills, group.name, members);

    const billsSheet = workbook.addWorksheet('账单明细');
    this.buildBillsSheet(billsSheet, filteredBills, members);

    const statisticsSheet = workbook.addWorksheet('统计分析');
    this.buildStatisticsSheet(statisticsSheet, filteredBills, members);

    const buffer = await workbook.xlsx.writeBuffer();

    await this.auditService.log({
      action: AuditAction.EXPORT,
      entityType: AuditEntityType.GROUP,
      entityId: groupId,
      userId,
      groupId,
      newValue: {
        type: 'excel',
        billCount: filteredBills.length,
        startDate,
        endDate,
      },
    });

    return buffer as Buffer;
  }

  private buildSummarySheet(
    sheet: ExcelJS.Worksheet,
    bills: Bill[],
    groupName: string,
    members: any[],
  ) {
    sheet.columns = [
      { header: '项目', key: 'item', width: 20 },
      { header: '数值', key: 'value', width: 30 },
    ];

    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.addRow({ item: '分组名称', value: groupName });
    sheet.addRow({ item: '导出时间', value: new Date().toLocaleString('zh-CN') });
    sheet.addRow({ item: '', value: '' });
    sheet.addRow({ item: '总账单数', value: bills.length });
    sheet.addRow({
      item: '已结算账单数',
      value: bills.filter((b) => b.status === BillStatus.SETTLED).length,
    });
    sheet.addRow({
      item: '待结算账单数',
      value: bills.filter((b) => b.status === BillStatus.PENDING).length,
    });

    const totalAmount = bills
      .filter((b) => b.status === BillStatus.SETTLED)
      .reduce((sum, b) => sum + Number(b.amount), 0);
    sheet.addRow({ item: '已结算总额', value: `¥${totalAmount.toFixed(2)}` });

    const pendingAmount = bills
      .filter((b) => b.status === BillStatus.PENDING)
      .reduce((sum, b) => sum + Number(b.amount), 0);
    sheet.addRow({ item: '待结算总额', value: `¥${pendingAmount.toFixed(2)}` });

    sheet.addRow({ item: '', value: '' });
    sheet.addRow({ item: '成员列表', value: '' });
    members.forEach((m) => {
      sheet.addRow({ item: '', value: `${m.displayName || m.username} (${m.email})` });
    });

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });
  }

  private buildBillsSheet(
    sheet: ExcelJS.Worksheet,
    bills: Bill[],
    members: any[],
  ) {
    const memberMap = new Map(members.map((m) => [m.id, m]));

    sheet.columns = [
      { header: '日期', key: 'date', width: 12 },
      { header: '标题', key: 'title', width: 25 },
      { header: '描述', key: 'description', width: 30 },
      { header: '金额', key: 'amount', width: 12 },
      { header: '付款人', key: 'paidBy', width: 15 },
      { header: '状态', key: 'status', width: 10 },
      { header: '分摊明细', key: 'shares', width: 50 },
    ];

    sheet.getRow(1).font = { bold: true };

    bills.forEach((bill) => {
      const payer = memberMap.get(bill.paidByUserId);
      const sharesText = bill.shares
        .map((s) => {
          const member = memberMap.get(s.userId);
          return `${member?.displayName || member?.username || s.userId}: ¥${Number(s.amount).toFixed(2)}`;
        })
        .join('; ');

      sheet.addRow({
        date: new Date(bill.date).toLocaleDateString('zh-CN'),
        title: bill.title,
        description: bill.description || '',
        amount: `¥${Number(bill.amount).toFixed(2)}`,
        paidBy: payer?.displayName || payer?.username || bill.paidByUserId,
        status: bill.status === BillStatus.SETTLED ? '已结算' : '待结算',
        shares: sharesText,
      });
    });

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    sheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });
  }

  private buildStatisticsSheet(
    sheet: ExcelJS.Worksheet,
    bills: Bill[],
    members: any[],
  ) {
    const memberStats = new Map<string, {
      paid: number;
      owed: number;
      settled: number;
      pending: number;
    }>();

    members.forEach((m) => {
      memberStats.set(m.id, { paid: 0, owed: 0, settled: 0, pending: 0 });
    });

    bills.forEach((bill) => {
      const amount = Number(bill.amount);

      const payerStats = memberStats.get(bill.paidByUserId);
      if (payerStats) {
        payerStats.paid += amount;
        if (bill.status === BillStatus.SETTLED) {
          payerStats.settled += amount;
        } else {
          payerStats.pending += amount;
        }
      }

      bill.shares.forEach((share) => {
        const shareAmount = Number(share.amount);
        const memberStats2 = memberStats.get(share.userId);
        if (memberStats2 && !share.isSettled) {
          memberStats2.owed += shareAmount;
        }
      });
    });

    sheet.columns = [
      { header: '成员', key: 'member', width: 20 },
      { header: '已付款', key: 'paid', width: 15 },
      { header: '待收款', key: 'owed', width: 15 },
      { header: '已结算金额', key: 'settled', width: 15 },
      { header: '待结算金额', key: 'pending', width: 15 },
      { header: '净余额', key: 'balance', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };

    members.forEach((m) => {
      const stats = memberStats.get(m.id) || { paid: 0, owed: 0, settled: 0, pending: 0 };
      sheet.addRow({
        member: m.displayName || m.username,
        paid: `¥${stats.paid.toFixed(2)}`,
        owed: `¥${stats.owed.toFixed(2)}`,
        settled: `¥${stats.settled.toFixed(2)}`,
        pending: `¥${stats.pending.toFixed(2)}`,
        balance: `¥${(stats.paid - stats.owed).toFixed(2)}`,
      });
    });

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    sheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });
  }
}
