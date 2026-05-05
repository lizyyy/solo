import type {
  Event,
  Order,
  Booth,
  Target,
  AggregatedData,
  TimeSlotTrend,
  HallHeatmapData,
  BoothRankingData,
  Filters,
} from '../types';

type AggregateKey = `${string}-${string}-${string}`;

const createAggregateKey = (timeSlot: string, hallId: string, boothId: string): AggregateKey => {
  return `${timeSlot}-${hallId}-${boothId}` as AggregateKey;
};

export const aggregateData = (
  events: Event[],
  orders: Order[],
  booths: Booth[],
  targets: Target[]
): AggregatedData[] => {
  const boothMap = new Map(booths.map((b) => [b.boothId, b]));
  const targetMap = new Map(
    targets.map((t) => [`${t.timeSlot}-${t.hallId}`, t])
  );

  const aggregatedMap = new Map<AggregateKey, AggregatedData>();

  events.forEach((event) => {
    const key = createAggregateKey(event.timeSlot, event.hallId, event.boothId);
    const booth = boothMap.get(event.boothId);
    const target = targetMap.get(`${event.timeSlot}-${event.hallId}`);

    if (!aggregatedMap.has(key)) {
      aggregatedMap.set(key, {
        timeSlot: event.timeSlot,
        hallId: event.hallId,
        hallName: booth?.hallName || event.hallId,
        boothId: event.boothId,
        boothName: booth?.boothName || event.boothId,
        exhibitor: booth?.exhibitor || '',
        industry: booth?.industry || '',
        visitors: 0,
        orders: 0,
        revenue: 0,
        conversionRate: 0,
        avgOrderValue: 0,
        targetVisitors: target?.targetVisitors || 0,
        targetOrders: target?.targetOrders || 0,
        targetRevenue: target?.targetRevenue || 0,
        visitorGap: 0,
        visitorGapPercent: 0,
        orderGap: 0,
        orderGapPercent: 0,
        revenueGap: 0,
        revenueGapPercent: 0,
      });
    }

    const data = aggregatedMap.get(key)!;
    data.visitors += 1;
  });

  const completedOrders = orders.filter((o) => o.status === 'completed');
  completedOrders.forEach((order) => {
    const key = createAggregateKey(order.timeSlot, order.hallId, order.boothId);
    const booth = boothMap.get(order.boothId);
    const target = targetMap.get(`${order.timeSlot}-${order.hallId}`);

    if (!aggregatedMap.has(key)) {
      aggregatedMap.set(key, {
        timeSlot: order.timeSlot,
        hallId: order.hallId,
        hallName: booth?.hallName || order.hallId,
        boothId: order.boothId,
        boothName: booth?.boothName || order.boothId,
        exhibitor: booth?.exhibitor || '',
        industry: booth?.industry || '',
        visitors: 0,
        orders: 0,
        revenue: 0,
        conversionRate: 0,
        avgOrderValue: 0,
        targetVisitors: target?.targetVisitors || 0,
        targetOrders: target?.targetOrders || 0,
        targetRevenue: target?.targetRevenue || 0,
        visitorGap: 0,
        visitorGapPercent: 0,
        orderGap: 0,
        orderGapPercent: 0,
        revenueGap: 0,
        revenueGapPercent: 0,
      });
    }

    const data = aggregatedMap.get(key)!;
    data.orders += 1;
    data.revenue += order.amount;
  });

  const result: AggregatedData[] = [];
  aggregatedMap.forEach((data) => {
    data.conversionRate = data.visitors > 0 ? data.orders / data.visitors : 0;
    data.avgOrderValue = data.orders > 0 ? data.revenue / data.orders : 0;

    data.visitorGap = data.visitors - data.targetVisitors;
    data.visitorGapPercent = data.targetVisitors > 0 ? data.visitorGap / data.targetVisitors : 0;

    data.orderGap = data.orders - data.targetOrders;
    data.orderGapPercent = data.targetOrders > 0 ? data.orderGap / data.targetOrders : 0;

    data.revenueGap = data.revenue - data.targetRevenue;
    data.revenueGapPercent = data.targetRevenue > 0 ? data.revenueGap / data.targetRevenue : 0;

    result.push(data);
  });

  return result;
};

export const filterAggregatedData = (
  data: AggregatedData[],
  filters: Filters
): AggregatedData[] => {
  return data.filter((item) => {
    if (filters.hallIds.length > 0 && !filters.hallIds.includes(item.hallId)) {
      return false;
    }
    if (filters.boothIds.length > 0 && !filters.boothIds.includes(item.boothId)) {
      return false;
    }
    if (filters.timeSlots.length > 0 && !filters.timeSlots.includes(item.timeSlot)) {
      return false;
    }
    if (filters.industries.length > 0 && !filters.industries.includes(item.industry)) {
      return false;
    }
    return true;
  });
};

