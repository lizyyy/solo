import React, { useState, useEffect } from 'react';
import { FileText, Download, Copy, Check, Calendar, Clock, Hash, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { usePowerBudgetStore } from '../store/usePowerBudgetStore';
import { downloadBriefing, copyToClipboard } from '../utils/briefingGenerator';
import { BriefingResult } from '../utils/briefingGenerator';
import { formatTimeWithSystem } from '../utils/timeConverter';

interface BriefingHistory {
  date: string;
  hash: string;
  generatedAt: string;
  timeSystem: string;
}

export const BriefingPage: React.FC = () => {
  const { currentDate, setCurrentDate, displayTimeSystem, generateBriefing, viewMode, snapshots } = usePowerBudgetStore();
  const [briefingResult, setBriefingResult] = useState<BriefingResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [briefingHistory, setBriefingHistory] = useState<BriefingHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<BriefingHistory | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('briefing-history');
    if (stored) {
      try {
        setBriefingHistory(JSON.parse(stored));
      } catch {
        setBriefingHistory([]);
      }
    }
  }, []);

  const saveToHistory = (result: BriefingResult, date: string) => {
    const historyItem: BriefingHistory = {
      date,
      hash: result.hash,
      generatedAt: new Date().toISOString(),
      timeSystem: displayTimeSystem
    };
    
    const newHistory = [historyItem, ...briefingHistory].slice(0, 20);
    setBriefingHistory(newHistory);
    localStorage.setItem('briefing-history', JSON.stringify(newHistory));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setBriefingResult(null);
    setSelectedHistory(null);
    
    try {
      const result = await generateBriefing(currentDate);
      if (result) {
        setBriefingResult(result);
        saveToHistory(result, currentDate);
      }
    } catch (error) {
      console.error('生成简报失败:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!briefingResult) return;
    downloadBriefing(briefingResult.content, currentDate, briefingResult.hash);
  };

  const handleCopy = async () => {
    if (!briefingResult) return;
    const success = await copyToClipboard(briefingResult.content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLoadHistory = async (item: BriefingHistory) => {
    setCurrentDate(item.date);
    setSelectedHistory(item);
    setIsGenerating(true);
    setBriefingResult(null);
    
    try {
      const result = await generateBriefing(item.date);
      if (result) {
        setBriefingResult(result);
      }
    } catch (error) {
      console.error('加载历史简报失败:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const verifyHash = () => {
    if (!briefingResult || !selectedHistory) return true;
    return briefingResult.hash === selectedHistory.hash;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">任务简报</h1>
          <p className="text-sm text-console-muted">生成交接班简报，确保下一班无需翻聊天记录</p>
        </div>
        {viewMode === 'snapshot' && (
          <div className="px-3 py-1.5 bg-eng-yellow/20 border border-eng-yellow/30 rounded text-xs text-eng-yellow flex items-center gap-2">
            <Clock className="w-4 h-4" />
            快照模式 - 基于历史快照生成
          </div>
        )}
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="bg-console-panel border border-console-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-console-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-console-muted" />
                  <input
                    type="date"
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                    className="px-3 py-1.5 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none text-sm"
                  />
                </div>
                <div className="text-xs text-console-muted">
                  时间制: <span className="text-eng-blue-light font-mono">{displayTimeSystem}</span>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || viewMode === 'snapshot'}
                className="px-4 py-2 bg-eng-blue text-white rounded hover:bg-eng-blue-light transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isGenerating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {isGenerating ? '生成中...' : '生成简报'}
              </button>
            </div>

            {briefingResult && (
              <div className="p-4 border-b border-console-border bg-console-bg/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-eng-green" />
                      <span className="text-xs text-console-muted">数据哈希:</span>
                      <span className="font-mono text-xs text-eng-green-light">{briefingResult.hash}</span>
                    </div>
                    {selectedHistory && (
                      <div className={`flex items-center gap-2 text-xs ${
                        verifyHash() ? 'text-eng-green-light' : 'text-eng-orange-light'
                      }`}>
                        {verifyHash() ? (
                          <>
                            <Check className="w-4 h-4" />
                            哈希校验通过 - 数据一致
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4" />
                            哈希不一致 - 数据已被修改
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 border border-console-border rounded text-sm hover:bg-console-bg transition-colors flex items-center gap-2"
                    >
                      {copied ? (
                        <><Check className="w-4 h-4 text-eng-green" /> 已复制</>
                      ) : (
                        <><Copy className="w-4 h-4" /> 复制</>
                      )}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1.5 bg-eng-green text-white rounded hover:bg-eng-green-light transition-colors flex items-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      下载 .txt
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4">
              {!briefingResult ? (
                <div className="py-20 text-center">
                  <FileText className="w-12 h-12 text-console-muted mx-auto mb-4 opacity-50" />
                  <p className="text-console-muted mb-2">选择日期后点击"生成简报"</p>
                  <p className="text-xs text-console-muted/70">简报将包含预算汇总、异常清单、修改轨迹和待办事项</p>
                </div>
              ) : (
                <div className="bg-black/30 rounded-lg p-4 overflow-auto max-h-[calc(100vh-400px)]">
                  <pre className="font-mono text-xs text-console-text whitespace-pre leading-relaxed">
                    {briefingResult.content}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {briefingResult && (
            <div className="mt-4 bg-console-panel border border-console-border rounded-lg p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-eng-yellow" />
                使用说明
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-console-muted">
                <div className="flex items-start gap-2">
                  <span className="text-eng-blue-light">1.</span>
                  <span>下载的 .txt 文件可直接用于交接班，无需排版</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-eng-blue-light">2.</span>
                  <span>哈希值用于验证数据完整性，如数据改动哈希会变化</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-eng-blue-light">3.</span>
                  <span>异常部分包含可复核原因，便于追溯争议问题</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-eng-blue-light">4.</span>
                  <span>修改轨迹区分"补材料"和"真修改"，明确责任</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-80">
          <div className="bg-console-panel border border-console-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-console-border">
              <h2 className="font-bold">历史记录</h2>
              <p className="text-xs text-console-muted mt-1">最近 20 条生成记录</p>
            </div>

            <div className="divide-y divide-console-border/50 max-h-[calc(100vh-200px)] overflow-auto">
              {briefingHistory.length === 0 ? (
                <div className="py-12 text-center text-console-muted text-sm">
                  暂无生成记录
                </div>
              ) : (
                briefingHistory.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleLoadHistory(item)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-console-bg/50 ${
                      selectedHistory?.hash === item.hash ? 'bg-eng-blue/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{item.date}</span>
                      <ChevronRight className="w-4 h-4 text-console-muted" />
                    </div>
                    <div className="font-mono text-xs text-eng-green-light mb-1">
                      {item.hash.substring(0, 16)}...
                    </div>
                    <div className="flex items-center justify-between text-xs text-console-muted">
                      <span>{formatTimeWithSystem(new Date(item.generatedAt), displayTimeSystem)}</span>
                      <span className="px-1.5 py-0.5 bg-console-bg rounded">{item.timeSystem}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 bg-console-panel border border-console-border rounded-lg p-4">
            <h3 className="font-bold mb-3 text-sm">校验说明</h3>
            <div className="space-y-2 text-xs text-console-muted">
              <p>• 每次生成简报时会计算数据哈希</p>
              <p>• 点击历史记录可重新生成并对比哈希</p>
              <p>• 哈希一致说明数据未被修改</p>
              <p>• 哈希不一致说明期间数据有变动</p>
              <p className="text-eng-orange-light">• 时间制混用的记录会在异常中给出可复核原因</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
