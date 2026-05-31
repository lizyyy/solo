import { useState, useMemo } from 'react';
import {
  FileBarChart,
  Check,
  AlertTriangle,
  Edit3,
  Download,
  Calendar,
  Music,
  User,
  Hash,
  ChevronDown,
  ChevronUp,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SourceTag } from '../components/ui/SourceTag';
import { summaryService } from '../services/SummaryService';
import { RecordStatus, RehearsalSummary as RehearsalSummaryType, SummaryItem } from '../types';
import { useToast } from '../components/ui/Toast';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export function RehearsalSummary() {
  const { records, changeLogs } = useStore();
  const { success } = useToast();

  const uniqueDates = [...new Set(records.map((r) => r.rehearsalDate))].sort().reverse();
  const [selectedDate, setSelectedDate] = useState(uniqueDates[0] || format(new Date(), 'yyyy-MM-dd'));
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const summary = useMemo(() => {
    if (!selectedDate) return null;
    return summaryService.generateSummary(selectedDate, records, changeLogs);
  }, [selectedDate, records, changeLogs]);

  const categorizedItems = useMemo(() => {
    if (!summary) return { confirmed: [], toFill: [], manual: [] };
    return {
      confirmed: summary.items.filter((i) => i.category === RecordStatus.CONFIRMED),
      toFill: summary.items.filter((i) => i.category === RecordStatus.TO_FILL),
      manual: summary.items.filter((i) => i.category === RecordStatus.MANUAL_EDITED),
    };
  }, [summary]);

  const chartData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: '已确认', value: summary.confirmedCount, color: '#2D6A4F' },
      { name: '待补', value: summary.toFillCount, color: '#E07A5F' },
      { name: '人工修改', value: summary.manualEditedCount, color: '#9F86C0' },
    ].filter((d) => d.value > 0);
  }, [summary]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getRecordById = (id: string) => records.find((r) => r.id === id);

  const handleExport = () => {
    if (!summary) return;
    const markdown = summaryService.exportToMarkdown(summary, records);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `排练小结_${summary.date}.md`;
    a.click();
    URL.revokeObjectURL(url);
    success('已导出排练小结');
  };

  const SummaryItemCard = ({ item }: { item: SummaryItem }) => {
    const record = getRecordById(item.recordId);
    if (!record) return null;

    const isExpanded = expandedItems.has(item.id);

    return (
      <div
        className="card overflow-hidden transition-all duration-300"
        style={{ animationDelay: '0ms' }}
      >
        <div
          className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
          onClick={() => toggleExpand(item.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                item.category === RecordStatus.CONFIRMED ? 'bg-success-100' :
                item.category === RecordStatus.TO_FILL ? 'bg-warning-100' : 'bg-accent-100'
              }`}>
                {item.category === RecordStatus.CONFIRMED && <Check className="w-5 h-5 text-success-600" />}
                {item.category === RecordStatus.TO_FILL && <AlertTriangle className="w-5 h-5 text-warning-600" />}
                {item.category === RecordStatus.MANUAL_EDITED && <Edit3 className="w-5 h-5 text-accent-600" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{record.studentName}</span>
                  <span className="text-sm text-gray-500">{record.sectionName}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-sm text-gray-600">
                    小节 {record.measureStart}-{record.measureEnd}
                  </span>
                  <SourceTag source={record.source} showIcon={false} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={record.status} />
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  学生
                </label>
                <p className="font-medium text-gray-900">{record.studentName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  速度
                </label>
                <p className="font-mono text-gray-900">♩ = {record.tempo}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" />
                  来源
                </label>
                <SourceTag source={record.source} />
              </div>
            </div>

            <div className="handling-caliber">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-secondary-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">处理口径</p>
                  <p className="text-sm text-gray-600">{item.handlingCaliber}</p>
                </div>
              </div>
            </div>

            {record.remarks && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">备注</p>
                <p className="text-sm text-gray-700">{record.remarks}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const SummarySection = ({
    title,
    items,
    icon: Icon,
    colorClass,
  }: {
    title: string;
    items: SummaryItem[];
    icon: any;
    colorClass: string;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-serif font-semibold text-gray-900 flex items-center gap-2">
          <Icon className={`w-5 h-5 ${colorClass}`} />
          {title}
          <span className="text-sm font-normal text-gray-500">({items.length} 条)</span>
        </h3>
      </div>
      {items.length === 0 ? (
        <div className="card p-8 text-center">
          <Check className="w-12 h-12 text-success-300 mx-auto mb-3" />
          <p className="text-gray-500">暂无此类记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <SummaryItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-3">
            <FileBarChart className="w-7 h-7 text-primary-600" />
            排练小结
          </h2>
          <p className="text-sm text-gray-500 mt-1">按状态分类展示记录，附带处理口径说明</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              className="input-field w-auto"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              {uniqueDates.map((d) => (
                <option key={d} value={d}>
                  {format(new Date(d), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                </option>
              ))}
            </select>
          </div>
          {summary && (
            <button onClick={handleExport} className="btn btn-secondary">
              <Download className="w-4 h-4" />
              导出报告
            </button>
          )}
        </div>
      </div>

      {summary && summary.totalRecords > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">总记录数</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalRecords}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                  <FileBarChart className="w-6 h-6 text-primary-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm text-success-600">
                <TrendingUp className="w-4 h-4" />
                <span>{Math.round((summary.confirmedCount / summary.totalRecords) * 100)}% 已确认</span>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">已确认</p>
                  <p className="text-3xl font-bold text-success-600 mt-1">{summary.confirmedCount}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center">
                  <Check className="w-6 h-6 text-success-600" />
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-success-500 rounded-full transition-all duration-500"
                  style={{ width: `${(summary.confirmedCount / summary.totalRecords) * 100}%` }}
                />
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">待补</p>
                  <p className="text-3xl font-bold text-warning-600 mt-1">{summary.toFillCount}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-warning-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-warning-600" />
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-warning-500 rounded-full transition-all duration-500"
                  style={{ width: `${(summary.toFillCount / summary.totalRecords) * 100}%` }}
                />
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">人工修改</p>
                  <p className="text-3xl font-bold text-accent-600 mt-1">{summary.manualEditedCount}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center">
                  <Edit3 className="w-6 h-6 text-accent-600" />
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all duration-500"
                  style={{ width: `${(summary.manualEditedCount / summary.totalRecords) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {chartData.length > 1 && (
            <div className="card p-6">
              <h3 className="text-lg font-serif font-semibold text-gray-900 mb-4">状态分布</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} 条`, name]}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="space-y-8">
            <SummarySection
              title="已确认记录"
              items={categorizedItems.confirmed}
              icon={Check}
              colorClass="text-success-600"
            />
            <SummarySection
              title="待补记录"
              items={categorizedItems.toFill}
              icon={AlertTriangle}
              colorClass="text-warning-600"
            />
            <SummarySection
              title="人工修改记录"
              items={categorizedItems.manual}
              icon={Edit3}
              colorClass="text-accent-600"
            />
          </div>
        </>
      ) : (
        <div className="card p-12 text-center">
          <FileBarChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无排练小结</h3>
          <p className="text-gray-500">
            {selectedDate ? `所选日期（${selectedDate}）暂无记录` : '请选择日期查看排练小结'}
          </p>
        </div>
      )}
    </div>
  );
}
