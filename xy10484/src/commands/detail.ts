import { Command } from 'commander';
import { loadStore } from '../utils/store';
import { ABNORMAL_TYPE_LABELS } from '../core/analyzer';
import { Abnormal, Review, Order, SignRecord, RefuseRecord, ClaimRecord } from '../types';

function formatOrder(order: Order): void {
  console.log('    ┌─────────────────────────────────────');
  console.log('    │ 订单信息:');
  console.log(`    │   订单号: ${order.orderNo}`);
  console.log(`    │   运单号: ${order.trackingNo}`);
  console.log(`    │   商品: ${order.product}`);
  console.log(`    │   客户: ${order.customer}`);
  console.log(`    │   金额: ¥${order.amount}`);
  console.log(`    │   发货时间: ${order.shippedAt}`);
  console.log(`    │   状态: ${order.status}`);
  console.log('    └─────────────────────────────────────');
}

function formatSignRecord(sign: SignRecord, index: number): void {
  console.log(`    ┌───────────────────────────────────── [签收记录 ${index + 1}]`);
  console.log(`    │ 运单号: ${sign.trackingNo}`);
  console.log(`    │ 签收时间: ${sign.signedAt}`);
  console.log(`    │ 签收人: ${sign.signedBy}`);
  console.log(`    │ 状态: ${sign.status}`);
  console.log(`    │ 有照片: ${sign.hasPhoto ? '是' : '否'}`);
  if (sign.photoUrl) {
    console.log(`    │ 照片链接: ${sign.photoUrl}`);
  }
  console.log(`    │ 批次号: ${sign.batchId}`);
  console.log('    └─────────────────────────────────────');
}

function formatRefuseRecord(refuse: RefuseRecord, index: number): void {
  console.log(`    ┌───────────────────────────────────── [拒收记录 ${index + 1}]`);
  console.log(`    │ 运单号: ${refuse.trackingNo}`);
  console.log(`    │ 拒收时间: ${refuse.refusedAt}`);
  console.log(`    │ 拒收原因: ${refuse.reason}`);
  console.log(`    │ 操作员: ${refuse.operator}`);
  console.log(`    │ 批次号: ${refuse.batchId}`);
  console.log('    └─────────────────────────────────────');
}

function formatClaimRecord(claim: ClaimRecord, index: number): void {
  console.log(`    ┌───────────────────────────────────── [赔付记录 ${index + 1}]`);
  console.log(`    │ 赔付单号: ${claim.claimId}`);
  console.log(`    │ 运单号: ${claim.trackingNo}`);
  console.log(`    │ 赔付金额: ¥${claim.amount}`);
  console.log(`    │ 申请时间: ${claim.appliedAt}`);
  if (claim.approvedAt) {
    console.log(`    │ 批准时间: ${claim.approvedAt}`);
  }
  console.log(`    │ 状态: ${claim.status}`);
  console.log(`    │ 原因: ${claim.reason}`);
  console.log(`    │ 批次号: ${claim.batchId}`);
  console.log('    └─────────────────────────────────────');
}

function formatReview(review: Review): void {
  console.log('    ┌───────────────────────────────────── [复核记录]');
  console.log(`    │ 复核人: ${review.reviewer}`);
  console.log(`    │ 复核时间: ${review.reviewedAt}`);
  console.log(`    │ 复核备注: ${review.note}`);
  console.log('    └─────────────────────────────────────');
}

export function registerDetailCommand(program: Command): void {
  program
    .command('detail <trackingNo>')
    .description('查看运单号详情')
    .action((trackingNo) => {
      const store = loadStore();
      
      const orders = store.orders.filter((o) => o.trackingNo === trackingNo);
      const signRecords = store.signRecords.filter((s) => s.trackingNo === trackingNo);
      const refuseRecords = store.refuseRecords.filter((r) => r.trackingNo === trackingNo);
      const claimRecords = store.claimRecords.filter((c) => c.trackingNo === trackingNo);
      const abnormals = store.abnormals.filter((a) => a.trackingNo === trackingNo);
      const reviews = store.reviews.filter((r) => r.trackingNo === trackingNo);
      const issues = store.issues.filter((i) => i.trackingNo === trackingNo);
      
      console.log('\n========================================');
      console.log(`运单详情: ${trackingNo}`);
      console.log('========================================\n');
      
      if (orders.length > 0) {
        console.log('  ── 订单信息 ──');
        orders.forEach(formatOrder);
        console.log('');
      } else {
        console.log('  ── 订单信息: 未找到 ──\n');
      }
      
      if (signRecords.length > 0) {
        console.log('  ── 签收记录 ──');
        signRecords.forEach((s, i) => formatSignRecord(s, i));
        console.log('');
      } else {
        console.log('  ── 签收记录: 未找到 ──\n');
      }
      
      if (refuseRecords.length > 0) {
        console.log('  ── 拒收记录 ──');
        refuseRecords.forEach((r, i) => formatRefuseRecord(r, i));
        console.log('');
      } else {
        console.log('  ── 拒收记录: 未找到 ──\n');
      }
      
      if (claimRecords.length > 0) {
        console.log('  ── 赔付记录 ──');
        claimRecords.forEach((c, i) => formatClaimRecord(c, i));
        console.log('');
      } else {
        console.log('  ── 赔付记录: 未找到 ──\n');
      }
      
      if (abnormals.length > 0) {
        console.log('  ── 异常记录 ──');
        for (const abnormal of abnormals) {
          console.log(`    [${ABNORMAL_TYPE_LABELS[abnormal.type]}] ${abnormal.reviewed ? '(已复核)' : '(待处理)'}`);
          console.log(`      ID: ${abnormal.id}`);
          console.log(`      描述: ${abnormal.description}`);
          console.log(`      检测时间: ${abnormal.detectedAt}`);
          if (abnormal.reviewed) {
            console.log(`      复核人: ${abnormal.reviewedBy}`);
            console.log(`      复核时间: ${abnormal.reviewedAt}`);
            if (abnormal.reviewNote) {
              console.log(`      复核备注: ${abnormal.reviewNote}`);
            }
          }
          
          if (abnormal.matchedData.order) {
            console.log('\n      匹配的原始数据:');
            console.log('        ── 订单 ──');
            formatOrder(abnormal.matchedData.order);
          }
          if (abnormal.matchedData.signRecords && abnormal.matchedData.signRecords.length > 0) {
            console.log('        ── 签收记录 ──');
            abnormal.matchedData.signRecords.forEach((s, i) => formatSignRecord(s, i));
          }
          if (abnormal.matchedData.refuseRecords && abnormal.matchedData.refuseRecords.length > 0) {
            console.log('        ── 拒收记录 ──');
            abnormal.matchedData.refuseRecords.forEach((r, i) => formatRefuseRecord(r, i));
          }
          if (abnormal.matchedData.claimRecords && abnormal.matchedData.claimRecords.length > 0) {
            console.log('        ── 赔付记录 ──');
            abnormal.matchedData.claimRecords.forEach((c, i) => formatClaimRecord(c, i));
          }
          console.log('');
        }
      } else {
        console.log('  ── 异常记录: 无异常 ──\n');
      }
      
      if (reviews.length > 0) {
        console.log('  ── 复核历史 ──');
        reviews.forEach(formatReview);
        console.log('');
      }
      
      if (issues.length > 0) {
        console.log('  ── 问题记录 ──');
        for (const issue of issues) {
          console.log(`    [${issue.type}] ${issue.description}`);
        }
        console.log('');
      }
    });
}
