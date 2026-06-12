import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { selfCheckApi, materialApi } from '../utils/api';
import SelfCheckCard from '../components/SelfCheckCard';
import WaveformLoader from '../components/WaveformLoader';
import type { SelfCheckResult } from '../types';

export default function SelfCheckPage() {
  const { selfCheckResults, setSelfCheckResults, setLoading, loading, showNotification, setMaterials } = useStore();
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (selfCheckResults.length === 0) {
      runAllChecks();
    }
  }, []);

  const runAllChecks = async () => {
    setIsRunning(true);
    setLoading('selfcheck-all', true);
    try {
      const results = await selfCheckApi.runAll();
      setSelfCheckResults(results);
      const passedCount = results.filter(r => r.passed).length;
      showNotification(
        passedCount === 4 ? 'success' : 'warning',
        `自检完成: ${passedCount}/4 项通过`
      );
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setIsRunning(false);
      setLoading('selfcheck-all', false);
    }
  };

  const runSingleCheck = async (type: 'duplicate' | 'rework' | 'recalculate' | 'export') => {
    setLoading(`selfcheck-${type}`, true);
    try {
      const result = await selfCheckApi.check(type);
      setSelfCheckResults(prev => prev.map(r => 
        r.check_type === type ? result : r
      ));
      showNotification(
        result.passed ? 'success' : 'warning',
        result.passed ? '检测通过' : `发现 ${result.issue_count} 个问题`
      );
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading(`selfcheck-${type}`, false);
    }
  };

  const handleFix = async (type: 'duplicate' | 'rework' | 'recalculate' | 'export') => {
    setLoading(`fix-${type}`, true);
    try {
      if (type === 'rework') {
        const materials = await materialApi.getAll();
        for (const m of materials) {
          for (const t of m.tracks) {
            if (t.need_recheck && !t.rework_confirmed) {
              await materialApi.confirmRework(t.id, '版权运营');
            }
          }
        }
      }
      if (type === 'recalculate') {
        const materials = await materialApi.getAll();
        for (const m of materials) {
          await materialApi.recalculate(m.id, '版权运营');
        }
      }
      await runSingleCheck(type);
      const allMaterials = await materialApi.getAll();
      setMaterials(allMaterials);
      showNotification('success', '一键修复完成');
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading(`fix-${type}`, false);
    }
  };

  const passedCount = selfCheckResults.filter(r => r.passed).length;
  const totalCount = 4;

  const typeLabels: Record<string, string> = {
    duplicate: '重复导入检测',
    rework: '返工原因检测',
    recalculate: '补录重算检测',
    export: '导出一致性检测',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display text-studio-gold mb-2">四项自检</h2>
          <p className="text-studio-silver text-sm">系统完整性检测：重复导入、返工原因、补录重算、导出一致性</p>
        </div>
        <button
          onClick={runAllChecks}
          disabled={isRunning}
          className="btn-studio"
        >
          {isRunning ? '🔍 检测中...' : '🔄 运行全部检测'}
        </button>
      </div>

      <div className="divider-wave" />

      <div className="card-studio p-6 card-glow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-display text-white">自检概览</h3>
            <p className="text-sm text-studio-silver font-mono mt-1">
              {passedCount}/{totalCount} 项检测通过
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-studio-gray"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(passedCount / totalCount) * 251.2} 251.2`}
                  className={passedCount === totalCount ? 'text-status-new' : 'text-studio-gold'}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-display text-white">
                  {Math.round((passedCount / totalCount) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {['duplicate', 'rework', 'recalculate', 'export'].map((type) => {
            const result = selfCheckResults.find(r => r.check_type === type);
            return (
              <div
                key={type}
                className={`p-4 rounded-lg border-2 transition-all ${
                  result
                    ? result.passed
                      ? 'bg-status-new/10 border-status-new/30'
                      : 'bg-studio-red/10 border-studio-red/30'
                    : 'bg-studio-darker border-studio-gray'
                }`}
              >
                <p className="text-sm font-medium text-white mb-1">{typeLabels[type]}</p>
                <p className="text-xs text-studio-silver">
                  {result
                    ? result.passed
                      ? `通过 (${result.issue_count} 个问题)`
                      : `发现 ${result.issue_count} 个问题`
                    : '未检测'}
                </p>
                <div className="mt-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    result
                      ? result.passed ? 'bg-status-new' : 'bg-studio-red'
                      : 'bg-studio-gray'
                  }`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isRunning || loading['selfcheck-all'] ? (
        <WaveformLoader text="正在执行四项自检，请稍候..." />
      ) : (
        <div className="space-y-4">
          {selfCheckResults.map((result) => (
            <SelfCheckCard
              key={result.check_type}
              result={result}
              onFix={() => handleFix(result.check_type as any)}
            />
          ))}
        </div>
      )}

      <div className="card-studio p-5">
        <h3 className="text-lg font-display text-white mb-3">📋 自检说明</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-studio-darker rounded-lg p-4">
            <p className="text-studio-gold font-mono mb-2">1. 重复导入检测</p>
            <p className="text-studio-silver">检查是否存在重复导入的素材记录。检测维度：名称+ISRC+授权起始日期。同一素材多次导入应标记为复用而非重复创建。</p>
          </div>
          <div className="bg-studio-darker rounded-lg p-4">
            <p className="text-studio-gold font-mono mb-2">2. 返工原因检测</p>
            <p className="text-studio-silver">扫描所有轨道备注中是否包含返工、补录、重新录制等关键词。含有关键词的轨道应被标记为"待复核"状态，等待版权运营确认。</p>
          </div>
          <div className="bg-studio-darker rounded-lg p-4">
            <p className="text-studio-gold font-mono mb-2">3. 补录重算检测</p>
            <p className="text-studio-silver">检查补录后的重算操作是否正确执行。补录后应触发同步更新：轨道备注、排练变更记录、历史记录三处数据保持一致。</p>
          </div>
          <div className="bg-studio-darker rounded-lg p-4">
            <p className="text-studio-gold font-mono mb-2">4. 导出一致性检测</p>
            <p className="text-studio-silver">检查导出数据与数据库数据的一致性。导出的Excel和PDF报告应与系统中的最新数据完全一致，无遗漏或错误。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
