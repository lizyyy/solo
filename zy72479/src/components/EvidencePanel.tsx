import { Evidence, evidenceTypeLabels } from '../types';
import { Camera, Bus, AlertTriangle, FileText, Clock, MapPin, User } from 'lucide-react';

interface EvidencePanelProps {
  evidences: Evidence[];
}

export function EvidencePanel({ evidences }: EvidencePanelProps) {
  const roadPhotoEvidence = evidences.filter(e => e.type === 'road_photo');
  const busCardEvidence = evidences.filter(e => e.type === 'bus_card');

  const renderEvidenceCard = (evidence: Evidence) => {
    const isSummaryOnly = !evidence.hasOriginalText;
    const isSupplemented = evidence.metadata?.supplemented;
    
    return (
      <div
        key={evidence.id}
        className={`p-4 rounded-lg border ${
          isSummaryOnly
            ? 'bg-warning-50 border-warning-200'
            : isSupplemented
            ? 'bg-primary-50 border-primary-200'
            : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h4 className="text-sm font-medium text-gray-900 flex-1">{evidence.title}</h4>
          {isSummaryOnly && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
              <AlertTriangle className="w-3 h-3" />
              仅汇总无原文
            </span>
          )}
          {isSupplemented && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
              <Clock className="w-3 h-3" />
              历史补录
            </span>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm text-gray-700 leading-relaxed">{evidence.description}</p>
          
          {isSummaryOnly && evidence.summary && (
            <div className="mt-3 p-3 bg-white rounded border border-warning-200">
              <p className="text-xs font-medium text-warning-700 mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                居民意见汇总（无原文）
              </p>
              <p className="text-sm text-gray-600 italic">"{evidence.summary}"</p>
              <p className="text-xs text-warning-600 mt-2">⚠️ 此记录仅剩汇总，无原始材料，需社区书记复核</p>
            </div>
          )}

          <div className="pt-3 mt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {evidence.metadata?.photoTime && (
                <span className="text-gray-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  拍摄时间: {evidence.metadata.photoTime}
                </span>
              )}
              {evidence.metadata?.location && (
                <span className="text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  地点: {evidence.metadata.location}
                </span>
              )}
              {evidence.metadata?.decibel && (
                <span className="text-gray-500">
                  分贝值: {evidence.metadata.decibel}dB
                </span>
              )}
              {evidence.metadata?.witness && (
                <span className="text-gray-500 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  见证人: {evidence.metadata.witness}
                </span>
              )}
              {evidence.metadata?.busRoute && (
                <span className="text-gray-500">
                  公交线路: {evidence.metadata.busRoute}
                </span>
              )}
              {evidence.metadata?.timeRange && (
                <span className="text-gray-500">
                  时段: {evidence.metadata.timeRange}
                </span>
              )}
              {evidence.metadata?.driver && (
                <span className="text-gray-500 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  司机: {evidence.metadata.driver}
                </span>
              )}
              {evidence.metadata?.driverCount && (
                <span className="text-gray-500">
                  涉及司机: {evidence.metadata.driverCount}人
                </span>
              )}
              {evidence.metadata?.originalPeriod && (
                <span className="text-gray-500 col-span-2">
                  原数据时段: {evidence.metadata.originalPeriod}
                </span>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-400 pt-2 border-t border-gray-100 flex items-center justify-between">
            <span>来源: {evidence.source}</span>
            <span>录入: {evidence.createdAt}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-blue-50 flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary-700" />
          <h3 className="text-sm font-semibold text-gray-800">
            路口照片（主流程）
          </h3>
          <span className="ml-auto text-xs text-gray-500">{roadPhotoEvidence.length} 条</span>
        </div>
        <div className="p-4 space-y-4">
          {roadPhotoEvidence.length > 0 ? (
            roadPhotoEvidence.map(renderEvidenceCard)
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">暂无路口照片证据</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-green-50 flex items-center gap-2">
          <Bus className="w-5 h-5 text-success-600" />
          <h3 className="text-sm font-semibold text-gray-800">
            公交刷卡时段（现场说法）
          </h3>
          <span className="ml-auto text-xs text-gray-500">{busCardEvidence.length} 条</span>
        </div>
        <div className="p-4 space-y-4">
          {busCardEvidence.length > 0 ? (
            busCardEvidence.map(renderEvidenceCard)
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">暂无公交刷卡时段证据</p>
          )}
        </div>
      </div>
    </div>
  );
}
