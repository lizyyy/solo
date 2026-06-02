
import React from 'react';
import { Bot, User, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { DetectionResult } from '../types';
import { EvidenceCard } from './EvidenceCard';

interface ConflictPanelProps {
  detection: DetectionResult;
  onAcceptModel: () => void;
  onAcceptManual: () => void;
  onNeedReview: () => void;
}

export const ConflictPanel: React.FC<ConflictPanelProps> = ({
  detection,
  onAcceptModel,
  onAcceptManual,
  onNeedReview,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="bg-gradient-to-r from-red-50 to-amber-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">检测到判断冲突</h3>
            <p className="text-sm text-gray-600">模型输出与人工标注不一致，请对比证据后做出判断</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-blue-200">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <span className="font-medium text-gray-800">模型判断</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-blue-600">{detection.modelIntent}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    置信度 {(detection.modelConfidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {detection.evidences
                .filter((e) => e.type === 'model_output' || e.type === 'threshold_config')
                .map((evidence) => (
                  <EvidenceCard key={evidence.id} evidence={evidence} />
                ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                <span className="text-lg font-bold text-gray-500">VS</span>
              </div>
            </div>

            <div className="space-y-4 pl-6 border-l-2 border-gray-200">
              <div className="flex items-center gap-2 pb-3 border-b border-emerald-200">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <User className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-800">人工标注</span>
                  <div className="mt-1">
                    <span className="text-lg font-bold text-emerald-600">{detection.manualIntent}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {detection.evidences
                  .filter((e) => e.type === 'manual_label')
                  .map((evidence) => (
                    <EvidenceCard key={evidence.id} evidence={evidence} />
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">处理建议</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>仔细对比两边的证据，特别是关键词匹配情况</li>
                <li>如无法确定，可标记"需复核"，由团队共同判断</li>
                <li>改判时请填写详细理由，便于后续追溯</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-4 justify-center">
          <button
            onClick={onAcceptModel}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <CheckCircle className="w-5 h-5" />
            采纳模型判断
          </button>
          <button
            onClick={onAcceptManual}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <CheckCircle className="w-5 h-5" />
            采纳人工标注
          </button>
          <button
            onClick={onNeedReview}
            className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
          >
            <XCircle className="w-5 h-5" />
            需进一步复核
          </button>
        </div>
      </div>
    </div>
  );
};
