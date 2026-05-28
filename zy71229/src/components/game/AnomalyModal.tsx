import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, XCircle, HelpCircle, Eye, Clock } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { AnomalyStatus, ANOMALY_TYPE_LABELS, ANOMALY_STATUS_LABELS, DataSource, DATA_SOURCE_LABELS } from '../../game/types';
import { SourceBadge } from '../common/SourceBadge';
import { formatGameTime } from '../../game/engine';

export const AnomalyModal: React.FC = () => {
  const { state, handleAnomalyDecision, closeAnomalyModal, markDataSourceViewed } = useGameStore();
  const { addNotification } = useUIStore();
  const [selectedChoice, setSelectedChoice] = useState<AnomalyStatus | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const anomaly = state.anomalies.find(a => a.id === state.activeAnomalyId);

  useEffect(() => {
    if (anomaly) {
      setSelectedChoice(null);
      setShowConfirm(false);
    }
  }, [anomaly?.id]);

  if (!anomaly || !state.activeAnomalyId) return null;

  const handleChoiceSelect = (choice: AnomalyStatus) => {
    setSelectedChoice(choice);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    if (!selectedChoice) return;

    const isCorrect = selectedChoice === anomaly.correctAction;
    handleAnomalyDecision(anomaly.id, selectedChoice);
    
    addNotification(
      isCorrect ? '处理正确！' : '处理有误，复盘时可查看详解',
      isCorrect ? 'success' : 'warning'
    );
  };

  const handleCancel = () => {
    setSelectedChoice(null);
    setShowConfirm(false);
  };

  const handleEvidenceClick = (source: DataSource) => {
    markDataSourceViewed(source);
  };

  const responseTime = state.gameTime - anomaly.triggerTime;

  const choiceButtons = [
    { status: AnomalyStatus.CONFIRMED, label: '确认异常', icon: AlertTriangle, color: 'danger', desc: '确认真实异常，需要进一步处理' },
    { status: AnomalyStatus.FALSE_ALARM, label: '标记误报', icon: XCircle, color: 'warning', desc: '传感器故障或环境干扰，无需处理' },
    { status: AnomalyStatus.IGNORED, label: '暂时忽略', icon: HelpCircle, color: 'default', desc: '先记录，稍后再核实' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-night-600 border border-gray-600 w-full max-w-2xl mx-4 animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-alert-red/20 text-alert-red">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">
                {ANOMALY_TYPE_LABELS[anomaly.type]}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <SourceBadge source={anomaly.source} />
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={12} />
                  触发于 {formatGameTime(anomaly.triggerTime)}
                </span>
                <span className="text-xs text-gray-400">
                  响应时间: {responseTime}秒
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={closeAnomalyModal}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-night-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          <div className="bg-night-700 p-3 border-l-4 border-alert-red">
            <p className="text-gray-200">{anomaly.description}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <Eye size={14} />
              相关证据（点击查看详情）
            </h4>
            <div className="space-y-2">
              {anomaly.evidence.map((ev, index) => (
                <div
                  key={index}
                  className="bg-night-700 p-3 border border-gray-700 cursor-pointer hover:border-gray-500 transition-colors"
                  onClick={() => handleEvidenceClick(ev.source)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <SourceBadge source={ev.source} />
                      <span className="text-xs text-gray-400 font-mono">
                        {formatGameTime(ev.timestamp)}
                      </span>
                    </div>
                  </div>
                  <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap mt-1">
                    {JSON.stringify(ev.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">请做出处理选择：</h4>
            
            {!showConfirm ? (
              <div className="grid gap-3">
                {choiceButtons.map(btn => (
                  <button
                    key={btn.status}
                    onClick={() => handleChoiceSelect(btn.status)}
                    className={`p-4 border text-left transition-all hover:scale-[1.01] ${
                      btn.color === 'danger' ? 'border-alert-red/50 hover:border-alert-red hover:bg-alert-red/10' :
                      btn.color === 'warning' ? 'border-alert-yellow/50 hover:border-alert-yellow hover:bg-alert-yellow/10' :
                      'border-gray-600 hover:border-gray-400 hover:bg-night-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <btn.icon size={20} className={
                        btn.color === 'danger' ? 'text-alert-red' :
                        btn.color === 'warning' ? 'text-alert-yellow' :
                        'text-gray-400'
                      } />
                      <div>
                        <div className={`font-medium ${
                          btn.color === 'danger' ? 'text-alert-red' :
                          btn.color === 'warning' ? 'text-alert-yellow' :
                          'text-gray-200'
                        }`}>
                          {btn.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{btn.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-night-700 p-4 border border-gray-600">
                  <div className="text-sm text-gray-400 mb-2">已选择：</div>
                  <div className="text-lg font-medium text-alert-yellow">
                    {ANOMALY_STATUS_LABELS[selectedChoice]}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 glow-btn py-3"
                  >
                    重新选择
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 glow-btn-primary py-3"
                  >
                    确认提交
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
