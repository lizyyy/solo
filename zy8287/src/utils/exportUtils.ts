import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import type { AggregatedData, Event, Order } from '../types';

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

export const exportToCSV = (
  data: AggregatedData[],
  filename: string = 'dashboard_data.csv'
): void => {
  const headers = [
    '时段',
    '展馆ID',
    '展馆名称',
    '摊位ID',
    '摊位名称',
    '展商',
    '行业',
    '客流量',
    '订单数',
    '成交额',
    '转化率',
    '客单价',
    '目标客流',
    '目标订单',
    '目标成交额',
    '客流差距',
    '客流差距%',
    '订单差距',
    '订单差距%',
    '成交额差距',
    '成交额差距%',
  ];

  const rows = data.map((item) => [
    item.timeSlot,
    item.hallId,
    item.hallName,
    item.boothId,
    item.boothName,
    item.exhibitor,
    item.industry,
    item.visitors,
    item.orders,
    item.revenue,
    formatPercent(item.conversionRate),
    formatCurrency(item.avgOrderValue),
    item.targetVisitors,
    item.targetOrders,
    formatCurrency(item.targetRevenue),
    item.visitorGap,
    formatPercent(item.visitorGapPercent),
    item.orderGap,
    formatPercent(item.orderGapPercent),
    item.revenueGap,
    formatPercent(item.revenueGapPercent),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToXLSX = (
  aggregatedData: AggregatedData[],
  events?: Event[],
  orders?: Order[],
  filename: string = 'dashboard_data.xlsx'
): void => {
  const wb = XLSX.utils.book_new();

  const summaryData = aggregatedData.map((item) => ({
    时段: item.timeSlot,
    展馆ID: item.hallId,
    展馆名称: item.hallName,
    摊位ID: item.boothId,
    摊位名称: item.boothName,
    展商: item.exhibitor,
    行业: item.industry,
    客流量: item.visitors,
    订单数: item.orders,
    成交额: item.revenue,
    转化率: item.conversionRate,
    客单价: item.avgOrderValue,
    目标客流: item.targetVisitors,
    目标订单: item.targetOrders,
    目标成交额: item.targetRevenue,
    客流差距: item.visitorGap,
    客流差距Percent: item.visitorGapPercent,
    订单差距: item.orderGap,
    订单差距Percent: item.orderGapPercent,
    成交额差距: item.revenueGap,
    成交额差距Percent: item.revenueGapPercent,
  }));

  const ws1 = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws1, '汇总数据');

  if (events && events.length > 0) {
    const eventData = events.map((item) => ({
      事件ID: item.id,
      时间: item.timestamp,
      时段: item.timeSlot,
      展馆ID: item.hallId,
      摊位ID: item.boothId,
      访客ID: item.visitorId,
      入场方式: item.entryType,
      '停留时长(分钟)': item.duration,
    }));
    const ws2 = XLSX.utils.json_to_sheet(eventData);
    XLSX.utils.book_append_sheet(wb, ws2, '客流明细');
  }

  if (orders && orders.length > 0) {
    const orderData = orders.map((item) => ({
      订单号: item.orderId,
      时间: item.timestamp,
      时段: item.timeSlot,
      展馆ID: item.hallId,
      摊位ID: item.boothId,
      访客ID: item.visitorId,
      金额: item.amount,
      产品类别: item.productCategory,
      支付方式: item.paymentMethod,
      订单状态: item.status,
    }));
    const ws3 = XLSX.utils.json_to_sheet(orderData);
    XLSX.utils.book_append_sheet(wb, ws3, '订单明细');
  }

  XLSX.writeFile(wb, filename);
};

export const exportToPNG = async (
  element: HTMLElement,
  filename: string = 'dashboard_screenshot.png'
): Promise<void> => {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  } catch (error) {
    console.error('导出PNG失败:', error);
    throw new Error('导出PNG失败，请重试');
  }
};
