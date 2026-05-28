import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, TrendingUp, Volume2, CheckCircle, Clock, AlertCircle, X } from 'lucide-react';
import type { ErrorCause, ErrorCauseType } from '../../shared/types';
import Waveform from '../components/Waveform';

interface ErrorCardData {
  type: ErrorCauseType;
  icon: typeof Zap;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progressColor: string;
}

const errorCardConfigs: ErrorCardData[] = [
  {
    type: 'weak_beat',
    icon: Zap,
    title: '弱拍误检',
    description: '低置信度节拍点检测',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    progressColor: 'bg-orange-500',
  },
  {
    type: 'tempo_change',
    icon: TrendingUp,
    title: '速度变化',
    description: '异常 tempo 波动区域',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    progressColor: 'bg-blue-500',
  },
  {
    type: 'voice_masking',
    icon: Volume2,
    title: '声部遮蔽',
    description: '多声部信号干扰区域',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    progressColor: 'bg-purple-500',
  },
];

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (resolution: string) => void;
  action: string;
  error: ErrorCause | null;
}

function ActionModal({ isOpen, onClose, onConfirm, action, error }: ActionModalProps) {
  const [resolution, setResolution] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setResolution('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !error) return null;

  const actionLabels: Record<string, string> = {
    manual_correct: '手工更正',
    ignore: '忽略',
    redetect: '重新检测',
  };

  const handleSubmit = async () => {
    if (!resolution.trim()) return;
    setIsSubmitting(true);
    await onConfirm(resolution.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-charcoal-800 rounded-xl border border-charcoal-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-charcoal-700">
          <h3 className="text-lg font-semibold text-white">{actionLabels[action]}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-charcoal-700 text-charcoal-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-charcoal-900/50 rounded-lg p-3 space-y-2">
            <p className="text-sm text-charcoal-400">错因区间</p>
            <p className="text-white font-mono">
              {formatTime(error.timeMsStart)} - {formatTime(error.timeMsEnd)}
            </p>
          </div>

          <div className="bg-charcoal-900/50 rounded-lg p-3 space-y-2">
            <p className="text-sm text-charcoal-400">原因描述</p>
            <p className="text-white">{error.reason}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-charcoal-300">
              解决备注 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="请输入解决备注..."
              className="w-full h-24 bg-charcoal-900 border border-charcoal-700 rounded-lg px-3 py-2 text-white placeholder-charcoal-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-charcoal-700">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 bg-charcoal-700 hover:bg-charcoal-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!resolution.trim() || isSubmitting}
            className="flex-1 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-charcoal-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '提交中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function ErrorTracking() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [errors, setErrors] = useState<ErrorCause[]>([]);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [selectedType, setSelectedType] = useState<ErrorCauseType | null>(null);
  const [selectedError, setSelectedError] = useState<ErrorCause | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    action: string;
    error: ErrorCause | null;
  }>({
    isOpen: false,
    action: '',
    error: null,
  });

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [errorsRes, waveformRes] = await Promise.all([
          fetch(`/api/analysis/${id}/errors`),
          fetch(`/api/audio/${id}/waveform`),
        ]);

        const errorsData = await errorsRes.json();
        const waveformData = await waveformRes.json();

        if (errorsData.success) {
          setErrors(errorsData.data);
          if (errorsData.data.length > 0 && !selectedType) {
            setSelectedType(errorsData.data[0].type);
          }
        }
        if (waveformData.success) {
          setWaveform(waveformData.data.waveform);
          setDuration(waveformData.data.duration);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const groupedErrors = useMemo(() => {
    return errors.reduce((acc, error) => {
      if (!acc[error.type]) {
        acc[error.type] = [];
      }
      acc[error.type].push(error);
      return acc;
    }, {} as Record<ErrorCauseType, ErrorCause[]>);
  }, [errors]);

  const cardStats = useMemo(() => {
    return errorCardConfigs.map((config) => {
      const typeErrors = groupedErrors[config.type] || [];
      const avgImpact =
        typeErrors.length > 0
          ? typeErrors.reduce((sum, e) => sum + e.impactScore, 0) / typeErrors.length
          : 0;
      return {
        ...config,
        count: typeErrors.length,
        avgImpact: Math.round(avgImpact * 100) / 100,
      };
    });
  }, [groupedErrors]);

  const selectedErrors = useMemo(() => {
    return selectedType ? groupedErrors[selectedType] || [] : [];
  }, [selectedType, groupedErrors]);

  const waveformHighlights = useMemo(() => {
    if (!selectedError) return [];
    return [
      {
        id: selectedError.id,
        startMs: selectedError.timeMsStart,
        endMs: selectedError.timeMsEnd,
        severity: 'high' as const,
        driftAtStart: 0,
        driftAtEnd: 0,
        tag: selectedError.reason,
      },
    ];
  }, [selectedError]);

  const handleActionClick = (action: string, error: ErrorCause) => {
    setModalState({
      isOpen: true,
      action,
      error,
    });
  };

  const handleConfirmAction = async (resolution: string) => {
    if (!modalState.error) return;

    try {
      const response = await fetch(`/api/errors/${modalState.error.id}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: modalState.action,
          resolution,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setErrors((prev) =>
          prev.map((e) => (e.id === modalState.error?.id ? data.data : e))
        );
        if (selectedError?.id === modalState.error.id) {
          setSelectedError(data.data);
        }
        setModalState({ isOpen: false, action: '', error: null });
      }
    } catch (error) {
      console.error('Failed to resolve error:', error);
    }
  };

  const getTypeConfig = (type: ErrorCauseType) => {
    return errorCardConfigs.find((c) => c.type === type)!;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-charcoal-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 px-6 py-4 border-b border-charcoal-700 bg-charcoal-800/50">
        <div className="flex items-center gap-2 text-sm mb-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-charcoal-700 text-charcoal-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-charcoal-400">分析工作台</span>
          <span className="text-charcoal-600">/</span>
          <span className="text-charcoal-400 cursor-pointer hover:text-white">漂移分析</span>
          <span className="text-charcoal-600">/</span>
          <span className="text-cyan-300">错因追踪</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">错因追踪</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cardStats.map((card) => {
              const Icon = card.icon;
              const isSelected = selectedType === card.type;
              return (
                <div
                  key={card.type}
                  onClick={() => setSelectedType(card.type)}
                  className={`p-5 rounded-xl border cursor-pointer transition-all duration-200 ${
                    card.bgColor
                  } ${
                    isSelected
                      ? `${card.borderColor} border-2 scale-[1.02]`
                      : 'border-charcoal-700 hover:border-charcoal-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`p-3 rounded-lg ${card.bgColor} ${card.color}`}
                    >
                      <Icon size={24} />
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">
                        {card.count}
                      </div>
                      <div className="text-xs text-charcoal-400">个错因</div>
                    </div>
                  </div>
                  <h3 className={`text-lg font-semibold mb-1 ${card.color}`}>
                    {card.title}
                  </h3>
                  <p className="text-sm text-charcoal-400 mb-4">{card.description}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-charcoal-400 mb-1">
                        平均影响评分
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 w-24 bg-charcoal-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${card.progressColor} transition-all duration-300`}
                            style={{ width: `${card.avgImpact * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono text-white">
                          {card.avgImpact.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <button
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        isSelected
                          ? `${card.progressColor} text-white`
                          : 'bg-charcoal-700 text-charcoal-300 hover:bg-charcoal-600'
                      }`}
                    >
                      查看详情
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedType && selectedErrors.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                {getTypeConfig(selectedType).title} 详情列表
              </h2>
              <div className="space-y-3">
                {selectedErrors.map((error) => {
                  const config = getTypeConfig(error.type);
                  const isSelected = selectedError?.id === error.id;
                  const isResolved = !!error.resolvedAt;

                  return (
                    <div
                      key={error.id}
                      onClick={() => setSelectedError(error)}
                      className={`p-5 rounded-xl border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? `${config.borderColor} border-2 bg-charcoal-800`
                          : 'border-charcoal-700 bg-charcoal-800/50 hover:border-charcoal-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}
                          >
                            <config.icon size={20} />
                          </div>
                          <div>
                            <div className="font-mono text-white">
                              {formatTime(error.timeMsStart)} -{' '}
                              {formatTime(error.timeMsEnd)}
                            </div>
                            <div className="text-sm text-charcoal-400">
                              {error.reason}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                            isResolved
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {isResolved ? (
                            <>
                              <CheckCircle size={14} />
                              已解决
                            </>
                          ) : (
                            <>
                              <Clock size={14} />
                              未解决
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-charcoal-400 mb-1">
                            影响范围
                          </div>
                          <div className="text-white">{error.impactRange}</div>
                        </div>
                        <div>
                          <div className="text-xs text-charcoal-400 mb-1">
                            影响评分
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-charcoal-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${config.progressColor}`}
                                style={{
                                  width: `${error.impactScore * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm font-mono text-white">
                              {error.impactScore.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!isResolved && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActionClick('manual_correct', error);
                            }}
                            className="flex-1 px-3 py-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded-lg text-sm transition-colors"
                          >
                            手工更正
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActionClick('ignore', error);
                            }}
                            className="flex-1 px-3 py-2 bg-charcoal-700 text-charcoal-300 hover:bg-charcoal-600 rounded-lg text-sm transition-colors"
                          >
                            忽略
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActionClick('redetect', error);
                            }}
                            className="flex-1 px-3 py-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg text-sm transition-colors"
                          >
                            重新检测
                          </button>
                        </div>
                      )}

                      {isResolved && (
                        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle
                              size={18}
                              className="text-green-400 flex-shrink-0 mt-0.5"
                            />
                            <div className="space-y-1">
                              <div className="text-sm text-green-400">
                                已解决 · {error.resolvedBy} ·{' '}
                                {error.resolvedAt &&
                                  new Date(
                                    error.resolvedAt
                                  ).toLocaleString()}
                              </div>
                              <div className="text-charcoal-300 text-sm">
                                {error.resolution}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedType && selectedErrors.length === 0 && (
            <div className="text-center py-12 text-charcoal-400">
              该类型暂无错因记录
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">关联波形</h2>
            <div className="bg-charcoal-800 rounded-xl p-4 border border-charcoal-700">
              {waveform.length > 0 ? (
                <Waveform
                  waveform={waveform}
                  duration={duration}
                  selectedAnomalies={waveformHighlights}
                />
              ) : (
                <div className="text-center py-8 text-charcoal-400">
                  暂无波形数据
                </div>
              )}
              {selectedError && (
                <div className="mt-4 p-3 bg-charcoal-900/50 rounded-lg">
                  <div className="text-sm text-charcoal-400 mb-1">
                    当前高亮区间
                  </div>
                  <div className="font-mono text-white">
                    {formatTime(selectedError.timeMsStart)} -{' '}
                    {formatTime(selectedError.timeMsEnd)}
                  </div>
                  <div className="text-sm text-charcoal-400 mt-1">
                    {selectedError.reason}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ActionModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, action: '', error: null })}
        onConfirm={handleConfirmAction}
        action={modalState.action}
        error={modalState.error}
      />
    </div>
  );
}
