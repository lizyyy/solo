import type { WorkOrder, FilterState } from '../types';

export function applyFilters(workOrders: WorkOrder[], filters: FilterState): WorkOrder[] {
  return workOrders.filter((order) => {
    if (filters.dateRange) {
      const [start, end] = filters.dateRange;
      const t = new Date(order.reportTime).getTime();
      if (t < new Date(start).getTime() || t > new Date(end + ' 23:59:59').getTime()) return false;
    }
    if (filters.searchKeyword) {
      const kw = filters.searchKeyword.toLowerCase();
      if (!order.deviceNo.toLowerCase().includes(kw) &&
          !order.orderNo.toLowerCase().includes(kw)) {
        return false;
      }
    }
    if (filters.exactDeviceNo && order.deviceNo !== filters.exactDeviceNo) {
      return false;
    }
    if (filters.status && order.status !== filters.status) return false;
    if (filters.judgment && order.judgment !== filters.judgment) return false;
    if (filters.shift && order.shift !== filters.shift) return false;
    if (filters.priority && order.priority !== filters.priority) return false;
    if (filters.hasLateArrival !== null) {
      const hasLate = order.photos.some(p => p.isLateArrival) || order.attachments.some(a => a.isLateArrival);
      if (filters.hasLateArrival && !hasLate) return false;
      if (!filters.hasLateArrival && hasLate) return false;
    }
    if (filters.hitsOldTerminology !== null) {
      const hits = order.photos.some(p => p.hitsOldTerminology);
      if (filters.hitsOldTerminology && !hits) return false;
      if (!filters.hitsOldTerminology && hits) return false;
    }
    return true;
  });
}
