import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { getBatchTypeName, formatDateTime, getConflictTypeName, formatTemperature } from "@/utils";
import type { ConflictStatus } from "@/types";
import { AlertTriangle, CheckCircle, XCircle, ChevronRight, Image as ImageIcon, FileText, User, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";

export default function ConflictHandling() {
  const navigate = useNavigate();
  const { 
    currentBatchType, 
    conflicts, 
    workPhotos,
    inspectionNotes,
    getWorkPhotosByBatch,
    updateConflictStatus,
    setCurrentStep
  } = useAppStore();

  const [remark, setRemark] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');

  const batchPhotos = getWorkPhotosByBatch(currentBatchType);
  const batchPhotoIds = batchPhotos.map(p => p.id);
  const batchConflicts = conflicts.filter(c => batchPhotoIds.includes(c.workPhotoId));
  
  const filteredConflicts = batchConflicts.filter(c => {
    if (filterStatus === 'all') return true;
    return c.status === filterStatus;
  });

  const getPhotoById = (id: string) => workPhotos.find(p => p.id === id);
  const getNoteById = (id: string) => inspectionNotes.find(n => n.id === id);

  const handleResolve = (conflictId: string, status: ConflictStatus) => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;
    
    updateConflictStatus(conflictId, status, "老岑", remark[conflictId] || undefined);
    setRemark(prev => {
      const next = { ...prev };
      delete next[conflictId];
      return next;
    });
  };

  const pendingCount = batchConflicts.filter(c => c.status === 'pending').length;

  const handleNextStep = () => {
    setCurrentStep(3);
    navigate("/report");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">冲突处理</h2>
          <p className="text-sm text-slate-500 mt-1">工况照片与手写巡检备注冲突对比，老岑逐条确认或驳回</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded">
            {getBatchTypeName(currentBatchType)}
          </span>
          {pendingCount > 0 && (
            <span className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded flex items-center gap-1">
              <AlertTriangle size={14} />
              待处理 {pendingCount} 项
            </span>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">处理规则</p>
            <p className="text-amber-700 mt-1">
              系统只列出冲突证据，不自动拍板。请维修师傅老岑根据实际情况逐条选择「确认」或「驳回」，所有操作记录留痕。
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'pending', 'confirmed', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              filterStatus === status
                ? "bg-[#0F4C81] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {status === 'all' && `全部 (${batchConflicts.length})`}
            {status === 'pending' && `待处理 (${batchConflicts.filter(c => c.status === 'pending').length})`}
            {status === 'confirmed' && `已确认 (${batchConflicts.filter(c => c.status === 'confirmed').length})`}
            {status === 'rejected' && `已驳回 (${batchConflicts.filter(c => c.status === 'rejected').length})`}
          </button>
        ))}
      </div>

      {filteredConflicts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <CheckCircle size={40} className="mx-auto text-green-500 mb-3" />
          <p className="text-sm text-slate-500">
            {batchConflicts.length === 0 ? '暂无检测到冲突' : '当前筛选条件下无冲突记录'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredConflicts.map((conflict, index) => {
            const photo = getPhotoById(conflict.workPhotoId);
            const note = getNoteById(conflict.inspectionNoteId);
            
            return (
              <div 
                key={conflict.id}
                className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all ${
                  conflict.status === 'pending' 
                    ? 'border-amber-300' 
                    : conflict.status === 'confirmed'
                      ? 'border-green-300'
                      : 'border-red-300'
                }`}
              >
                <div className={`px-4 py-2 flex items-center justify-between ${
                  conflict.status === 'pending' 
                    ? 'bg-amber-50 border-b border-amber-200' 
                    : conflict.status === 'confirmed'
                      ? 'bg-green-50 border-b border-green-200'
                      : 'bg-red-50 border-b border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      冲突 #{index + 1}：{getConflictTypeName(conflict.conflictType)}
                    </span>
                    {photo && (
                      <span className="text-xs text-slate-500">
                        设备 {photo.deviceNo}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    conflict.status === 'pending' 
                      ? 'bg-amber-200 text-amber-800' 
                      : conflict.status === 'confirmed'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-200 text-red-800'
                  }`}>
                    {conflict.status === 'pending' ? '待处理' : conflict.status === 'confirmed' ? '老岑已确认' : '老岑已驳回'}
                  </span>
                </div>

                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon size={16} className="text-[#0F4C81]" />
                      <span className="text-sm font-medium text-slate-700">工况照片数据</span>
                    </div>
                    {photo && (
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-2">
                          <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {photo.imageUrl ? (
                              <img src={photo.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon size={20} className="text-slate-400" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-slate-600">设备：<span className="font-medium">{photo.deviceNo}</span></p>
                            <p className="text-slate-600">溶氧：<span className="font-medium">{photo.dissolvedOxygen} mg/L</span></p>
                          </div>
                        </div>
                        <div className={`p-2 rounded ${
                          conflict.conflictType === 'temperature' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                        }`}>
                          <p className="text-xs text-slate-500 mb-0.5">水温</p>
                          <p className={`font-medium ${
                            conflict.conflictType === 'temperature' ? 'text-amber-800' : 'text-slate-700'
                          }`}>
                            {formatTemperature(photo.temperature, photo.temperatureUnit)}
                          </p>
                        </div>
                        <div className={`p-2 rounded ${
                          conflict.conflictType === 'time' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                        }`}>
                          <p className="text-xs text-slate-500 mb-0.5">记录时间</p>
                          <p className={`font-medium ${
                            conflict.conflictType === 'time' ? 'text-amber-800' : 'text-slate-700'
                          }`}>
                            {formatDateTime(photo.recordTime)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500">系统提取值：</p>
                      <p className="text-sm font-mono bg-slate-100 px-2 py-1 mt-1 rounded text-slate-700">
                        {conflict.photoValue}
                      </p>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={16} className="text-[#FF6B35]" />
                      <span className="text-sm font-medium text-slate-700">手写巡检备注</span>
                    </div>
                    {note && (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <User size={14} />
                          <span>{note.inspectorName}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded border border-slate-200">
                          <p className="text-slate-700">{note.content}</p>
                        </div>
                        {note.temperature !== undefined && (
                          <div className={`p-2 rounded ${
                            conflict.conflictType === 'temperature' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                          }`}>
                            <p className="text-xs text-slate-500 mb-0.5">实测水温</p>
                            <p className={`font-medium ${
                              conflict.conflictType === 'temperature' ? 'text-amber-800' : 'text-slate-700'
                            }`}>
                              {formatTemperature(note.temperature, note.temperatureUnit!)}
                            </p>
                          </div>
                        )}
                        <div className={`p-2 rounded ${
                          conflict.conflictType === 'time' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                        }`}>
                          <p className="text-xs text-slate-500 mb-0.5">巡检时间</p>
                          <p className={`font-medium ${
                            conflict.conflictType === 'time' ? 'text-amber-800' : 'text-slate-700'
                          }`}>
                            {formatDateTime(note.inspectionTime)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500">系统提取值：</p>
                      <p className="text-sm font-mono bg-slate-100 px-2 py-1 mt-1 rounded text-slate-700">
                        {conflict.noteValue}
                      </p>
                    </div>
                  </div>
                </div>

                {conflict.status === 'pending' ? (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 mb-1 block">
                          <MessageSquare size={12} className="inline mr-1" />
                          处理备注（选填）
                        </label>
                        <input
                          type="text"
                          value={remark[conflict.id] || ''}
                          onChange={(e) => setRemark(prev => ({ ...prev, [conflict.id]: e.target.value }))}
                          placeholder="输入处理说明..."
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                        />
                      </div>
                      <div className="flex gap-2 pt-5">
                        <button
                          onClick={() => handleResolve(conflict.id, 'rejected')}
                          className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors flex items-center gap-1"
                        >
                          <ThumbsDown size={16} />
                          驳回
                        </button>
                        <button
                          onClick={() => handleResolve(conflict.id, 'confirmed')}
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                        >
                          <ThumbsUp size={16} />
                          确认
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                    <div className="flex items-center gap-2 text-sm">
                      {conflict.status === 'confirmed' ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <XCircle size={16} className="text-red-600" />
                      )}
                      <span className="text-slate-600">
                        处理人：{conflict.resolverName}
                      </span>
                      {conflict.resolutionRemark && (
                        <span className="text-slate-500">
                          · 备注：{conflict.resolutionRemark}
                        </span>
                      )}
                      <span className="text-slate-400 text-xs ml-auto">
                        {conflict.resolvedAt && formatDateTime(conflict.resolvedAt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          共检测到 <span className="font-medium text-slate-700">{batchConflicts.length}</span> 项冲突，
          已处理 <span className="font-medium text-green-600">{batchConflicts.filter(c => c.status !== 'pending').length}</span> 项
        </p>
        <button
          onClick={handleNextStep}
          className="px-6 py-2.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors flex items-center gap-1"
        >
          下一步：生成交接报告
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
