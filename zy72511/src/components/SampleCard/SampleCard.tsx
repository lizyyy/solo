import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, User } from 'lucide-react';
import { AttributionSample } from '../../types';
import { getSampleTypeLabel, getSampleTypeColor, getStatusLabel, getStatusColor, getStepLabel } from '../../utils';

interface SampleCardProps {
  sample: AttributionSample;
}

export const SampleCard: React.FC<SampleCardProps> = ({ sample }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/sample/${sample.id}`)}
      className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-slate-800">{sample.sampleNo}</span>
          <span className={`px-2 py-0.5 rounded text-xs border ${getSampleTypeColor(sample.type)}`}>
            {getSampleTypeLabel(sample.type)}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(sample.status)}`}>
            {getStatusLabel(sample.status)}
          </span>
        </div>
        <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
      </div>

      <div className="space-y-2 mb-4">
        <div className="text-sm">
          <span className="text-slate-500">原文：</span>
          <span className="text-slate-700 line-clamp-1">{sample.originalText}</span>
        </div>
        <div className="text-sm">
          <span className="text-slate-500">转写：</span>
          <span className="text-slate-700 line-clamp-1">{sample.transcribedText}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>模型: {sample.modelVersion}</span>
          <span>错词: {sample.wrongWords.length} 处</span>
          {sample.hasConflict && (
            <span className="text-red-500 font-medium">⚠ 存在冲突</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>{getStepLabel(sample.currentStep)}</span>
          </div>
          {sample.reviewBy && (
            <div className="flex items-center gap-1">
              <User size={12} />
              <span>{sample.reviewBy}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
