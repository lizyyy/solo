import { NOTIFICATION_STATUS, STATUS_LABELS } from '../constants/status';
import dayjs from 'dayjs';

export const generateMarkdownReport = (notifications, filters = {}) => {
  const generateTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  const storeFilter = filters.storeName || '全部';
  const statusFilter = filters.status 
    ? STATUS_LABELS[filters.status] 
    : '全部状态';

  const successCount = notifications.filter(n => n.status === NOTIFICATION_STATUS.SUCCESS).length;
  const failedCount = notifications.filter(n => n.status === NOTIFICATION_STATUS.FAILED).length;
  const pendingCount = notifications.filter(n => n.status === NOTIFICATION_STATUS.PENDING).length;
  const sendingCount = notifications.filter(n => n.status === NOTIFICATION_STATUS.SENDING).length;
  const totalRetryCount = notifications.reduce((sum, n) => sum + n.retryCount, 0);

  const failedNotifications = notifications.filter(n => n.status === NOTIFICATION_STATUS.FAILED);

  let markdown = `# 门店取件通知补发处理报告\n\n`;
  markdown += `> 生成时间：${generateTime}\n\n`;
  markdown += `## 筛选条件\n\n`;
  markdown += `- **门店**：${storeFilter}\n`;
  markdown += `- **状态**：${statusFilter}\n\n`;
  
  markdown += `## 统计概览\n\n`;
  markdown += `| 指标 | 数值 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 总通知数 | ${notifications.length} |\n`;
  markdown += `| 待补发 | ${pendingCount} |\n`;
  markdown += `| 发送中 | ${sendingCount} |\n`;
  markdown += `| 已成功 | ${successCount} |\n`;
  markdown += `| 失败 | ${failedCount} |\n`;
  markdown += `| 总重试次数 | ${totalRetryCount} |\n\n`;

  markdown += `## 详细列表\n\n`;
  markdown += `| 门店 | 客户 | 包裹号 | 状态 | 重试次数 | 最后发送时间 |\n`;
  markdown += `|------|------|--------|------|----------|--------------|\n`;
  
  notifications.forEach(n => {
    const statusLabel = STATUS_LABELS[n.status] || n.status;
    const lastSendTime = n.lastSendTime || '-';
    markdown += `| ${n.storeName} | ${n.customerName} | ${n.packageNo} | ${statusLabel} | ${n.retryCount} | ${lastSendTime} |\n`;
  });

  if (failedNotifications.length > 0) {
    markdown += `\n## 失败详情\n\n`;
    failedNotifications.forEach((n, index) => {
      markdown += `### ${index + 1}. ${n.storeName} - ${n.customerName}\n\n`;
      markdown += `- **包裹号**：${n.packageNo}\n`;
      markdown += `- **联系方式**：${n.phone}\n`;
      markdown += `- **创建时间**：${n.createTime}\n`;
      markdown += `- **重试次数**：${n.retryCount}\n`;
      markdown += `- **最后发送时间**：${n.lastSendTime || '-'}\n`;
      markdown += `- **失败原因**：\n\n`;
      markdown += `\`\`\`\n${n.failureReason}\n\`\`\`\n\n`;
    });
  }

  markdown += `\n---\n\n`;
  markdown += `*本报告由门店取件通知补发小后台自动生成*\n`;

  return markdown;
};

export const downloadMarkdown = (markdown, filename = null) => {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const actualFilename = filename || `取件通知补发报告_${timestamp}.md`;
  
  link.href = url;
  link.download = actualFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