export const getTimeSlotTrends = (data: AggregatedData[]): TimeSlotTrend[] => {
  const timeSlotMap = new Map<string, TimeSlotTrend>();

  data.forEach((item) => {
    if (!timeSlotMap.has(item.timeSlot)) {
      timeSlotMap.set(item.timeSlot, {
        timeSlot: item.timeSlot,
        visitors: 0,
        orders: 0,
        revenue: 0,
        conversionRate: 0,
        avgOrderValue: 0,
      });
    }

    const trend = timeSlotMap.get(item.timeSlot)!;
    trend.visitors += item.visitors;
    trend.orders += item.orders;
    trend.revenue += item.revenue;
  });

  const result: TimeSlotTrend[] = [];
  timeSlotMap.forEach((trend) => {
    trend.conversionRate = trend.visitors > 0 ? trend.orders / trend.visitors : 0;
    trend.avgOrderValue = trend.orders > 0 ? trend.revenue / trend.orders : 0;
    result.push(trend);
  });

  return result.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
};

export const getHallHeatmapData = (data: AggregatedData[]): HallHeatmapData[] => {
  const hallMap = new Map<string, HallHeatmapData>();

  data.forEach((item) => {
    if (!hallMap.has(item.hallId)) {
      hallMap.set(item.hallId, {
        hallId: item.hallId,
        hallName: item.hallName,
        visitors: 0,
        orders: 0,
        revenue: 0,
        conversionRate: 0,
        avgOrderValue: 0,
      });
    }

    const hallData = hallMap.get(item.hallId)!;
    hallData.visitors += item.visitors;
    hallData.orders += item.orders;
    hallData.revenue += item.revenue;
  });

  const result: HallHeatmapData[] = [];
  hallMap.forEach((hallData) => {
    hallData.conversionRate = hallData.visitors > 0 ? hallData.orders / hallData.visitors : 0;
    hallData.avgOrderValue = hallData.orders > 0 ? hallData.revenue / hallData.orders : 0;
    result.push(hallData);
  });

  return result.sort((a, b) => a.hallId.localeCompare(b.hallId));
};

export const getBoothRankingData = (
  data: AggregatedData[],
  sortBy: 'visitors' | 'orders' | 'revenue' | 'conversionRate' = 'revenue',
  limit?: number
): BoothRankingData[] => {
  const boothMap = new Map<string, BoothRankingData>();

  data.forEach((item) => {
    if (!boothMap.has(item.boothId)) {
      boothMap.set(item.boothId, {
        boothId: item.boothId,
        boothName: item.boothName,
        exhibitor: item.exhibitor,
        hallName: item.hallName,
        visitors: 0,
        orders: 0,
        revenue: 0,
        conversionRate: 0,
        avgOrderValue: 0,
      });
    }

    const boothData = boothMap.get(item.boothId)!;
    boothData.visitors += item.visitors;
    boothData.orders += item.orders;
    boothData.revenue += item.revenue;
  });

  const result: BoothRankingData[] = [];
  boothMap.forEach((boothData) => {
    boothData.conversionRate = boothData.visitors > 0 ? boothData.orders / boothData.visitors : 0;
    boothData.avgOrderValue = boothData.orders > 0 ? boothData.revenue / boothData.orders : 0;
    result.push(boothData);
  });

  result.sort((a, b) => {
    switch (sortBy) {
      case 'visitors':
        return b.visitors - a.visitors;
      case 'orders':
        return b.orders - a.orders;
      case 'revenue':
        return b.revenue - a.revenue;
      case 'conversionRate':
        return b.conversionRate - a.conversionRate;
      default:
        return b.revenue - a.revenue;
    }
  });

  return limit ? result.slice(0, limit) : result;
};

export const getDistinctValues = (
  data: AggregatedData[]
): {
  hallIds: string[];
  hallNames: Map<string, string>;
  boothIds: string[];
  boothNames: Map<string, string>;
  timeSlots: string[];
  industries: string[];
} => {
  const hallIdSet = new Set<string>();
  const hallNameMap = new Map<string, string>();
  const boothIdSet = new Set<string>();
  const boothNameMap = new Map<string, string>();
  const timeSlotSet = new Set<string>();
  const industrySet = new Set<string>();

  data.forEach((item) => {
    hallIdSet.add(item.hallId);
    hallNameMap.set(item.hallId, item.hallName);
    boothIdSet.add(item.boothId);
    boothNameMap.set(item.boothId, item.boothName);
    timeSlotSet.add(item.timeSlot);
    if (item.industry) {
      industrySet.add(item.industry);
    }
  });

  return {
    hallIds: Array.from(hallIdSet).sort(),
    hallNames: hallNameMap,
    boothIds: Array.from(boothIdSet).sort(),
    boothNames: boothNameMap,
    timeSlots: Array.from(timeSlotSet).sort(),
    industries: Array.from(industrySet).sort(),
  };
};
