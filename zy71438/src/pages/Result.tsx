import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, XCircle, Clock, Activity, FileText, Filter, Play, RefreshCw } from 'lucide-react';
import { getAttemptById, getPlayer } from '../utils/storage';
import { Attempt, OperationLog, Evidence } from '../types';
import WaveformCanvas from '../components/WaveformCanvas';
import { LEVELS } from '../data/levels';

const Result: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'evidence'>('timeline');

  React.useEffect(() => {
    if (attemptId) {
      const data = getAttemptById(attemptId);
      setAttempt(data);
    }
  }, [attemptId]);

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center text-cyber-primary">
        加载中...
      </div>
    );
  }

  const level = LEVELS.find(l => l.id === attempt.levelId);
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (start: number, end: number) => {
    const seconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'parameter_change': return <Activity size={16} />;
      case 'oscillator_toggle': return <RefreshCw size={16} />;
      case 'phase_cancellation': return <span className="text-cyber-danger">⚠</span>;
      case 'volume_peak': return <span className="text-cyber-danger">⚠</span>;
      case 'playback': return <Play size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'phase_cancellation':
      case 'volume_peak':
        return 'border-cyber-danger bg-cyber-danger/10';
      case 'parameter_change':
        return 'border-cyber-primary bg-cyber-primary/10';
      case 'oscillator_toggle':
        return 'border-cyber-accent bg-cyber-accent/10';
      case 'playback':
        return 'border-cyber-secondary bg-cyber-secondary/10';
      default:
        return 'border-cyber-muted bg-cyber-muted/10';
    }
  };

  const getEvidenceIcon = (type: string) => {
    switch (type) {
      case 'waveform': return <Activity size={18} />;
      case 'oscillator': return <RefreshCw size={18} />;
      case 'filter': return <Filter size={18} />;
      case 'similarity': return <Trophy size={18} />;
      case 'audition': return <Play size={18} />;
      default: return <FileText size={18} />;
    }
  };

  return (
    <div className="min-h-screen cyber-grid p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyber-muted/30 text-cyber-muted hover:text-cyber-primary hover:border-cyber-primary transition-all"
          >
            <ArrowLeft size={18} />
            <span>返回主页</span>
          </button>
          
          <h1 className="text-2xl font-orbitron font-bold text-cyber-primary">
            闯关结果
          </h1>

          <button
            onClick={() => navigate(`/game/${attempt.levelId}`)}
            className="cyber-btn flex items-center gap-2 px-4 py-2 rounded-lg neon-border bg-cyber-primary/20 text-cyber-primary hover:bg-cyber-primary/30 transition-all"
          >
            <RefreshCw size={18} />
            <span>再次挑战</span>
          </button>
        </div>

        <div className={`p-8 rounded-xl mb-8 text-center ${
          attempt.passed 
            ? 'neon-border bg-cyber-success/10' 
            : 'neon-border-pink bg-cyber-danger/10'
        }`}>
          <div className="flex justify-center mb-4">
            {attempt.passed ? (
              <Trophy className="text-cyber-success" size={64} />
            ) : (
              <XCircle className="text-cyber-danger" size={64} />
            )}
          </div>
          <h2 className={`text-4xl font-orbitron font-bold mb-2 ${
            attempt.passed ? 'text-cyber-success neon-text' : 'text-cyber-danger neon-text'
          }`}>
            {attempt.passed ? '闯关成功！' : '再接再厉！'}
          </h2>
          <div className="text-6xl font-orbitron font-bold text-cyber-primary my-4 neon-text-cyan">
            {attempt.score}%
          </div>
          <div className="flex justify-center gap-8 text-cyber-muted">
            <div className="flex items-center gap-2">
              <Clock size={18} />
              <span>用时: {formatDuration(attempt.startTime, attempt.endTime)}</span>
            </div>
            <div>
              关卡: {level?.name}
            </div>
            <div>
              玩家: {attempt.playerName}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="p-4 rounded-xl neon-border bg-cyber-card/50">
            <h3 className="font-orbitron text-cyber-secondary font-bold mb-4">目标波形</h3>
            {level && (
              <WaveformCanvas
                oscillators={level.targetOscillators}
                height={100}
              />
            )}
          </div>
          <div className="p-4 rounded-xl neon-border bg-cyber-card/50">
            <h3 className="font-orbitron text-cyber-primary font-bold mb-4">你的波形</h3>
            <WaveformCanvas
              oscillators={attempt.oscillators}
              height={100}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl neon-border bg-cyber-card/50 text-center">
            <div className="text-2xl font-orbitron font-bold text-cyber-primary">
              {attempt.similarityBreakdown.waveformMatch}%
            </div>
            <div className="text-xs text-cyber-muted">波形匹配</div>
          </div>
          <div className="p-4 rounded-xl neon-border bg-cyber-card/50 text-center">
            <div className="text-2xl font-orbitron font-bold text-cyber-secondary">
              {attempt.similarityBreakdown.frequencyMatch}%
            </div>
            <div className="text-xs text-cyber-muted">频谱匹配</div>
          </div>
          <div className="p-4 rounded-xl neon-border bg-cyber-card/50 text-center">
            <div className="text-2xl font-orbitron font-bold text-cyber-accent">
              {attempt.similarityBreakdown.harmonicMatch}%
            </div>
            <div className="text-xs text-cyber-muted">谐波匹配</div>
          </div>
          <div className="p-4 rounded-xl neon-border bg-cyber-card/50 text-center">
            <div className="text-2xl font-orbitron font-bold text-cyber-success">
              {attempt.operationLogs.length}
            </div>
            <div className="text-xs text-cyber-muted">操作次数</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-6 py-2 rounded-lg font-orbitron transition-all ${
                activeTab === 'timeline'
                  ? 'bg-cyber-primary text-cyber-bg shadow-neon-cyan'
                  : 'border border-cyber-muted/30 text-cyber-muted hover:text-cyber-primary'
              }`}
            >
              操作时间线
            </button>
            <button
              onClick={() => setActiveTab('evidence')}
              className={`px-6 py-2 rounded-lg font-orbitron transition-all ${
                activeTab === 'evidence'
                  ? 'bg-cyber-primary text-cyber-bg shadow-neon-cyan'
                  : 'border border-cyber-muted/30 text-cyber-muted hover:text-cyber-primary'
              }`}
            >
              证据链
            </button>
          </div>

          {activeTab === 'timeline' && (
            <div className="p-6 rounded-xl neon-border bg-cyber-card/50">
              <h3 className="font-orbitron text-cyber-primary font-bold mb-6">操作记录</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {attempt.operationLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`timeline-node flex gap-4 p-3 rounded-lg cursor-pointer transition-all border ${getLogColor(log.type)} ${
                      selectedLog?.id === log.id ? 'ring-2 ring-cyber-primary' : ''
                    }`}
                    onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyber-bg flex items-center justify-center text-cyber-primary">
                      {getLogIcon(log.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-orbitron text-sm text-cyber-primary">
                          #{log.sequence} {log.type === 'parameter_change' ? '参数调节' :
                            log.type === 'oscillator_toggle' ? '开关振荡器' :
                            log.type === 'phase_cancellation' ? '相位抵消检测' :
                            log.type === 'volume_peak' ? '音量爆峰检测' :
                            log.type === 'playback' ? '试听' : log.type}
                        </span>
                        <span className="text-xs text-cyber-muted">
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                      {log.parameter && (
                        <div className="text-sm text-cyber-muted mt-1">
                          {log.oscillatorId?.replace('osc-', 'OSC')} {log.parameter}: {log.oldValue} → {log.newValue}
                        </div>
                      )}
                      {selectedLog?.id === log.id && log.details && (
                        <div className="mt-2 p-2 rounded bg-cyber-bg/50 text-xs text-cyber-muted font-mono">
                          {JSON.stringify(log.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="p-6 rounded-xl neon-border bg-cyber-card/50">
              <h3 className="font-orbitron text-cyber-primary font-bold mb-6">证据链分析</h3>
              <div className="space-y-4">
                {attempt.evidences.map((evidence: Evidence) => (
                  <div
                    key={evidence.id}
                    className="p-4 rounded-lg border border-cyber-primary/30 bg-cyber-primary/5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyber-primary/20 flex items-center justify-center text-cyber-primary">
                        {getEvidenceIcon(evidence.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-orbitron text-cyber-primary font-bold">
                            {evidence.type === 'waveform' ? '波形分析' :
                             evidence.type === 'oscillator' ? '振荡器配置' :
                             evidence.type === 'filter' ? '滤波补充证据' :
                             evidence.type === 'similarity' ? '相似度评分' :
                             evidence.type === 'audition' ? '试听记录' : evidence.type}
                          </span>
                          <span className="text-xs text-cyber-muted">
                            {formatTime(evidence.timestamp)}
                          </span>
                        </div>
                        <div className="text-cyber-accent mt-1 font-bold">
                          结论: {evidence.conclusion}
                        </div>
                        {evidence.supports && (
                          <div className="text-xs text-cyber-success mt-1">
                            ✓ 支持: {evidence.supports}
                          </div>
                        )}
                        {evidence.conflicts && (
                          <div className="text-xs text-cyber-danger mt-1">
                            ✗ 冲突: {evidence.conflicts}
                          </div>
                        )}
                        <div className="mt-2 p-3 rounded bg-cyber-bg/50 text-xs text-cyber-muted font-mono">
                          <div className="text-cyber-primary mb-2">详情:</div>
                          {JSON.stringify(evidence.details, null, 2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {attempt.evidences.length === 0 && (
                <div className="text-center text-cyber-muted py-8">
                  暂无证据记录
                </div>
              )}
            </div>
          )}
        </div>

        {attempt.isUpdate && (
          <div className="p-4 rounded-xl border border-cyber-accent bg-cyber-accent/10 mb-6">
            <div className="flex items-center gap-2 text-cyber-accent font-bold mb-2">
              <RefreshCw size={18} />
              <span>此为更新提交</span>
            </div>
            <div className="text-sm text-cyber-muted">
              更新字段: {attempt.updatedFields.join(', ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Result;
