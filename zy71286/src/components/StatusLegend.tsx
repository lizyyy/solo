import { PRODUCT_STATUSES, STATUS_LABELS, STATUS_COLORS } from '@/types';

const STATUS_DEFINITIONS: Record<string, string> = {
  NEW: '上市≤4周，周销量环比增长≥20%',
  HOT: '周销量≥品类均值×1.5，库存周转天数≤14',
  NORMAL: '介于畅销与滞销之间，销量稳定',
  SLOW: '周销量≤品类均值×0.3，库存周转天数≥60',
  CLEAR: '已标记清仓，价格≤成本×0.7',
};

export default function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {PRODUCT_STATUSES.map((status) => (
        <div
          key={status}
          className="group relative flex items-center gap-2"
        >
          <div
            className="w-4 h-4 rounded-md"
            style={{ backgroundColor: STATUS_COLORS[status] }}
          />
          <span className="text-sm font-medium text-navy-700">
            {STATUS_LABELS[status]}
          </span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-navy-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
            {STATUS_DEFINITIONS[status]}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
