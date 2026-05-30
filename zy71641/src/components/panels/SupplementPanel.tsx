import { useState } from 'react';
import { PlusCircle, FileText, Mic, Paperclip, Target, Zap, RotateCcw, Route, Clock, Check } from 'lucide-react';
import { useSwingStore } from '@/store/useSwingStore';
import { SupplementFieldType, SupplementSource } from '@/types';

const SUPPLEMENT_TYPES: { value: SupplementFieldType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'trajectory', label: '挥杆轨迹', icon: <Route className="w-4 h-4" />, color: 'golf-green' },
  { value: 'velocity', label: '杆头速度', icon: <Zap className="w-4 h-4" />, color: 'golf-blue' },
  { value: 'faceAngle', label: '杆面角度', icon: <RotateCcw className="w-4 h-4" />, color: 'golf-purple' },
  { value: 'impactPoint', label: '击球点', icon: <Target className="w-4 h-4" />, color: 'golf-red' },
  { value: 'note', label: '学员备注', icon: <FileText className="w-4 h-4" />, color: 'golf-orange' },
  { value: 'attachment', label: '报告附件', icon: <Paperclip className="w-4 h-4" />, color: 'golf-yellow' },
];

const SOURCE_TYPES: { value: SupplementSource; label: string; icon: React.ReactNode }[] = [
  { value: 'manual', label: '手动输入', icon: <FileText className="w-3 h-3" /> },
  { value: 'file', label: '文件导入', icon: <Paperclip className="w-3 h-3" /> },
  { value: 'voice', label: '口头备注', icon: <Mic className="w-3 h-3" /> },
];

