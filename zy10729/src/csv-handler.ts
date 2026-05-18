import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { CouponBatch, CouponRecord, OrderDetail, WithdrawalImpact } from './types';

export function readCouponBatches(filePath: string): CouponBatch[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  return records.map((r: any) => ({
    batchId: String(r.batchId || r.批次ID || ''),
    batchName: String(r.batchName || r.批次名称 || ''),
    anchorId: String(r.anchorId || r.主播ID || ''),
    anchorName: String(r.anchorName || r.主播名称 || ''),
    couponType: String(r.couponType || r.券类型 || ''),
    totalCount: parseInt(r.totalCount || r.总数量 || '0', 10),
    grantedCount: parseInt(r.grantedCount || r.已发放数量 || '0', 10),
    withdrawalTime: String(r.withdrawalTime || r.撤券时间 || ''),
    status: String(r.status || r.状态 || '')
  }));
}

export function readCouponRecords(filePath: string): CouponRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  return records.map((r: any) => ({
    recordId: String(r.recordId || r.记录ID || ''),
    batchId: String(r.batchId || r.批次ID || ''),
    userId: String(r.userId || r.用户ID || ''),
    userName: String(r.userName || r.用户名称 || ''),
    couponCode: String(r.couponCode || r.券码 || ''),
    receiveTime: String(r.receiveTime || r.领取时间 || ''),
    expireTime: String(r.expireTime || r.过期时间 || ''),
    useStatus: (r.useStatus || r.使用状态 || 'UNUSED') as any,
    orderId: r.orderId || r.订单ID || undefined,
    useTime: r.useTime || r.使用时间 || undefined
  }));
}

export function readOrderDetails(filePath: string): OrderDetail[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  return records.map((r: any) => ({
    orderId: String(r.orderId || r.订单ID || ''),
    userId: String(r.userId || r.用户ID || ''),
    batchId: String(r.batchId || r.批次ID || ''),
    couponCode: String(r.couponCode || r.券码 || ''),
    orderAmount: parseFloat(r.orderAmount || r.订单金额 || '0'),
    discountAmount: parseFloat(r.discountAmount || r.优惠金额 || '0'),
    payAmount: parseFloat(r.payAmount || r.实付金额 || '0'),
    orderTime: String(r.orderTime || r.下单时间 || ''),
    refundStatus: (r.refundStatus || r.退款状态 || 'NONE') as any,
    refundAmount: parseFloat(r.refundAmount || r.退款金额 || '0'),
    refundTime: r.refundTime || r.退款时间 || undefined
  }));
}

export function writeImpactResult(filePath: string, impacts: WithdrawalImpact[]): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const records = impacts.map(i => ({
    '批次ID': i.batchId,
    '批次名称': i.batchName,
    '主播ID': i.anchorId,
    '主播名称': i.anchorName,
    '用户ID': i.userId,
    '用户名称': i.userName,
    '券码': i.couponCode,
    '领取时间': i.receiveTime,
    '过期时间': i.expireTime,
    '使用状态': i.useStatus,
    '订单ID': i.orderId || '',
    '下单时间': i.orderTime || '',
    '订单金额': i.orderAmount || '',
    '优惠金额': i.discountAmount || '',
    '退款状态': i.refundStatus || '',
    '退款金额': i.refundAmount || '',
    '影响等级': i.impactLevel,
    '影响描述': i.impactDescription,
    '损失金额': i.lossAmount
  }));

  const csv = stringify(records, {
    header: true,
    quoted_string: true,
    encoding: 'utf8'
  });

  fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8');
}

export function writeStatistics(filePath: string, stats: any): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = [
    '优惠券发放包主播撤券影响统计报告',
    '='.repeat(50),
    '',
    `统计时间: ${new Date().toLocaleString('zh-CN')}`,
    '',
    '一、总体统计',
    '-'.repeat(30),
    `受影响用户数: ${stats.totalAffectedUsers}`,
    `受影响券数: ${stats.totalAffectedCoupons}`,
    `总损失金额: ¥${stats.totalLossAmount.toFixed(2)}`,
    '',
    '二、按影响等级分布',
    '-'.repeat(30),
    `高影响 (HIGH): ${stats.byImpactLevel.HIGH}`,
    `中影响 (MEDIUM): ${stats.byImpactLevel.MEDIUM}`,
    `低影响 (LOW): ${stats.byImpactLevel.LOW}`,
    '',
    '三、按使用状态分布',
    '-'.repeat(30),
    ...Object.entries(stats.byUseStatus).map(([k, v]) => `${k}: ${v}`)
  ].join('\n');

  fs.writeFileSync(filePath, content, 'utf8');
}
