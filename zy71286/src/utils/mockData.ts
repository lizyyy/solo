import type { Product, WeeklyRecord, ProductStatus, ConfirmationStatus } from '@/types';

const CATEGORIES = ['食品饮料', '日用百货', '美妆护肤', '数码家电', '服饰鞋包'];

const PRODUCT_NAMES = [
  '有机牛奶', '进口牛排', '坚果礼盒', '速溶咖啡', '橄榄油',
  '洗衣液', '卫生纸', '牙膏套装', '洗洁精', '空气清新剂',
  '保湿面霜', '防晒霜', '口红礼盒', '精华液', '面膜套装',
  '无线耳机', '智能手环', '移动电源', '蓝牙音箱', '电动牙刷',
  '休闲T恤', '牛仔裤', '运动鞋', '连衣裙', '风衣外套',
  '婴儿奶粉', '宠物猫粮', '红酒', '茶叶礼盒', '蜂蜜',
  '厨房纸巾', '垃圾袋', '洗手液', '沐浴露', '洗发水',
  'BB霜', '睫毛膏', '香水', '护手霜', '润唇膏',
  '手机壳', '充电器', '数据线', '鼠标', '键盘',
  '袜子套装', '内衣', '围巾', '手套', '皮带',
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateProducts(): Product[] {
  const random = seededRandom(42);
  return PRODUCT_NAMES.map((name, idx) => ({
    sku: `SKU${String(idx + 1).padStart(4, '0')}`,
    name,
    category: CATEGORIES[Math.floor(random() * CATEGORIES.length)],
    cost: Math.floor(random() * 200) + 20,
    launchDate: new Date(2025, 10 + Math.floor(random() * 3), Math.floor(random() * 28) + 1),
  }));
}

function generateLifecyclePattern(random: () => number): {
  baseSales: number[];
  promoWeeks: number[];
  trueStatus: ProductStatus[];
} {
  const weeks = 24;
  const baseSales: number[] = [];
  const promoWeeks: number[] = [];
  const trueStatus: ProductStatus[] = [];

  const pattern = Math.floor(random() * 4);
  const peakWeek = Math.floor(random() * 8) + 4;
  const maxSales = Math.floor(random() * 400) + 100;
  const declineRate = 0.85 + random() * 0.1;

  for (let w = 0; w < weeks; w++) {
    let sales: number;
    switch (pattern) {
      case 0:
        sales = w < peakWeek
          ? maxSales * (1 - Math.exp(-w / 3))
          : maxSales * Math.pow(declineRate, w - peakWeek);
        break;
      case 1:
        sales = maxSales * Math.exp(-Math.pow((w - peakWeek) / 6, 2));
        break;
      case 2:
        sales = maxSales * (0.3 + 0.7 * Math.abs(Math.sin(w / 4 + random())));
        break;
      default:
        sales = maxSales * (0.5 + random() * 0.5);
    }
    baseSales.push(Math.max(5, Math.floor(sales)));

    if (random() < 0.15 && w > 2) {
      promoWeeks.push(w);
    }

    if (w < 4) {
      trueStatus.push('NEW');
    } else if (baseSales[w] > maxSales * 0.7) {
      trueStatus.push('HOT');
    } else if (baseSales[w] < maxSales * 0.2 && w > 12) {
      trueStatus.push(w > 18 && random() < 0.3 ? 'CLEAR' : 'SLOW');
    } else {
      trueStatus.push('NORMAL');
    }
  }

  return { baseSales, promoWeeks, trueStatus };
}

function calculateTurnoverDays(sales: number, inventory: number): number {
  const dailySales = Math.max(sales / 7, 0.1);
  return Math.min(365, Math.round(inventory / dailySales));
}

function generateWeeklyRecords(products: Product[]): WeeklyRecord[] {
  const records: WeeklyRecord[] = [];
  const year = 2026;

  products.forEach((product, pIdx) => {
    const random = seededRandom(100 + pIdx);
    const { baseSales, promoWeeks, trueStatus } = generateLifecyclePattern(random);

    let inventory = Math.floor(random() * 500) + 200;

    for (let w = 0; w < 24; w++) {
      const isPromotion = promoWeeks.includes(w);
      const promoMultiplier = isPromotion ? 1.5 + random() * 1.5 : 1;
      const salesVolume = Math.floor(baseSales[w] * promoMultiplier * (0.9 + random() * 0.2));

      inventory = Math.max(0, inventory - salesVolume + Math.floor(random() * 150) + 50);

      const turnoverDays = calculateTurnoverDays(salesVolume, inventory);

      let status = trueStatus[w];
      if (isPromotion && status === 'NORMAL' && salesVolume > baseSales[w] * 1.8) {
        status = 'HOT';
      }
      if (turnoverDays > 90 && (status === 'NORMAL' || status === 'HOT')) {
        status = 'SLOW';
      }

      const confirmationStatus: ConfirmationStatus =
        random() < 0.1 ? 'TEMPORARY' : 'CONFIRMED';

      const record: WeeklyRecord = {
        id: `${product.sku}-W${String(w + 1).padStart(2, '0')}`,
        sku: product.sku,
        productName: product.name,
        category: product.category,
        weekNum: w + 1,
        year,
        salesVolume,
        inventory,
        turnoverDays,
        isPromotion,
        status,
        confirmationStatus,
        notes: confirmationStatus === 'TEMPORARY' ? '待分析师审核确认' : undefined,
      };

      records.push(record);
    }
  });

  return records;
}

export const products = generateProducts();
export const weeklyRecords = generateWeeklyRecords(products);

export function getRecordsByStatusTransition(
  records: WeeklyRecord[],
  fromStatus: ProductStatus,
  toStatus: ProductStatus
): WeeklyRecord[] {
  const result: WeeklyRecord[] = [];
  const sorted = [...records].sort((a, b) => {
    if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
    return a.weekNum - b.weekNum;
  });

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].sku === sorted[i - 1].sku) {
      if (sorted[i - 1].status === fromStatus && sorted[i].status === toStatus) {
        result.push(sorted[i]);
      }
    }
  }

  return result;
}

export function getCategoryStats(records: WeeklyRecord[]): Record<string, { avgSales: number; avgTurnover: number }> {
  const stats: Record<string, { totalSales: number; totalTurnover: number; count: number }> = {};

  records.forEach(r => {
    if (!stats[r.category]) {
      stats[r.category] = { totalSales: 0, totalTurnover: 0, count: 0 };
    }
    stats[r.category].totalSales += r.salesVolume;
    stats[r.category].totalTurnover += r.turnoverDays;
    stats[r.category].count++;
  });

  const result: Record<string, { avgSales: number; avgTurnover: number }> = {};
  Object.entries(stats).forEach(([cat, s]) => {
    result[cat] = {
      avgSales: s.totalSales / s.count,
      avgTurnover: s.totalTurnover / s.count,
    };
  });

  return result;
}
