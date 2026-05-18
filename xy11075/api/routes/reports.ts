import express from 'express';
import * as XLSX from 'xlsx';
import { DeductionStatus, calculateTotalScore } from '../../shared/types';
import { records } from '../data/store';

const router = express.Router();

router.get('/summary', (req, res) => {
  const totalRecords = records.length;
  const totalScore = records.reduce((sum, r) => sum + r.totalScore, 0);
  const avgScore = totalRecords > 0 ? Math.round(totalScore / totalRecords * 10) / 10 : 0;
  
  const statusCounts: Record<string, number> = {};
  Object.values(DeductionStatus).forEach(status => {
    statusCounts[status] = 0;
  });
  records.forEach(r => {
    statusCounts[r.status]++;
  });
  
  const storeStats = new Map<string, { totalScore: number; count: number }>();
  records.forEach(r => {
    const stats = storeStats.get(r.storeName) || { totalScore: 0, count: 0 };
    stats.totalScore += r.totalScore;
    stats.count++;
    storeStats.set(r.storeName, stats);
  });
  
  const topStores = Array.from(storeStats.entries())
    .map(([storeName, stats]) => ({
      storeName,
      totalScore: stats.totalScore,
      recordCount: stats.count,
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);
  
  const itemStats = new Map<string, { totalScore: number; count: number }>();
  records.forEach(r => {
    r.details.forEach(d => {
      const stats = itemStats.get(d.itemName) || { totalScore: 0, count: 0 };
      stats.totalScore += d.score;
      stats.count++;
      itemStats.set(d.itemName, stats);
    });
  });
  
  const topItems = Array.from(itemStats.entries())
    .map(([itemName, stats]) => ({
      itemName,
      totalScore: stats.totalScore,
      recordCount: stats.count,
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);
  
  const monthlyTrend: { month: string; totalScore: number; recordCount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const monthRecords = records.filter(r => r.inspectionDate.startsWith(month));
    monthlyTrend.push({
      month,
      totalScore: monthRecords.reduce((sum, r) => sum + r.totalScore, 0),
      recordCount: monthRecords.length,
    });
  }
  
  res.json({
    totalRecords,
    totalScore,
    avgScore,
    statusCounts,
    topStores,
    topItems,
    monthlyTrend,
  });
});

router.get('/export', (req, res) => {
  const data = records.map(r => ({
    '扣分编号': r.recordNo,
    '门店名称': r.storeName,
    '巡店日期': r.inspectionDate,
    '巡店督导': r.inspectorName,
    '提交来源': r.submissionSource,
    '扣分明细': r.details.map(d => `${d.itemName}(-${d.score}分)`).join('; '),
    '总扣分': r.totalScore,
    '状态': r.status,
    '申诉内容': r.appealContent || '',
    '调整后扣分': r.adjustedScore || '',
    '调整备注': r.adjustRemark || '',
    '创建时间': r.createdAt,
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '巡店扣分记录');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=巡店扣分记录_${new Date().toISOString().slice(0, 10)}.xlsx`);
  res.send(buffer);
});

export default router;
