import React, { useEffect } from 'react';
import { Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ProcessStepper } from '../components/ProcessStepper';
import { RecordCard } from '../components/RecordCard';
import { ActionBar } from '../components/ActionBar';
import { Legend } from '../components/Legend';

export default function Home() {
  const { records, processState, error, setActiveRecord, initDemo } = useAppStore();

  useEffect(() => {
    initDemo();
  }, [initDemo]);

  const activeRecordId = processState.activeRecordId;

  const handleToggleRecord = (id: string) => {
    setActiveRecord(activeRecordId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-industrial-bg">
      <header className="border-b border-industrial-border bg-industrial-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-600/30">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-industrial-text">
                  充电站车流排队模拟
                </h1>
                <p className="text-xs text-industrial-muted">
                  巡检照片编号 × CAD图层名 · 协同流程演示系统
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-sm">
              <span className="px-3 py-1 rounded-full bg-primary-600/20 text-primary-300">
                培训演示版
              </span>
              <span className="text-industrial-muted">v1.0.0</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="bg-gradient-to-r from-primary-900/50 to-primary-600/20 rounded-xl p-5 border border-primary-600/30">
            <h2 className="text-lg font-semibold text-industrial-text mb-2">
              🎯 培训目标
            </h2>
            <p className="text-industrial-muted text-sm leading-relaxed">
              本演示系统展示巡检照片编号与CAD图层名的数据协同处理流程。
              三条样例记录分别代表：<span className="text-status-normal font-medium">顺利记录</span>、
              <span className="text-status-pending font-medium">补录未重算（待复核）</span>、
              <span className="text-status-oldCaliber font-medium">旧口径回填</span>三种典型场景。
              每一步操作都有完整的证据链记录，确保数据变更可追溯。
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-300">
            <p className="font-medium">操作出错：</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <ProcessStepper processState={processState} />

        <Legend />

        <div id="simulation-board">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {records.map((record, index) => (
              <RecordCard
                key={record.id}
                record={record}
                isActive={activeRecordId === record.id}
                onToggle={() => handleToggleRecord(record.id)}
                delay={index * 100}
              />
            ))}
          </div>
        </div>

        <ActionBar />

        <div className="mt-6 p-4 bg-industrial-card rounded-xl">
          <h3 className="text-sm font-semibold text-industrial-text mb-3">
            📋 流程关键约束
          </h3>
          <ul className="text-sm text-industrial-muted space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-status-pending">1.</span>
              <span><strong>待复核不归正常：</strong>REC-002 补录CAD后仍保持"待复核"状态，需客户确认</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400">2.</span>
              <span><strong>CAD图层名同步：</strong>补录后所有显示和导出自动使用最新名称</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-oldCaliber">3.</span>
              <span><strong>旧口径自动识别：</strong>CAD图层名含"-OLD"时自动触发2023版旧口径重算</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-normal">4.</span>
              <span><strong>证据链完整：</strong>每步操作记录操作人、时间、变更前后值，可追溯</span>
            </li>
          </ul>
        </div>
      </main>

      <footer className="border-t border-industrial-border mt-8">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-industrial-muted">
            <p>© 2026 充电站车流排队模拟系统 · 培训演示版</p>
            <p>操作人：培训教官老梁 · 技术支持：流程可视化团队</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
