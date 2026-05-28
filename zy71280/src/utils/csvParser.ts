import Papa from 'papaparse';
import type {
  AuctionItem,
  BidRecord,
  TransactionRecord,
  UnsoldRecord,
  UploadedData,
} from '../types/auction';

function parseNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.replace(/[¥￥,，\s]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toISOString().split('T')[0];
}

function generateId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

export function parseItemsCSV(csvContent: string): AuctionItem[] {
  const result = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  return result.data.map((row: any, index: number) => ({
    id: row.id || generateId('ITEM', index),
    name: row.name || row['拍品名称'] || `拍品${index + 1}`,
    category: row.category || row['品类'] || '其他',
    appraisedValue: parseNumber(row.appraisedValue || row['估值'] || row['估价']),
    appraiser: row.appraiser || row['估值师'] || undefined,
    appraisalDate: parseDate(row.appraisalDate || row['估值日期']),
    condition: row.condition || row['品相'] || '完好',
    provenance: row.provenance || row['来源'] || undefined,
    notes: row.notes || row['备注'] || undefined,
  }));
}

export function parseBidsCSV(csvContent: string): BidRecord[] {
  const result = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  return result.data.map((row: any, index: number) => ({
    id: row.id || generateId('BID', index),
    itemId: row.itemId || row['拍品ID'] || '',
    buyerId: row.buyerId || row['买家ID'] || generateId('BUY', index),
    buyerName: row.buyerName || row['买家名称'] || `买家${index + 1}`,
    bidAmount: parseNumber(row.bidAmount || row['出价金额']),
    bidDate: parseDate(row.bidDate || row['出价日期']),
    bidType: (row.bidType || row['出价方式'] || 'floor') as BidRecord['bidType'],
    isWinning: (row.isWinning || row['是否中标'] || 'false').toString().toLowerCase() === 'true',
    buyerActivity: parseNumber(row.buyerActivity || row['买家活跃度']) || 5,
    buyerHistory: parseNumber(row.buyerHistory || row['历史成交次数']),
  }));
}

export function parseTransactionsCSV(csvContent: string): TransactionRecord[] {
  const result = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  return result.data.map((row: any, index: number) => ({
    id: row.id || generateId('TRX', index),
    itemId: row.itemId || row['拍品ID'] || '',
    itemName: row.itemName || row['拍品名称'] || '',
    salePrice: parseNumber(row.salePrice || row['成交价']),
    reservePrice: parseNumber(row.reservePrice || row['保留价']),
    saleDate: parseDate(row.saleDate || row['成交日期']),
    buyerId: row.buyerId || row['买家ID'] || '',
    commissionRate: parseNumber(row.commissionRate || row['佣金比例']),
    commissionAmount: parseNumber(row.commissionAmount || row['佣金金额']),
    auctionHouse: row.auctionHouse || row['拍卖行'] || '',
    notes: row.notes || row['备注'] || undefined,
  }));
}

export function parseUnsoldsCSV(csvContent: string): UnsoldRecord[] {
  const result = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  return result.data.map((row: any, index: number) => ({
    id: row.id || generateId('UNSOLD', index),
    itemId: row.itemId || row['拍品ID'] || '',
    itemName: row.itemName || row['拍品名称'] || '',
    appraisedValue: parseNumber(row.appraisedValue || row['估值']),
    reservePrice: parseNumber(row.reservePrice || row['保留价']),
    highestBid: parseNumber(row.highestBid || row['最高出价']),
    unsoldDate: parseDate(row.unsoldDate || row['流拍日期']),
    reason: row.reason || row['流拍原因'] || '未达保留价',
    reAuctionCount: parseNumber(row.reAuctionCount || row['重拍次数']),
    storageCost: row.storageCost || row['仓储成本'] ? parseNumber(row.storageCost || row['仓储成本']) : undefined,
    marketingCost: row.marketingCost || row['营销成本'] ? parseNumber(row.marketingCost || row['营销成本']) : undefined,
    opportunityCost: row.opportunityCost || row['机会成本'] ? parseNumber(row.opportunityCost || row['机会成本']) : undefined,
  }));
}

export async function parseCSVFiles(files: {
  items?: File;
  bids?: File;
  transactions?: File;
  unsolds?: File;
}): Promise<UploadedData> {
  const readFile = (file?: File): Promise<string> => {
    if (!file) return Promise.resolve('');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  };

  const [itemsContent, bidsContent, transactionsContent, unsoldsContent] = await Promise.all([
    files.items ? readFile(files.items) : '',
    files.bids ? readFile(files.bids) : '',
    files.transactions ? readFile(files.transactions) : '',
    files.unsolds ? readFile(files.unsolds) : '',
  ]);

  return {
    items: itemsContent ? parseItemsCSV(itemsContent) : [],
    bids: bidsContent ? parseBidsCSV(bidsContent) : [],
    transactions: transactionsContent ? parseTransactionsCSV(transactionsContent) : [],
    unsolds: unsoldsContent ? parseUnsoldsCSV(unsoldsContent) : [],
  };
}

export function generateSampleCSV(type: 'items' | 'bids' | 'transactions' | 'unsolds'): string {
  const headers: Record<string, string[]> = {
    items: ['id', 'name', 'category', 'appraisedValue', 'appraiser', 'appraisalDate', 'condition', 'provenance', 'notes'],
    bids: ['id', 'itemId', 'buyerId', 'buyerName', 'bidAmount', 'bidDate', 'bidType', 'isWinning', 'buyerActivity', 'buyerHistory'],
    transactions: ['id', 'itemId', 'itemName', 'salePrice', 'reservePrice', 'saleDate', 'buyerId', 'commissionRate', 'commissionAmount', 'auctionHouse', 'notes'],
    unsolds: ['id', 'itemId', 'itemName', 'appraisedValue', 'reservePrice', 'highestBid', 'unsoldDate', 'reason', 'reAuctionCount', 'storageCost', 'marketingCost', 'opportunityCost'],
  };

  return headers[type].join(',') + '\n';
}
