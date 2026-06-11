import React, { useState, useRef } from 'react';
import {
  FileText,
  MapPin,
  AlertTriangle,
  MessageSquare,
  Camera,
  Upload,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  Link,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { useReviewStore } from '../store/useReviewStore';
import { generateCollisionKey } from '../types';

export const DetailPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    source: true,
    note: true,
    screenshot: true,
    history: false,
  });

  const {
    session,
    selectedCollisionId,
    selectCollision,
    updateNote,
    attachCollisionScreenshot,
    updateCollisionStatus,
    getLayerById,
  } = useReviewStore();

  const collision = session?.collisions.find(c => c.id === selectedCollisionId);
  const layerA = collision ? getLayerById(collision.layerIdA) : undefined;
  const layerB = collision ? getLayerById(collision.layerIdB) : undefined;

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (collision) {
      updateNote(collision.id, e.target.value);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && collision) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        attachCollisionScreenshot(collision.id, dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCollisionKey = () => {
    if (!collision) return '';
    return generateCollisionKey(collision.position, collision.layerIdA, collision.layerIdB);
  };

  if (!collision || !session) {
    return (
      <div className="h-full flex flex-col bg-slate-800 text-slate-100 items-center justify-center">
        <AlertCircle size={48} className="text-slate-600 mb-4" />
        <p className="text-slate-500 text-sm">请选择一个碰撞点查看详情</p>
      </div>
    );
  }

  const severityColors = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    error: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  const severityLabels = {
    critical: '严重',
    error: '错误',
    warning: '警告',
  };

  const statusColors = {
    pending: 'bg-slate-500/20 text-slate-400',
    resolved: 'bg-green-500/20 text-green-400',
    ignored: 'bg-slate-600/20 text-slate-500',
  };

  return (
    <div className="h-full flex flex-col bg-slate-800 text-slate-100">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={18} className="text-blue-400" />
          <span className="text-lg font-semibold">碰撞点详情</span>
          <button
            onClick={() => selectCollision(null)}
            className="ml-auto p-1 hover:bg-slate-700 rounded"
          >
            <XCircle size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-1 rounded text-xs font-medium border ${severityColors[collision.severity]}`}>
            {severityLabels[collision.severity]}
          </span>
          {collision.isBoundary && (
            <span className="px-2.5 py-1 rounded text-xs font-medium bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
              <AlertTriangle size={10} />
              边界样本
            </span>
          )}
          {collision.duplicateOf && (
            <span className="px-2.5 py-1 rounded text-xs font-medium bg-blue-400/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
              <Copy size={10} />
              重复碰撞
            </span>
          )}
          <div className="ml-auto">
            <select
              value={collision.status}
              onChange={(e) => updateCollisionStatus(collision.id, e.target.value as any)}
              className={`px-2.5 py-1 rounded text-xs font-medium border-0 ${statusColors[collision.status]}`}
            >
              <option value="pending">待处理</option>
              <option value="resolved">已解决</option>
              <option value="ignored">已忽略</option>
            </select>
          </div>
        </div>

        <div className="mt-3 font-mono text-sm text-slate-300">
          位置: ({collision.position.x.toFixed(2)}, {collision.position.y.toFixed(2)}, {collision.position.z.toFixed(2)})
        </div>

        <div className="mt-1 text-[10px] text-slate-500 font-mono flex items-center gap-1">
          <Link size={10} />
          碰撞Key: {getCollisionKey().slice(0, 30)}...
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3 border-b border-slate-700 bg-slate-750">
          <button
            onClick={() => toggleSection('source')}
            className="w-full flex items-center gap-2 text-sm font-medium text-slate-200"
          >
            <FileText size={16} className="text-blue-400" />
            CAD图层来源追溯
            {expandedSections.source ? (
              <ChevronUp size={14} className="ml-auto text-slate-500" />
            ) : (
              <ChevronDown size={14} className="ml-auto text-slate-500" />
            )}
          </button>

          {expandedSections.source && (
            <div className="mt-3 space-y-3">
              <div className="p-3 bg-slate-900/50 rounded border-l-4" style={{ borderLeftColor: layerA?.color }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: layerA?.color }} />
                  <span className="text-sm font-medium">{layerA?.name}</span>
                  <span className="ml-auto text-[10px] text-slate-500 font-mono">
                    图层A
                  </span>
                </div>
                <div className="text-xs text-slate-400 mb-1 font-mono">
                  来源: {layerA?.source}
                </div>
                <div className="text-xs text-slate-300 bg-slate-800/50 p-2 rounded border border-slate-600/50">
                  <div className="text-[10px] text-slate-500 mb-1">原始CAD说明:</div>
                  <div className="leading-relaxed">{layerA?.originalNote}</div>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="px-3 py-1 bg-slate-700 rounded-full text-[10px] text-slate-400">
                  ⟷ 冲突 ⟷
                </div>
              </div>

              <div className="p-3 bg-slate-900/50 rounded border-l-4" style={{ borderLeftColor: layerB?.color }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: layerB?.color }} />
                  <span className="text-sm font-medium">{layerB?.name}</span>
                  <span className="ml-auto text-[10px] text-slate-500 font-mono">
                    图层B
                  </span>
                </div>
                <div className="text-xs text-slate-400 mb-1 font-mono">
                  来源: {layerB?.source}
                </div>
                <div className="text-xs text-slate-300 bg-slate-800/50 p-2 rounded border border-slate-600/50">
                  <div className="text-[10px] text-slate-500 mb-1">原始CAD说明:</div>
                  <div className="leading-relaxed">{layerB?.originalNote}</div>
                </div>
              </div>

              <div className="p-3 bg-red-900/20 rounded border border-red-500/30">
                <div className="text-xs font-medium text-red-400 mb-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  碰撞点原始描述
                </div>
                <div className="text-sm text-red-200/90 leading-relaxed">
                  {collision.originalCADDescription}
                </div>
              </div>

              {collision.boundaryReason && (
                <div className="p-3 bg-amber-900/20 rounded border border-amber-500/30">
                  <div className="text-xs font-medium text-amber-400 mb-1 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    边界说明
                  </div>
                  <div className="text-sm text-amber-200/90">
                    {collision.boundaryReason}
                  </div>
                </div>
              )}

              {collision.duplicateOf && (
                <div className="p-3 bg-blue-900/20 rounded border border-blue-500/30">
                  <div className="text-xs font-medium text-blue-400 mb-1 flex items-center gap-1">
                    <Copy size={12} />
                    重复说明
                  </div>
                  <div className="text-sm text-blue-200/90">
                    此碰撞点与 <span className="font-mono">{collision.duplicateOf.slice(-8)}</span> 为同一位置，已自动去重。
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-b border-slate-700">
          <button
            onClick={() => toggleSection('note')}
            className="w-full flex items-center gap-2 text-sm font-medium text-slate-200"
          >
            <MessageSquare size={16} className="text-green-400" />
            人工备注
            <span className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded border border-green-500/30">
              <Shield size={10} />
              受保护
            </span>
            {expandedSections.note ? (
              <ChevronUp size={14} className="ml-auto text-slate-500" />
            ) : (
              <ChevronDown size={14} className="ml-auto text-slate-500" />
            )}
          </button>

          {expandedSections.note && (
            <div className="mt-3">
              <div className="text-[10px] text-slate-500 mb-2 flex items-center gap-1">
                <Shield size={10} className="text-green-500" />
                重复导入时此备注不会被覆盖
              </div>
              <textarea
                value={collision.manualNote || ''}
                onChange={handleNoteChange}
                placeholder="请输入人工备注..."
                className="w-full h-24 bg-slate-900/50 border border-slate-600 rounded p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-green-500/50 resize-none"
              />
              {collision.noteUpdatedAt && (
                <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock size={10} />
                  最后更新: {formatDate(collision.noteUpdatedAt)}
                </div>
              )}
              {collision.manualNote && (
                <div className="mt-2 text-[10px] text-green-500/80 bg-green-500/10 p-2 rounded flex items-center gap-1">
                  <CheckCircle size={10} />
                  备注已保存，重复导入时将保留此内容
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-b border-slate-700">
          <button
            onClick={() => toggleSection('screenshot')}
            className="w-full flex items-center gap-2 text-sm font-medium text-slate-200"
          >
            <Camera size={16} className="text-purple-400" />
            截图说明
            {collision.screenshot && (
              <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded">
                已上传
              </span>
            )}
            {expandedSections.screenshot ? (
              <ChevronUp size={14} className="ml-auto text-slate-500" />
            ) : (
              <ChevronDown size={14} className="ml-auto text-slate-500" />
            )}
          </button>

          {expandedSections.screenshot && (
            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {collision.screenshot ? (
                <div className="relative group">
                  <img
                    src={collision.screenshot}
                    alt="碰撞点截图"
                    className="w-full rounded border border-slate-600"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm text-white"
                  >
                    点击更换截图
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 bg-slate-900/50 border-2 border-dashed border-slate-600 rounded flex flex-col items-center justify-center gap-2 hover:border-purple-500/50 transition-colors"
                >
                  <Upload size={24} className="text-slate-500" />
                  <span className="text-sm text-slate-400">点击上传截图</span>
                  <span className="text-[10px] text-slate-500">支持 JPG, PNG 格式</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-3">
          <button
            onClick={() => toggleSection('history')}
            className="w-full flex items-center gap-2 text-sm font-medium text-slate-200"
          >
            <Clock size={16} className="text-slate-400" />
            检测记录
            {expandedSections.history ? (
              <ChevronUp size={14} className="ml-auto text-slate-500" />
            ) : (
              <ChevronDown size={14} className="ml-auto text-slate-500" />
            )}
          </button>

          {expandedSections.history && (
            <div className="mt-3 space-y-2">
              <div className="p-2 bg-slate-900/50 rounded text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-slate-300">首次检测</span>
                  <span className="ml-auto text-slate-500 font-mono">
                    {formatDate(collision.detectedAt)}
                  </span>
                </div>
                <div className="text-slate-500 font-mono text-[10px]">
                  批次: {collision.detectionBatchId.slice(-12)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