export function SupplementPanel() {
  const { 
    currentSession, 
    selectedFrameIndex,
    supplementData,
  } = useSwingStore();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedType, setSelectedType] = useState<SupplementFieldType>('note');
  const [selectedSource, setSelectedSource] = useState<SupplementSource>('manual');
  const [remark, setRemark] = useState('');
  const [frameRange, setFrameRange] = useState({ start: 0, end: 0 });
  const [supplementedBy, setSupplementedBy] = useState('教练');
  
  if (!currentSession) return null;
  
  const handleSubmit = () => {
    if (!remark.trim()) return;
    
    const startIdx = Math.max(0, Math.min(frameRange.start, currentSession.frames.length - 1));
    const endIdx = Math.max(startIdx, Math.min(frameRange.end, currentSession.frames.length - 1));
    
    const affectedFrames = currentSession.frames
      .slice(startIdx, endIdx + 1)
      .map(f => f.frameId);
    
    supplementData({
      fieldType: selectedType,
      source: selectedSource,
      supplementedBy,
      remark: remark.trim(),
      affectedFrames,
    });
    
    setRemark('');
    setShowAddForm(false);
  };
  
  const getTypeColorClass = (type: SupplementFieldType) => {
    const color = SUPPLEMENT_TYPES.find(t => t.value === type)?.color || 'golf-text-muted';
    const colorMap: Record<string, { bg: string; text: string; border: string; hex: string }> = {
      'golf-green': { bg: 'bg-golf-green/20', text: 'text-golf-green', border: 'border-golf-green/50', hex: '#00FF88' },
      'golf-blue': { bg: 'bg-golf-blue/20', text: 'text-golf-blue', border: 'border-golf-blue/50', hex: '#00AAFF' },
      'golf-purple': { bg: 'bg-golf-purple/20', text: 'text-golf-purple', border: 'border-golf-purple/50', hex: '#AA66FF' },
      'golf-red': { bg: 'bg-golf-red/20', text: 'text-golf-red', border: 'border-golf-red/50', hex: '#FF3366' },
      'golf-orange': { bg: 'bg-golf-orange/20', text: 'text-golf-orange', border: 'border-golf-orange/50', hex: '#FF8800' },
      'golf-yellow': { bg: 'bg-golf-yellow/20', text: 'text-golf-yellow', border: 'border-golf-yellow/50', hex: '#FFDD00' },
      'golf-text-muted': { bg: 'bg-golf-text-muted/20', text: 'text-golf-text-muted', border: 'border-golf-text-muted/50', hex: '#94A3B8' },
    };
    return colorMap[color] || colorMap['golf-text-muted'];
  };
  
  const getTypeIcon = (type: SupplementFieldType) => {
    return SUPPLEMENT_TYPES.find(t => t.value === type)?.icon || <FileText className="w-4 h-4" />;
  };
  
  const getTypeLabel = (type: SupplementFieldType) => {
    return SUPPLEMENT_TYPES.find(t => t.value === type)?.label || type;
  };
  
  const getSourceLabel = (source: SupplementSource) => {
    return SOURCE_TYPES.find(s => s.value === source)?.label || source;
  };
  
  const getFrameRange = (frames: string[]) => {
    const indices = frames.map(fid => 
      currentSession.frames.findIndex(f => f.frameId === fid)
    ).filter(i => i >= 0).sort((a, b) => a - b);
    
    if (indices.length === 0) return '';
    if (indices.length === 1) return `帧 ${indices[0]}`;
    return `帧 ${indices[0]}-${indices[indices.length - 1]} (共${indices.length}帧)`;
  };
  
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <PlusCircle className="w-5 h-5 text-golf-orange" />
        <h2 className="text-lg font-semibold text-golf-text">数据补录</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="ml-auto px-3 py-1.5 bg-golf-orange/20 text-golf-orange text-xs rounded hover:bg-golf-orange/30 transition-colors flex items-center gap-1"
        >
          <PlusCircle className="w-3 h-3" /> 新增补录
        </button>
      </div>
      
      {showAddForm && (
        <div className="mb-4 p-4 bg-golf-bg-light border border-golf-orange/30 rounded-lg animate-slideDown">
          <div className="text-sm font-medium text-golf-orange mb-3">新增补录记录</div>
          
          <div className="space-y-4">
            <div>
              <div className="text-xs text-golf-text-muted mb-2">补录类型</div>
              <div className="grid grid-cols-3 gap-2">
                {SUPPLEMENT_TYPES.map(type => {
                  const colorClass = getTypeColorClass(type.value);
                  return (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className={`px-2 py-2 rounded-lg text-xs flex flex-col items-center gap-1 transition-all ${
                        selectedType === type.value
                          ? `${colorClass.bg} ${colorClass.text} border ${colorClass.border}`
                          : 'bg-golf-bg text-golf-text-muted border border-golf-border hover:border-golf-border/80'
                      }`}
                    >
                      {type.icon}
                      <span>{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div>
              <div className="text-xs text-golf-text-muted mb-2">数据来源</div>
              <div className="flex gap-2">
                {SOURCE_TYPES.map(source => (
                  <button
                    key={source.value}
                    onClick={() => setSelectedSource(source.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-all ${
                      selectedSource === source.value
                        ? 'bg-golf-blue/20 text-golf-blue border border-golf-blue/50'
                        : 'bg-golf-bg text-golf-text-muted border border-golf-border hover:border-golf-border/80'
                    }`}
                  >
                    {source.icon}
                    {source.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <div className="text-xs text-golf-text-muted mb-2">影响帧范围</div>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <input
                    type="number"
                    value={frameRange.start}
                    onChange={(e) => setFrameRange(prev => ({ ...prev, start: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-golf-bg border border-golf-border rounded px-3 py-2 text-sm text-golf-text outline-none focus:border-golf-blue"
                    placeholder="起始帧"
                    min={0}
                    max={currentSession.frames.length - 1}
                  />
                </div>
                <span className="text-golf-text-muted">至</span>
                <div className="flex-1">
                  <input
                    type="number"
                    value={frameRange.end}
                    onChange={(e) => setFrameRange(prev => ({ ...prev, end: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-golf-bg border border-golf-border rounded px-3 py-2 text-sm text-golf-text outline-none focus:border-golf-blue"
                    placeholder="结束帧"
                    min={0}
                    max={currentSession.frames.length - 1}
                  />
                </div>
              </div>
              <div className="text-xs text-golf-text-dim mt-1">
                当前帧: {selectedFrameIndex}，共 {currentSession.frames.length} 帧
              </div>
            </div>
            
            <div>
              <div className="text-xs text-golf-text-muted mb-2">补录说明</div>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full bg-golf-bg border border-golf-border rounded px-3 py-2 text-sm text-golf-text outline-none focus:border-golf-blue resize-none"
                placeholder="请输入补录内容说明..."
                rows={3}
              />
            </div>
            
            <div>
              <div className="text-xs text-golf-text-muted mb-2">操作人</div>
              <input
                type="text"
                value={supplementedBy}
                onChange={(e) => setSupplementedBy(e.target.value)}
                className="w-full bg-golf-bg border border-golf-border rounded px-3 py-2 text-sm text-golf-text outline-none focus:border-golf-blue"
                placeholder="操作人姓名"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!remark.trim()}
                className="flex-1 px-4 py-2 bg-golf-orange/20 text-golf-orange rounded-lg hover:bg-golf-orange/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                确认补录
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-golf-text-dim/20 text-golf-text-muted rounded-lg hover:bg-golf-text-dim/30 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-golf-text-muted">补录记录</span>
          <span className="text-xs text-golf-orange font-mono">
            共 {currentSession.supplements.length} 条
          </span>
        </div>
      </div>
      
      {currentSession.supplements.length === 0 ? (
        <div className="text-center py-12 text-golf-text-muted">
          <PlusCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无补录记录</p>
          <p className="text-xs mt-1">点击上方按钮添加补录数据</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...currentSession.supplements].reverse().map(supplement => {
            const colorClass = getTypeColorClass(supplement.fieldType);
            return (
              <div 
                key={supplement.supplementId}
                className={`p-3 bg-golf-bg-light border rounded-lg border-l-4 transition-all hover:bg-golf-bg-lighter/50`}
                style={{ borderLeftColor: colorClass.hex }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass.bg} ${colorClass.text}`}>
                    {getTypeIcon(supplement.fieldType)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${colorClass.bg} ${colorClass.text}`}>
                        {getTypeLabel(supplement.fieldType)}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-golf-bg text-golf-text-muted">
                        {getSourceLabel(supplement.source)}
                      </span>
                      <span className="ml-auto text-xs text-golf-text-dim font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(supplement.supplementedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-golf-text mb-2 line-clamp-2">
                      {supplement.remark}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-golf-text-muted">
                        {getFrameRange(supplement.affectedFrames)}
                      </span>
                      <span className="text-golf-text-dim">
                        {supplement.supplementedBy}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-golf-border">
        <div className="text-xs text-golf-text-muted mb-2">补录类型说明</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {SUPPLEMENT_TYPES.map(type => {
            const colorClass = getTypeColorClass(type.value);
            return (
              <div key={type.value} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorClass.hex }} />
                <span className="text-golf-text-muted">{type.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
