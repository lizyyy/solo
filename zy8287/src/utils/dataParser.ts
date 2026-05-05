import Papa from 'papaparse';
import type { Event, Order, Booth, Target, DataValidationWarning } from '../types';

export const parseCSV = <T>(content: string): T[] => {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  return result.data as T[];
};

export const parseJSON = <T>(content: string): T => {
  return JSON.parse(content);
};

export const parseEvents = (content: string): Event[] => {
  const data = parseCSV<Record<string, unknown>>(content);
  return data.map((row) => ({
    id: String(row.id),
    timestamp: String(row.timestamp),
    timeSlot: String(row.timeSlot),
    hallId: String(row.hallId),
    boothId: String(row.boothId),
    visitorId: String(row.visitorId),
    entryType: row.entryType as 'scan' | 'manual' | 'camera',
    duration: Number(row.duration) || 0,
  }));
};

export const parseOrders = (content: string): Order[] => {
  const data = parseCSV<Record<string, unknown>>(content);
  return data.map((row) => ({
    orderId: String(row.orderId),
    timestamp: String(row.timestamp),
    timeSlot: String(row.timeSlot),
    hallId: String(row.hallId),
    boothId: String(row.boothId),
    visitorId: String(row.visitorId),
    amount: Number(row.amount) || 0,
    productCategory: String(row.productCategory),
    paymentMethod: String(row.paymentMethod),
    status: row.status as 'completed' | 'refunded' | 'pending',
  }));
};

export const parseBooths = (content: string): Booth[] => {
  return parseJSON<Booth[]>(content);
};

export const parseTargets = (content: string): Target[] => {
  const data = parseCSV<Record<string, unknown>>(content);
  return data.map((row) => ({
    timeSlot: String(row.timeSlot),
    hallId: String(row.hallId),
    targetVisitors: Number(row.targetVisitors) || 0,
    targetOrders: Number(row.targetOrders) || 0,
    targetRevenue: Number(row.targetRevenue) || 0,
  }));
};

export const validateOrders = (orders: Order[]): DataValidationWarning | null => {
  const orderIdMap = new Map<string, number>();
  const duplicateOrderIds: string[] = [];

  orders.forEach((order) => {
    const count = orderIdMap.get(order.orderId) || 0;
    orderIdMap.set(order.orderId, count + 1);
    if (count === 1) {
      duplicateOrderIds.push(order.orderId);
    }
  });

  if (duplicateOrderIds.length > 0) {
    return {
      type: 'duplicate_order',
      message: `检测到 ${duplicateOrderIds.length} 个重复的订单号`,
      details: duplicateOrderIds,
    };
  }

  return null;
};

export const validateBoothReferences = (
  events: Event[],
  orders: Order[],
  booths: Booth[]
): DataValidationWarning | null => {
  const boothIdSet = new Set(booths.map((b) => b.boothId));
  const missingBoothIds = new Set<string>();

  events.forEach((event) => {
    if (!boothIdSet.has(event.boothId)) {
      missingBoothIds.add(event.boothId);
    }
  });

  orders.forEach((order) => {
    if (!boothIdSet.has(order.boothId)) {
      missingBoothIds.add(order.boothId);
    }
  });

  if (missingBoothIds.size > 0) {
    return {
      type: 'missing_booth',
      message: `检测到 ${missingBoothIds.size} 个未匹配的摊位编号`,
      details: Array.from(missingBoothIds),
    };
  }

  return null;
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = (e) => {
      reject(new Error(`读取文件失败: ${file.name}`));
    };
    reader.readAsText(file);
  });
};

export const deduplicateOrders = (orders: Order[]): Order[] => {
  const seen = new Set<string>();
  return orders.filter((order) => {
    if (seen.has(order.orderId)) {
      return false;
    }
    seen.add(order.orderId);
    return true;
  });
};
