import { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, Clock, Code, FileDiff, AlertTriangle, Shield, CheckSquare } from 'lucide-react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent, CardFooter } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { RiskBadge } from '../components/RiskBadge';
import { Button } from '../components/Button';
import type { RegressionCase, AuditReport } from '../types';

interface RunResult {
  passed: boolean;
  result: AuditReport;
  diff: any;
}

const caseTypeLabels: Record<string, string> = {
  expired_license: '授权过期检测',
  channel_out_of_scope: '渠道超范围检测',
  font_renamed: '同字体改名识别',
  missing_info: '待补资料标记'
};

const caseTypeIcons: Record<string, any> = {
  expired_license: Clock,
  channel_out_of_scope: Shield,
  font_renamed: FileDiff,
  missing_info: CheckSquare
};

export default function Regression() {
  const { regressionCases, loadRegressionCases, runRegressionCase, loading } = useStore();
  const [runningCase, setRunningCase] = useState<string | null>(null);
  const [runResults, setRunResults] = useState<Record<string, RunResult>>({});

  useEffect(() => {
    loadRegressionCases();
  }, [loadRegressionCases]);

  const handleRun = async (caseId: string) => {
    setRunningCase(caseId);
    try {
      const result = await runRegressionCase(caseId);
      setRunResults(prev => ({ ...prev, [caseId]: result }));
    } finally {
      setRunningCase(null);
    }
  };

  const renderJson = (data: any) => (
    <pre className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto font-mono border border-slate-700/50">
      {JSON.stringify(data, null, 2)}
    </pre>
  );

  const renderDiff = (diff: any) => {
    if (!diff || Object.keys(diff).length === 0) {
      return (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          无差异，与预期结果完全一致
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {Object.entries(diff).map(([key, value]: [string, any]) => (
          <div key={key} className="flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-slate-400">{key}:</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-red-400">预期: {value.expected}</span>
                <span className="text-slate-500">→</span>
                <span className="text-green-400">实际: {value.actual}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const RegressionCard = ({ testCase }: { testCase: RegressionCase }) => {
    const Icon = caseTypeIcons[testCase.type] || AlertTriangle;
    const isRunning = runningCase === testCase.id;
    const result = runResults[testCase.id];
    const displayResult = result || {
      passed: testCase.lastRunResult === 'passed',
      result: null,
      diff: null
    };

    return (
      <Card hover className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                <Icon className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{testCase.name}</h3>
                <p className="text-sm text-slate-400">{caseTypeLabels[testCase.type]}</p>
              </div>
            </div>
            <StatusBadge status={testCase.status} size="sm" />
          </div>
          <p className="text-sm text-slate-400 mt-3">{testCase.description}</p>
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-300 mb-2">
              <Code className="w-4 h-4 text-cyan-400" />
              测试数据
            </div>
            {renderJson(testCase.testData)}
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm text-slate-300 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              预期结果
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-sm text-slate-300 border border-slate-700/50">
              {testCase.expectedResult}
            </div>
          </div>

          {(result || testCase.lastRunDate) && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    {displayResult.passed ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    {displayResult.passed ? '运行通过' : '运行失败'}
                  </div>
                  <span className="text-xs text-slate-500">
                    {result ? result.result.createDate : testCase.lastRunDate}
                  </span>
                </div>
                {result && result.result && (
                  <div className="mb-3">
                    <RiskBadge level={result.result.overallRisk} size="sm" />
                    <span className="text-xs text-slate-500 ml-2">
                      发现 {result.result.risks.length} 个风险
                    </span>
                  </div>
                )}
              </div>

              {result && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                    <FileDiff className="w-4 h-4 text-orange-400" />
                    差异对比
                  </div>
                  {renderDiff(result.diff)}
                </div>
              )}
            </>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {testCase.lastRunDate ? (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                上次运行: {testCase.lastRunDate}
              </span>
            ) : (
              '未运行过'
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={isRunning}
            onClick={() => handleRun(testCase.id)}
          >
            {isRunning ? (
              '运行中...'
            ) : (
              <>
                <Play className="w-4 h-4" />
                运行测试
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0F2B4A' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">回归验证</h1>
          <p className="text-slate-400">运行回归测试样例，验证系统核心功能的正确性</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {regressionCases.map((testCase: RegressionCase) => (
            <RegressionCard key={testCase.id} testCase={testCase} />
          ))}
        </div>

        {regressionCases.length === 0 && !loading.regressionCases && (
          <Card>
            <CardContent className="py-16 text-center text-slate-400">
              <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无回归测试样例</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
