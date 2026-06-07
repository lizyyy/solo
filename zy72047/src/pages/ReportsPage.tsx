import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Copy,
  Download,
  Check,
  ChevronDown,
  Search,
  User,
  Music,
  Zap,
  Heart,
  AlertTriangle,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { useHistoryStore } from '@/store/useHistoryStore';
import { ReportGenerator } from '@/engine/ReportGenerator';
import { cn } from '@/lib/utils';
import type { GameRound } from '@/types/game';

export default function ReportsPage() {
  const { rounds, loadAllData, getRoundWithData } = useHistoryStore();

  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [roundDropdownOpen, setRoundDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportContent, setReportContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const filteredRounds = useMemo(() => {
    if (!searchTerm) return rounds;
    const search = searchTerm.toLowerCase();
    return rounds.filter(
      (r: GameRound) =>
        r.playerName.toLowerCase().includes(search) ||
        r.levelName.toLowerCase().includes(search)
    );
  }, [rounds, searchTerm]);

  const selectedRound = useMemo(
    () => rounds.find((r: GameRound) => r.id === selectedRoundId) || null,
    [rounds, selectedRoundId]
  );

  const handleGenerateReport = () => {
    if (!selectedRoundId) return;

    setGenerating(true);
    setTimeout(() => {
      const data = getRoundWithData(selectedRoundId);
      if (data.round) {
        const generator = new ReportGenerator(
          data.round,
          data.operations,
          data.notes,
          data.conflicts
        );
        const content = generator.exportAs('markdown');
        setReportContent(content);
      }
      setGenerating(false);
    }, 500);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(reportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!selectedRoundId) return;

    const data = getRoundWithData(selectedRoundId);
    if (data.round) {
      const generator = new ReportGenerator(
        data.round,
        data.operations,
        data.notes,
        data.conflicts
      );
      const filename = `${data.round.playerName}-${data.round.levelName}-${new Date().toISOString().split('T')[0]}`;
      generator.download(filename, 'markdown');
    }
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-500/20';
      case 'active':
        return 'text-blue-400 bg-blue-500/20';
      case 'paused':
        return 'text-yellow-400 bg-yellow-500/20';
      default:
        return 'text-vinyl-400 bg-vinyl-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'active':
        return '进行中';
      case 'paused':
        return '已暂停';
      default:
        return status;
    }
  };

  const renderMarkdownPreview = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];

    lines.forEach((line, index) => {
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (!inCodeBlock && codeContent.length > 0) {
          elements.push(
            <pre key={`code-${index}`} className="bg-vinyl-900/80 p-4 rounded-lg overflow-x-auto text-sm text-vinyl-300 my-2">
              <code>{codeContent.join('\n')}</code>
            </pre>
          );
          codeContent = [];
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="text-2xl font-bold text-gold-500 mt-6 mb-3 pb-2 border-b border-gold-500/30">
            {line.slice(2)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-xl font-bold text-vinyl-100 mt-5 mb-3">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-lg font-semibold text-vinyl-200 mt-4 mb-2">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith('---')) {
        elements.push(<hr key={index} className="my-6 border-vinyl-700" />);
      } else if (line.startsWith('- **')) {
        const match = line.match(/- \*\*(.+?)\*\*(?:\s*:\s*)?(.+)?/);
        if (match) {
          elements.push(
            <div key={index} className="flex gap-2 my-1.5 ml-2">
              <span className="text-gold-500">•</span>
              <span className="font-semibold text-vinyl-200">{match[1]}:</span>
              {match[2] && <span className="text-vinyl-300">{match[2]}</span>}
            </div>
          );
        }
      } else if (line.startsWith('- ')) {
        elements.push(
          <div key={index} className="flex gap-2 my-1.5 ml-4">
            <span className="text-vinyl-500">•</span>
            <span className="text-vinyl-300">{line.slice(2)}</span>
          </div>
        );
      } else if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={index} className="border-l-4 border-gold-500 pl-4 py-2 my-3 text-vinyl-400 bg-gold-500/5 rounded-r">
            {line.slice(2)}
          </blockquote>
        );
      } else if (line.startsWith('| ')) {
        elements.push(
          <div key={index} className="text-vinyl-300 font-mono text-sm bg-vinyl-900/50 px-3 py-1 my-1 rounded">
            {line}
          </div>
        );
      } else if (line.trim() === '') {
        elements.push(<div key={index} className="h-2" />);
      } else {
        let processedLine = line
          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-vinyl-100">$1</strong>')
          .replace(/`(.+?)`/g, '<code class="bg-vinyl-700 px-1.5 py-0.5 rounded text-gold-400 text-sm">$1</code>');
        
        elements.push(
          <p key={index} className="text-vinyl-300 my-1.5" dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      }
    });

    return elements;
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <FileText className="text-gold-500" size={40} />
            <div>
              <h1 className="text-3xl font-bold text-gold-500">报告生成</h1>
              <p className="text-vinyl-400">生成交接报告（Markdown格式，同事风格）</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5 space-y-6">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 p-5"
            >
              <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
                <User size={18} />
                选择比赛局
              </h2>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-vinyl-500" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索玩家或关卡..."
                  className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg pl-10 pr-4 py-2.5 text-vinyl-100 focus:border-gold-500 focus:outline-none"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setRoundDropdownOpen(!roundDropdownOpen)}
                  className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-3 text-left flex items-center justify-between text-vinyl-100 hover:border-gold-500/50 transition-colors"
                >
                  <span>
                    {selectedRound
                      ? `${selectedRound.playerName} - ${selectedRound.levelName}`
                      : '请选择比赛局'}
                  </span>
                  <ChevronDown
                    size={18}
                    className={cn('transition-transform', roundDropdownOpen && 'rotate-180')}
                  />
                </button>

                <AnimatePresence>
                  {roundDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-vinyl-700 border border-vinyl-600 rounded-lg overflow-hidden z-40 shadow-xl max-h-80 overflow-y-auto"
                    >
                      {filteredRounds.length === 0 ? (
                        <div className="p-4 text-center text-vinyl-500">无匹配结果</div>
                      ) : (
                        filteredRounds.map((round: GameRound) => (
                          <button
                            key={round.id}
                            onClick={() => {
                              setSelectedRoundId(round.id);
                              setRoundDropdownOpen(false);
                              setReportContent('');
                            }}
                            className={cn(
                              'w-full px-4 py-3 text-left hover:bg-vinyl-600 transition-colors border-b border-vinyl-600 last:border-b-0',
                              selectedRoundId === round.id
                                ? 'bg-gold-500/20 text-gold-400'
                                : 'text-vinyl-200'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{round.playerName}</span>
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded text-xs',
                                  getStatusColor(round.status)
                                )}
                              >
                                {getStatusLabel(round.status)}
                              </span>
                            </div>
                            <div className="text-sm text-vinyl-400 mt-1">{round.levelName}</div>
                            <div className="flex gap-3 mt-1 text-xs text-vinyl-500">
                              <span>分数: {round.finalScore}/{round.targetScore}</span>
                              <span>资源: {round.finalResources}</span>
                              <span>{formatDateTime(round.startTime)}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {selectedRound && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4"
                >
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-vinyl-900/50 rounded-lg p-3 text-center">
                      <Zap className="mx-auto text-yellow-400 mb-1" size={18} />
                      <div className="text-lg font-bold text-yellow-400">
                        {selectedRound.finalResources}
                      </div>
                      <div className="text-xs text-vinyl-500">最终资源</div>
                    </div>
                    <div className="bg-vinyl-900/50 rounded-lg p-3 text-center">
                      <Heart className="mx-auto text-pink-400 mb-1" size={18} />
                      <div className="text-lg font-bold text-pink-400">
                        {selectedRound.finalScore}
                      </div>
                      <div className="text-xs text-vinyl-500">最终分数</div>
                    </div>
                    <div className="bg-vinyl-900/50 rounded-lg p-3 text-center">
                      <AlertTriangle className="mx-auto text-orange-400 mb-1" size={18} />
                      <div className="text-lg font-bold text-orange-400">
                        {selectedRound.finalRisk}
                      </div>
                      <div className="text-xs text-vinyl-500">最终风险</div>
                    </div>
                  </div>

                  <div className="bg-vinyl-900/50 rounded-lg p-3 text-sm text-vinyl-400 space-y-1 mb-4">
                    <div className="flex justify-between">
                      <span>开始时间</span>
                      <span className="text-vinyl-200">{formatDateTime(selectedRound.startTime)}</span>
                    </div>
                    {selectedRound.endTime && (
                      <div className="flex justify-between">
                        <span>结束时间</span>
                        <span className="text-vinyl-200">{formatDateTime(selectedRound.endTime)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>操作人</span>
                      <span className="text-vinyl-200">{selectedRound.operator}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateReport}
                    disabled={generating}
                    className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-vinyl-900 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:from-gold-400 hover:to-gold-500 transition-all disabled:opacity-50 shadow-lg shadow-gold-500/20"
                  >
                    {generating ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Clock size={20} />
                        </motion.div>
                        生成中...
                      </>
                    ) : (
                      <>
                        <FileText size={20} />
                        生成交接报告
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </motion.div>

            {reportContent && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 p-5 space-y-3"
              >
                <h3 className="text-lg font-semibold text-vinyl-200">导出选项</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleCopy}
                    className={cn(
                      'py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all',
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-vinyl-700 text-vinyl-200 hover:bg-vinyl-600'
                    )}
                  >
                    {copied ? (
                      <>
                        <Check size={18} />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        复制内容
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="bg-vinyl-700 text-vinyl-200 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-vinyl-600 transition-colors"
                  >
                    <Download size={18} />
                    下载文件
                  </button>
                </div>

                <div className="pt-3 border-t border-vinyl-700">
                  <div className="flex items-center gap-2 text-sm text-vinyl-400">
                    <MessageSquare size={14} />
                    <span>报告采用同事交流风格，语气自然亲切，便于交接理解</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="col-span-7">
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 h-[calc(100vh-12rem)] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-vinyl-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gold-400 flex items-center gap-2">
                  <FileText size={18} />
                  报告预览
                </h2>
                {reportContent && (
                  <div className="flex items-center gap-2 text-sm text-vinyl-500">
                    <CheckCircle className="text-green-400" size={14} />
                    <span>已生成</span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {!reportContent ? (
                  <div className="h-full flex flex-col items-center justify-center text-vinyl-500">
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <FileText size={64} className="mb-4 opacity-50" />
                    </motion.div>
                    <p className="text-lg mb-2">选择比赛局并生成报告</p>
                    <p className="text-sm">生成的报告将以 Markdown 格式显示在这里</p>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="max-w-none prose prose-invert prose-headings:text-gold-500 prose-strong:text-vinyl-100 prose-code:text-gold-400 prose-blockquote:border-gold-500"
                  >
                    {renderMarkdownPreview(reportContent)}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
