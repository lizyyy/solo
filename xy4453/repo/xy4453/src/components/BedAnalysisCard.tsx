import React, { useState } from 'react';
import type { BedAnalysis } from '../types';
import RiskCard from './RiskCard';
import { getOverallRiskLevel } from '../utils/analysis';

interface BedAnalysisCardProps {
  analysis: BedAnalysis;
  onUpdateNotes: (bedId: string, notes: string) => void;
  onManualOverride: (
    bedId: string,
    isOverridden: boolean,
    reason: string,
    decision: 'ignore' | 'mark_as_resolved' | 'assign_to_technician'
  ) => void;
}

const severityBadgeColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200'
};

const statusIcons: Record<string, { icon: string; color: string }> = {
  normal: { icon: '✅', color: 'text-green-600' },
  clogged: { icon: '🚫', color: 'text-red-600' },
  leaking: { icon: '💧', color: 'text-yellow-600' }
};

const BedAnalysisCard: React.FC<BedAnalysisCardProps> = ({
  analysis,
  onUpdateNotes,
  onManualOverride
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState(analysis.notes);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState(
    analysis.manualOverride?.overrideReason || ''
  );
  const [overrideDecision, setOverrideDecision] = useState<
    'ignore' | 'mark_as_resolved' | 'assign_to_technician'
  >(analysis.manualOverride?.overrideDecision || 'ignore');

  const riskLevel = getOverallRiskLevel(analysis.risks);
  const hasRisks = analysis.risks.length > 0;

  const handleNotesBlur = () => {
    onUpdateNotes(analysis.bedId, notes);
  };

  const handleOverrideSubmit = () => {
    onManualOverride(
      analysis.bedId,
      true,
      overrideReason,
      overrideDecision
    );
    setShowOverride(false);
  };

  const handleRemoveOverride = () => {
    onManualOverride(analysis.bedId, false, '', 'ignore');
  };

  return (
    <div className="bed-analysis-card bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      <div
        className="bed-header p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="bed-id text-lg font-bold text-gray-800">
            苗床 {analysis.bedId}
          </span>
          {hasRisks && (
            <span className={`risk-badge px-2 py-1 text-xs font-medium rounded border ${severityBadgeColors[riskLevel]}`}>
              {analysis.risks.length} 个风险
            </span>
          )}
          {analysis.manualOverride?.isOverridden && (
            <span className="override-badge px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 border border-purple-200">
              已人工改判
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="seedling-info text-sm text-gray-600">
            {analysis.seedlingTypes.join(', ')} · {analysis.trayCount} 盘
          </div>
          <span className="expand-icon text-gray-400">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="bed-content p-4 border-t border-gray-200">
          <div className="metrics-grid grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="metric-item p-3 bg-gray-50 rounded-lg">
              <div className="metric-label text-xs text-gray-500 mb-1">土壤湿度</div>
              <div className="metric-value text-lg font-semibold">
                {analysis.avgMoisture.toFixed(1)}%
                <span className="text-xs text-gray-400 ml-1">
                  / {analysis.targetMoisture.toFixed(1)}%
                </span>
              </div>
              <div className={`metric-status text-xs ${
                Math.abs(analysis.avgMoisture - analysis.targetMoisture) > analysis.targetMoisture * 0.15
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}>
                {analysis.avgMoisture < analysis.targetMoisture ? '偏低' : analysis.avgMoisture > analysis.targetMoisture ? '偏高' : '正常'}
              </div>
            </div>

            <div className="metric-item p-3 bg-gray-50 rounded-lg">
              <div className="metric-label text-xs text-gray-500 mb-1">EC 值</div>
              <div className="metric-value text-lg font-semibold">
                {analysis.avgEc.toFixed(2)}
                <span className="text-xs text-gray-400 ml-1">
                  mS/cm
                </span>
                <span className="text-xs text-gray-400 ml-1">
                  / {analysis.targetEc.toFixed(2)}
                </span>
              </div>
              <div className={`metric-status text-xs ${
                analysis.avgEc > analysis.targetEc * 1.2
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}>
                {analysis.avgEc > analysis.targetEc * 1.2 ? '偏高' : '正常'}
              </div>
            </div>

            <div className="metric-item p-3 bg-gray-50 rounded-lg">
              <div className="metric-label text-xs text-gray-500 mb-1">建议补水量</div>
              <div className="metric-value text-lg font-semibold">
                {analysis.suggestedWateringAmount.toFixed(1)}
                <span className="text-xs text-gray-400 ml-1">L</span>
              </div>
            </div>

            <div className="metric-item p-3 bg-gray-50 rounded-lg">
              <div className="metric-label text-xs text-gray-500 mb-1">建议喷灌时长</div>
              <div className="metric-value text-lg font-semibold">
                {analysis.suggestedWateringDuration}
                <span className="text-xs text-gray-400 ml-1">秒</span>
              </div>
            </div>
          </div>

          {analysis.nozzles.length > 0 && (
            <div className="nozzle-section mb-4">
              <h4 className="section-title text-sm font-semibold text-gray-700 mb-2">
                喷头状态
              </h4>
              <div className="nozzle-list flex flex-wrap gap-2">
                {analysis.nozzles.map(nozzleId => {
                  const status = analysis.nozzleStatus[nozzleId] || 'normal';
                  const statusInfo = statusIcons[status];
                  return (
                    <div
                      key={nozzleId}
                      className="nozzle-item px-3 py-1 bg-gray-100 rounded-full flex items-center gap-1"
                    >
                      <span className={statusInfo.color}>{statusInfo.icon}</span>
                      <span className="text-sm">{nozzleId}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasRisks && (
            <div className="risks-section mb-4">
              <h4 className="section-title text-sm font-semibold text-gray-700 mb-2">
                风险警告
              </h4>
              <div className="risks-list space-y-3">
                {analysis.risks.map((risk, index) => (
                  <RiskCard key={index} risk={risk} />
                ))}
              </div>
              
              {!analysis.manualOverride?.isOverridden && (
                <button
                  className="mt-3 text-sm text-purple-600 hover:text-purple-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOverride(!showOverride);
                  }}
                >
                  + 人工改判
                </button>
              )}
              
              {analysis.manualOverride?.isOverridden && (
                <div className="override-info mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-800">改判信息</p>
                      <p className="text-sm text-purple-600">原因: {analysis.manualOverride.overrideReason}</p>
                      <p className="text-sm text-purple-600">
                        决定: {analysis.manualOverride.overrideDecision === 'ignore' 
                          ? '忽略此风险' 
                          : analysis.manualOverride.overrideDecision === 'mark_as_resolved' 
                            ? '标记为已解决' 
                            : '指派技术员处理'}
                      </p>
                    </div>
                    <button
                      className="text-sm text-red-600 hover:text-red-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveOverride();
                      }}
                    >
                      取消改判
                    </button>
                  </div>
                </div>
              )}

              {showOverride && (
                <div className="override-form mt-3 p-4 bg-gray-50 rounded-lg">
                  <h5 className="text-sm font-medium text-gray-700 mb-3">人工改判</h5>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">改判原因</label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows={2}
                        placeholder="请输入改判原因..."
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">改判决定</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={overrideDecision}
                        onChange={(e) => setOverrideDecision(e.target.value as 'ignore' | 'mark_as_resolved' | 'assign_to_technician')}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="ignore">忽略此风险</option>
                        <option value="mark_as_resolved">标记为已解决</option>
                        <option value="assign_to_technician">指派技术员处理</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOverrideSubmit();
                        }}
                      >
                        确认改判
                      </button>
                      <button
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOverride(false);
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="notes-section">
            <h4 className="section-title text-sm font-semibold text-gray-700 mb-2">
              备注
            </h4>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="在此添加备注信息..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BedAnalysisCard;
