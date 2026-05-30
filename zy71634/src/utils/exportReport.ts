
import { jsPDF } from 'jspdf';
import Papa from 'papaparse';
import { Wallet, Transaction } from '../types';

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

const formatAmount = (amount: number, decimals = 2) => {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const generateCSVReport = (
  wallets: Wallet[],
  transactions: Transaction[],
  filename = 'funds-flow-report.csv'
) => {
  const txData = transactions.map((tx) => {
    const fromWallet = wallets.find((w) => w.id === tx.from);
    const toWallet = wallets.find((w) => w.id === tx.to);
    return {
      交易哈希: tx.txHash,
      发送地址: fromWallet?.address || tx.from,
      发送方标签: fromWallet?.label || '',
      接收地址: toWallet?.address || tx.to,
      接收方标签: toWallet?.label || '',
      金额: tx.amount,
      代币: tx.token,
      时间: formatDate(tx.timestamp),
      状态: tx.status,
      是否异常: tx.isAnomaly ? '是' : '否',
      异常类型: tx.anomalyType || '',
      备注: tx.notes || '',
      工作流状态: tx.workflowStatus || '',
    };
  });

  const csv = Papa.unparse(txData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

export const generatePDFReport = (
  wallets: Wallet[],
  transactions: Transaction[],
  selectedWalletId: string | null,
  filename = 'funds-flow-report.pdf'
) => {
  const doc = new jsPDF();
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(99, 102, 241);
  doc.text('链上资金流星云分析报告', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`生成时间: ${formatDate(Date.now())}`, 105, 30, { align: 'center' });

  let yPos = 45;
  const lineHeight = 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('数据概览', 15, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`钱包地址总数: ${wallets.length}`, 20, yPos);
  yPos += lineHeight;
  doc.text(`交易记录总数: ${transactions.length}`, 20, yPos);
  yPos += lineHeight;
  doc.text(`异常交易数: ${transactions.filter((t) => t.isAnomaly).length}`, 20, yPos);
  yPos += lineHeight;

  const anomalyTypes = transactions
    .filter((t) => t.isAnomaly)
    .reduce((acc, t) => {
      const type = t.anomalyType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  doc.text('异常类型分布:', 20, yPos);
  yPos += lineHeight;
  Object.entries(anomalyTypes).forEach(([type, count]) => {
    doc.text(`  - ${type}: ${count}`, 25, yPos);
    yPos += lineHeight;
  });

  if (selectedWalletId) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('选中钱包详情', 15, yPos);
    yPos += 10;

    const wallet = wallets.find((w) => w.id === selectedWalletId);
    if (wallet) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(`标签: ${wallet.label}`, 20, yPos);
      yPos += lineHeight;
      doc.text(`地址: ${wallet.address}`, 20, yPos);
      yPos += lineHeight;
      doc.text(`余额: $${formatAmount(wallet.balance, 0)}`, 20, yPos);
      yPos += lineHeight;
      doc.text(`状态: ${wallet.status}`, 20, yPos);
      yPos += lineHeight;
      doc.text(`标签: ${wallet.tags.join(', ')}`, 20, yPos);
      yPos += lineHeight;
      if (wallet.notes) {
        doc.text(`备注: ${wallet.notes}`, 20, yPos);
        yPos += lineHeight;
      }
    }
  }

  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('异常交易列表', 15, yPos);
  yPos += 10;

  const anomalyTxs = transactions.filter((t) => t.isAnomaly).slice(0, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  anomalyTxs.forEach((tx, i) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    const fromWallet = wallets.find((w) => w.id === tx.from)?.label || tx.from.slice(0, 10);
    const toWallet = wallets.find((w) => w.id === tx.to)?.label || tx.to.slice(0, 10);
    
    doc.setTextColor(239, 68, 68);
    doc.text(`${i + 1}. ${tx.anomalyType}`, 20, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += lineHeight - 1;
    doc.text(`   ${fromWallet} → ${toWallet}: ${formatAmount(tx.amount)} ${tx.token}`, 20, yPos);
    yPos += lineHeight - 1;
    doc.text(`   ${formatDate(tx.timestamp)}`, 20, yPos);
    yPos += lineHeight - 1;
    if (tx.notes) {
      doc.text(`   备注: ${tx.notes}`, 20, yPos);
      yPos += lineHeight;
    }
    yPos += 3;
  });

  doc.save(filename);
};
