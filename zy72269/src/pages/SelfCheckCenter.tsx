import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  Database,
  Download
} from 'lucide-react';
import { useAppStore } from '@/store';
import {
  runAllChecks,
  checkDuplicateImport,
  checkZAxisDirection,
  runRecalculation,
  checkExportConsistency,
  getCheckTypeLabel,
  getCheckResultLabel,
  hasCriticalFailures
} from '@/services/selfCheckService';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SelfCheckItem from '@/components/features/SelfCheckItem';
import type { SelfCheckReport, CheckType, SelfCheckOptions } from '@/types';

export default function SelfCheckCenter() {
  const currentTask = useAppStore((state) => state.getCurrentTask());
  const addSelfCheckReport = useAppStore((state) => state.addSelfCheckReport);
  const setIsLoading = useAppStore((state) => state.setIsLoading);
  const isLoading = useAppStore((state) => state.isLoading);

  const [runningCheck, setRunningCheck] = useState<CheckType | 'all' | null>(null);

  const checkTypes: CheckType[] = ['duplicate_import', 'z_axis_check', 'recalculation', 'export_consistency'];

  if (!currentTask) {
    return (
      <div className="space-y-6">
        <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">自检中心</h1>
        <Card className="text-center py-12">
          <ClipboardCheck size={64} className="mx-auto text-primary-500 mb-4" />
          <p className="text-primary-300 mb-6">请先选择或创建一个巡检任务</p>
          <Link to="/">
            <Button variant="primary">返回首页</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const getLatestReport = (checkType: CheckType): SelfCheckReport | undefined => {
    const reports = currentTask.selfCheckReports
      .filter(r => r.checkType === checkType)
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
    return reports[0];
  };

  const handleRunCheck = async (checkType: CheckType) => {
    if (!currentTask) return;

    setRunningCheck(checkType);
    setIsLoading(true);

    try {
      let report: SelfCheckReport;

      switch (checkType) {
        case 'duplicate_import':
          report = await checkDuplicateImport(currentTask);
          break;
        case 'z_axis_check':
          report = await checkZAxisDirection(currentTask);
          break;
        case 'recalculation':
          report = await runRecalculation(currentTask);
          break;
        case 'export_consistency':
          report = await checkExportConsistency(currentTask);
          break;
      }

      addSelfCheckReport(currentTask.id, report);
    } finally {
      setRunningCheck(null);
      setIsLoading(false);
    }
  };

  const handleRunAllChecks = async () => {
    if (!currentTask) return;

    setRunningCheck('all');
    setIsLoading(true);

    try {
      const options: SelfCheckOptions = {
        checkDuplicateImport: true,
        checkZAxis: true,
        runRecalculation: true,
        checkExportConsistency: true
      };

      const reports = await runAllChecks(currentTask, options);
      reports.forEach(r => addSelfCheckReport(currentTask.id, r));
    } finally {
      setRunningCheck(null);
      setIsLoading(false);
    }
  };

  const latestReports = checkTypes.map(type => getLatestReport(type)).filter(Boolean) as SelfCheckReport[];
  const passCount = latestReports.filter(r => r.result === 'pass').length;
  const warningCount = latestReports.filter(r => r.result === 'warning').length;
  const failCount = latestReports.filter(r => r.result === 'fail').length;
  const hasFailures = hasCriticalFailures(latestReports);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">自检中心</h1>
          <p className="font-mono text-sm text-primary-400 mt-1">
            四大必检项：重复导入、Z轴方向、补录重算、导出一致
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="default">
            {currentTask.taskNo} - {currentTask.projectName}
          </Badge>
          <Button
            variant="primary"
            onClick={handleRunAllChecks}
            disabled={isLoading || currentTask.marks.length === 0}
          >
            <Play size={16} className="mr-2" />
            {runningCheck === 'all' ? '执行中...' : '一键执行所有自检'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">自检项总数</p>
          <p className="font-mono text-3xl font-bold text-primary-200">{checkTypes.length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">通过</p>
          <p className="font-mono text-3xl font-bold text-accent-success">{passCount}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">警告</p>
          <p className={`font-mono text-3xl font-bold ${warningCount > 0 ? 'text-accent-warning' : 'text-primary-500'}`}>
            {warningCount}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">未通过</p>
          <p className={`font-mono text-3xl font-bold ${failCount > 0 ? 'text-accent-warning animate-pulse' : 'text-primary-500'}`}>
            {failCount}
          </p>
        </Card>
      </div>

      <div className={`p-4 mb-6 border-2 ${
        hasFailures ? 'bg-accent-warning/10 border-accent-warning/50' :
        warningCount > 0 ? 'bg-accent-warning/5 border-accent-warning/30' :
        'bg-accent-success/10 border-accent-success/30'
      }`}>
        <div className="flex items-center gap-3">
          {hasFailures ? (
            <AlertTriangle className="text-accent-warning" size={24} />
          ) : latestReports.length === checkTypes.length ? (
            <CheckCircle2 className="text-accent-success" size={24} />
          ) : (
            <ClipboardCheck className="text-primary-400" size={24} />
          )}
          <div>
            <p className={`font-mono text-sm font-semibold ${
              hasFailures ? 'text-accent-warning' :
              warningCount > 0 ? 'text-accent-warning' :
              'text-accent-success'
            }`}>
              {hasFailures
                ? '存在未通过的自检项，请处理后再导出报告'
                : latestReports.length === checkTypes.length
                  ? passCount === checkTypes.length
                    ? '所有自检项已通过，可以导出报告'
                    : '存在警告项，建议确认后再导出报告'
                  : '请执行所有自检项'
              }
            </p>
            {latestReports.length > 0 && (
              <p className="text-xs text-primary-400 mt-1">
                最新自检执行于 {new Date(Math.max(...latestReports.map(r => new Date(r.executedAt).getTime()))).toLocaleString('zh-CN')}
              </p>
            )}
          </div>
        </div>
      </div>

      <Card title="自检项说明" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {checkTypes.map(type => (
            <div key={type} className="bg-primary-800/30 p-4 border border-primary-700">
              <h5 className="font-mono text-sm font-semibold text-primary-200 mb-2">
                {getCheckTypeLabel(type)}
              </h5>
              <p className="text-sm text-primary-400">
                {{
                  duplicate_import: '检测是否存在重复导入的记录，比较坐标精度到小数点后4位',
                  z_axis_check: '检测Z轴方向是否按旧习惯(向下为正)写反，新标准向上为正',
                  recalculation: '补录材料导入后自动重新计算路径总长和障碍物统计',
                  export_consistency: '验证导出数据与系统内数据的一致性，确保报告准确'
                }[type]}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {currentTask.marks.length === 0 ? (
        <Card className="text-center py-12">
          <Database size={64} className="mx-auto text-primary-500 mb-4" />
          <p className="text-primary-300 mb-2">暂无巡检数据</p>
          <p className="text-sm text-primary-400 mb-6">请先导入巡检标记后再执行自检</p>
          <Link to="/import">
            <Button variant="primary">前往导入</Button>
          </Link>
        </Card>
      ) : (
        <div>
          {checkTypes.map(type => (
            <SelfCheckItem
              key={type}
              checkType={type}
              report={getLatestReport(type)}
              onRun={() => handleRunCheck(type)}
              isRunning={runningCheck === type}
            />
          ))}
        </div>
      )}

      {latestReports.length > 0 && (
        <Card title="历史自检记录">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-header">检查项</th>
                  <th className="table-header">结果</th>
                  <th className="table-header">详情</th>
                  <th className="table-header">执行时间</th>
                </tr>
              </thead>
              <tbody>
                {[...currentTask.selfCheckReports]
                  .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
                  .slice(0, 20)
                  .map(report => (
                    <tr key={report.id} className="hover:bg-primary-800/30 transition-colors">
                      <td className="table-cell font-mono text-sm">
                        {getCheckTypeLabel(report.checkType)}
                      </td>
                      <td className="table-cell">
                        <Badge variant={
                          report.result === 'pass' ? 'success' : 'warning'
                        }>
                          {getCheckResultLabel(report.result)}
                        </Badge>
                      </td>
                      <td className="table-cell text-sm text-primary-300 max-w-md truncate">
                        {report.details}
                      </td>
                      <td className="table-cell font-mono text-xs text-primary-400">
                        {new Date(report.executedAt).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {latestReports.length === checkTypes.length && !hasFailures && (
        <div className="flex justify-end mt-6">
          <Link to="/report">
            <Button variant="primary">
              <Download size={16} className="mr-2" />
              生成巡检报告 <ArrowRight size={16} className="ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
