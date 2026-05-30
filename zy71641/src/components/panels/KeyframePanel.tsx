import { useState } from 'react';
import { Bookmark, Plus, MapPin, Trash2, Edit3, X, Check } from 'lucide-react';
import { useSwingStore } from '@/store/useSwingStore';
import { Keyframe } from '@/types';

const KEYFRAME_COLORS = [
  { name: '霓虹绿', value: '#00FF88' },
  { name: '霓虹橙', value: '#FF8800' },
  { name: '霓虹蓝', value: '#00AAFF' },
  { name: '霓虹红', value: '#FF3366' },
  { name: '霓虹紫', value: '#AA66FF' },
  { name: '霓虹黄', value: '#FFDD00' },
];

interface KeyframeCardProps {
  keyframe: Keyframe;
  frameIndex: number;
  isSelected: boolean;
  onSelect: () => void;
  onLocate: () => void;
  onDelete: () => void;
}

function KeyframeCard({ keyframe, frameIndex, isSelected, onSelect, onLocate, onDelete }: KeyframeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(keyframe.label);
  const [editNote, setEditNote] = useState(keyframe.note);
  
  const bgColor = isSelected 
    ? 'bg-golf-blue/10 border-golf-blue' 
    : 'bg-golf-bg border-golf-border hover:border-golf-border/80';
  
  return (
    <div 
      className={`${bgColor} border rounded-lg p-3 mb-2 cursor-pointer transition-all`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: keyframe.color + '30', color: keyframe.color }}
        >
          <Bookmark className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="w-full bg-golf-bg-light border border-golf-border rounded px-2 py-1 text-sm text-golf-text outline-none focus:border-golf-blue"
                placeholder="关键帧标签"
                autoFocus
              />
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full bg-golf-bg-light border border-golf-border rounded px-2 py-1 text-xs text-golf-text outline-none focus:border-golf-blue resize-none"
                placeholder="备注"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
                  className="flex-1 text-xs px-2 py-1 bg-golf-green/20 text-golf-green rounded hover:bg-golf-green/30 transition-colors flex items-center justify-center gap-1"
                >
                  <Check className="w-3 h-3" /> 保存
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditLabel(keyframe.label); setEditNote(keyframe.note); }}
                  className="flex-1 text-xs px-2 py-1 bg-golf-text-dim/20 text-golf-text-muted rounded hover:bg-golf-text-dim/30 transition-colors flex items-center justify-center gap-1"
                >
                  <X className="w-3 h-3" /> 取消
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: keyframe.color }}
                />
                <span className="font-medium text-sm text-golf-text">
                  {keyframe.label}
                </span>
                <span className="ml-auto text-xs text-golf-text-muted font-mono">
                  帧 {frameIndex}
                </span>
              </div>
              
              {keyframe.note && (
                <p className="text-xs text-golf-text-muted mb-2 line-clamp-2">
                  {keyframe.note}
                </p>
              )}
              
              <div className="text-[10px] text-golf-text-dim mb-2">
                {new Date(keyframe.createdAt).toLocaleString()}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onLocate(); }}
                  className="flex-1 text-xs px-2 py-1 bg-golf-blue/20 text-golf-blue rounded hover:bg-golf-blue/30 transition-colors flex items-center justify-center gap-1"
                >
                  <MapPin className="w-3 h-3" /> 定位
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                  className="flex-1 text-xs px-2 py-1 bg-golf-orange/20 text-golf-orange rounded hover:bg-golf-orange/30 transition-colors flex items-center justify-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> 编辑
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="flex-1 text-xs px-2 py-1 bg-golf-red/20 text-golf-red rounded hover:bg-golf-red/30 transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> 删除
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function KeyframePanel() {
  const { 
    currentSession, 
    activePanel,
    selectedFrameIndex,
    selectedKeyframeId,
    setSelectedKeyframeId,
    addKeyframe,
    flyToFrame,
  } = useSwingStore();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newNote, setNewNote] = useState('');
  const [selectedColor, setSelectedColor] = useState(KEYFRAME_COLORS[0].value);
  
  if (!currentSession || activePanel !== 'keyframes') return null;
  
  const keyframes = currentSession.keyframes;
  
  const getFrameIndex = (frameId: string) => {
    return currentSession.frames.findIndex(f => f.frameId === frameId);
  };
  
  const handleAddKeyframe = () => {
    if (!newLabel.trim()) return;
    
    const currentFrame = currentSession.frames[selectedFrameIndex];
    addKeyframe({
      frameId: currentFrame.frameId,
      label: newLabel.trim(),
      color: selectedColor,
      note: newNote.trim(),
    });
    
    setNewLabel('');
    setNewNote('');
    setShowAddForm(false);
  };
  
  const handleLocate = (keyframe: Keyframe) => {
    const idx = getFrameIndex(keyframe.frameId);
    if (idx >= 0) flyToFrame(idx);
  };
  
  const handleDelete = (keyframeId: string) => {
    // 更新session，移除keyframe
    const updatedKeyframes = currentSession.keyframes.filter(k => k.keyframeId !== keyframeId);
    // 通过updateSession更新
  };
  
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <Bookmark className="w-5 h-5 text-golf-green" />
        <h2 className="text-lg font-semibold text-golf-text">关键帧标注</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="ml-auto px-3 py-1.5 bg-golf-green/20 text-golf-green text-xs rounded hover:bg-golf-green/30 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> 添加
        </button>
      </div>
      
      {showAddForm && (
        <div className="mb-4 p-3 bg-golf-bg-light border border-golf-blue/30 rounded-lg animate-slideDown">
          <div className="text-xs text-golf-blue mb-2">
            在帧 {selectedFrameIndex} 添加关键帧
          </div>
          
          <div className="space-y-3">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full bg-golf-bg border border-golf-border rounded px-3 py-2 text-sm text-golf-text outline-none focus:border-golf-blue"
              placeholder="关键帧标签（如：上杆顶点、击球瞬间）"
            />
            
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="w-full bg-golf-bg border border-golf-border rounded px-3 py-2 text-sm text-golf-text outline-none focus:border-golf-blue resize-none"
              placeholder="备注说明"
              rows={2}
            />
            
            <div>
              <div className="text-xs text-golf-text-muted mb-2">选择颜色</div>
              <div className="flex gap-2">
                {KEYFRAME_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setSelectedColor(color.value)}
                    className={`w-6 h-6 rounded-full transition-all ${
                      selectedColor === color.value 
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-golf-bg-light scale-110' 
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleAddKeyframe}
                disabled={!newLabel.trim()}
                className="flex-1 px-3 py-2 bg-golf-green/20 text-golf-green text-sm rounded hover:bg-golf-green/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认添加
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 bg-golf-text-dim/20 text-golf-text-muted text-sm rounded hover:bg-golf-text-dim/30 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      
      {keyframes.length === 0 ? (
        <div className="text-center py-12 text-golf-text-muted">
          <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无关键帧</p>
          <p className="text-xs mt-1">点击上方按钮添加关键帧标注</p>
        </div>
      ) : (
        <div className="space-y-1">
          {keyframes.map(keyframe => (
            <KeyframeCard
              key={keyframe.keyframeId}
              keyframe={keyframe}
              frameIndex={getFrameIndex(keyframe.frameId)}
              isSelected={selectedKeyframeId === keyframe.keyframeId}
              onSelect={() => setSelectedKeyframeId(keyframe.keyframeId)}
              onLocate={() => handleLocate(keyframe)}
              onDelete={() => handleDelete(keyframe.keyframeId)}
            />
          ))}
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-golf-border">
        <div className="text-xs text-golf-text-muted mb-2">快速跳转</div>
        <div className="flex flex-wrap gap-2">
          {keyframes.map(k => {
            const idx = getFrameIndex(k.frameId);
            return (
              <button
                key={k.keyframeId}
                onClick={() => flyToFrame(idx)}
                className="px-2 py-1 text-xs rounded flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: k.color + '20', color: k.color }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: k.color }} />
                {k.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
