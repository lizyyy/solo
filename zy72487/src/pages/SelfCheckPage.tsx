import { useEffect, useState } from 'react';
import {
  Play,
  RefreshCw,
  Copy,
  Home,
  Calculator,
  Download,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';
import { useSelfCheckStore } from '@/stores/useRecordStore';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export default function SelfCheckPage() {
  const { result, loading, runAll } = useSelfCheckStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    runAll();
  }, [runAll]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const checkItems = [
    {
      key: 'duplicateImport',
      title: '重复导入检测',
      icon: Copy,
      description: '检测同一红线图编号的多次导入',
      data: result?.duplicateImport || [],
      color: 'danger',
    },
    {
      key: 'communityNameIssue',
      title: '小区新旧名检测',
      icon: Home,
      description: '基于地址信息识别可能的新旧小区名',
      data: result?.communityNameIssue || [],
      color: 'warning',
    },
    {
      key: 'recalcConsistency',
      title: '补录重算验证',
      icon: Calculator,
      description: '验证补录数据后重算的一致性',
      data: result?.recalcConsistency || [],
      color: 'municipal',
    },
    {
      key: 'exportConsistency',
      title: '导出一致性校验',
      icon: Download,
      description: '校验导出数据、页面展示、接口返回三者一致',
      data: result?.exportConsistency || [],
      color: 'success',
    },
  ];

  const totalIssues =
    (result?.duplicateImport.length || 0) +
    (result?.communityNameIssue.length || 0) +
    (result?.recalcConsistency.length || 0) +
    (result?.exportConsistency.filter((i) => !i.isConsistent).length || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">自检中心</h2>
          <p className="text-sm text-slate-500 mt-1">
            覆盖重复导入、小区新旧名、补录重算、导出一致性四大高频出错场景
          </p>
        </div>
        <button
          onClick={runAll}
          className="btn-primary flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '检测中...' : '重新检测'}
        </button>
      </div>

      {result && (
        <div className="text-sm text-slate-500">
          检测时间：{format(new Date(result.checkTime), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {checkItems.map((item) => {
          const count = item.key === 'exportConsistency'
            ? (item.data as Array<{ isConsistent: boolean }>).filter((d) => !d.isConsistent).length
            : (item.data as Array<unknown>).length;
          const hasIssue = count > 0;
          const colorClasses = {
            danger: hasIssue ? 'bg-danger-50 border-danger-200' : 'bg-slate-50 border-slate-200',
            warning: hasIssue ? 'bg-warning-50 border-warning-200' : 'bg-slate-50 border-slate-200',
            municipal: hasIssue ? 'bg-municipal-50 border-municipal-200' : 'bg-slate-50 border-slate-200',
            success: hasIssue ? 'bg-danger-50 border-danger-200' : 'bg-slate-50 border-slate-200',
          };
          const badgeClasses = {
            danger: hasIssue ? 'bg-danger-500 text-white' : 'bg-slate-300 text-white',
            warning: hasIssue ? 'bg-warning-500 text-white' : 'bg-slate-300 text-white',
            municipal: hasIssue ? 'bg-municipal-500 text-white' : 'bg-slate-300 text-white',
            success: hasIssue ? 'bg-danger-500 text-white' : 'bg-success-500 text-white',
          };

          return (
            <div key={item.key} className={`card p-4 border ${colorClasses[item.color as keyof typeof colorClasses]}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded ${hasIssue ? 'bg-white/80' : 'bg-white'}`}>
                    <item.icon className={`w-5 h-5 ${hasIssue ? 'text-slate-700' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                  </div>
                </div>
                <span className={`status-badge ${badgeClasses[item.color as keyof typeof badgeClasses]}`}>
                  {count} 项
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            {totalIssues > 0 ? (
              <AlertTriangle className="w-5 h-5 text-warning-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success-500" />
            )}
            详细检测报告
          </h3>
          <span className="text-sm text-slate-500">
            共发现 {totalIssues} 个需要关注的问题
          </span>
        </div>

        <div className="space-y-3">
          {checkItems.map((item) => {
            const isExpanded = expanded[item.key];
            const data = item.data as unknown as Array<Record<string, unknown>>;
            const hasIssue = data.length > 0;

            return (
              <div key={item.key} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpand(item.key)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-slate-500" />
                    <span className="font-medium text-slate-700">{item.title}</span>
                    <span className="text-xs text-slate-500">
                      {item.key === 'exportConsistency'
                        ? `${data.filter((d) => !d.isConsistent).length} 处不一致`
                        : `${data.length} 项`}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-4 space-y-2">
                    {item.key === 'duplicateImport' && result?.duplicateImport.map((dup, idx) => (
                      <div key={idx} className="p-3 bg-danger-50 border border-danger-100 rounded text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-danger-800">红线图编号：{dup.redLineNo}</span>
                          <span className="text-danger-600">重复 {dup.count} 次</span>
                        </div>
                        <div className="text-xs text-danger-600 mt-1">
                          涉及记录ID：{dup.recordIds.join('、')}
                        </div>
                      </div>
                    ))}

                    {item.key === 'communityNameIssue' && result?.communityNameIssue.map((issue, idx) => (
                      <div key={idx} className="p-3 bg-warning-50 border border-warning-100 rounded text-sm">
                        <div className="font-medium text-warning-800">
                          {issue.newName} ↔ {issue.oldName}
                        </div>
                        <div className="text-xs text-warning-600 mt-1">
                          红线图编号：{issue.redLineNo}，置信度：{Math.round(issue.confidence * 100)}%
                        </div>
                        <Link
                          to={`/record/${issue.recordId}`}
                          className="inline-flex items-center gap-1 text-warning-700 hover:text-warning-800 text-xs font-medium mt-2"
                        >
                          <Eye className="w-3 h-3" />
                          前往复核
                        </Link>
                      </div>
                    ))}

                    {item.key === 'recalcConsistency' && result?.recalcConsistency.map((item, idx) => (
                      <div key={idx} className="p-3 bg-municipal-50 border border-municipal-100 rounded text-sm">
                        <div className="font-medium text-municipal-800">
                          {item.redLineNo} - {item.field}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                          <div>
                            <span className="text-slate-500">重算前：</span>
                            <span className="text-slate-700">{item.beforeValue}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">重算后：</span>
                            <span className="text-slate-700">{item.afterValue}</span>
                          </div>
                        </div>
                        <Link
                          to={`/record/${item.recordId}`}
                          className="inline-flex items-center gap-1 text-municipal-700 hover:text-municipal-800 text-xs font-medium mt-2"
                        >
                          <Eye className="w-3 h-3" />
                          查看详情
                        </Link>
                      </div>
                    ))}

                    {item.key === 'exportConsistency' && result?.exportConsistency.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3 border rounded text-sm ${
                          item.isConsistent
                            ? 'bg-success-50 border-success-100'
                            : 'bg-danger-50 border-danger-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-medium ${
                              item.isConsistent ? 'text-success-800' : 'text-danger-800'
                            }`}
                          >
                            {item.field}
                          </span>
                          <span
                            className={`text-xs ${
                              item.isConsistent ? 'text-success-600' : 'text-danger-600'
                            }`}
                          >
                            {item.isConsistent ? '一致' : '不一致'}
                          </span>
                        </div>
                        {!item.isConsistent && (
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div>
                              <div className="text-slate-500">页面</div>
                              <div className="text-slate-700 font-mono">{item.pageValue}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">接口</div>
                              <div className="text-slate-700 font-mono">{item.apiValue}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">导出</div>
                              <div className="text-slate-700 font-mono">{item.exportValue}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {data.length === 0 && item.key !== 'exportConsistency' && (
                      <div className="text-center py-4 text-slate-400 text-sm">未检测到异常</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
