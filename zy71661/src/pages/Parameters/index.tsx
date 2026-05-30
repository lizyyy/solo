import { useState, useCallback } from 'react';
import { useSimulationStore } from '@/store/useSimulationStore';
import { useUIStore } from '@/store/useUIStore';
import { ChevronDown, ChevronRight, Upload, FileText, Mic, Edit3 } from 'lucide-react';
import type { PhysicsParams, Attachment, Note } from '@/types/simulation';

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-white">{title}</span>
        {open ? <ChevronDown size={16} className="text-primary-300" /> : <ChevronRight size={16} className="text-primary-300" />}
      </button>
      {open && <div className="border-t border-primary-700/30 px-4 py-3">{children}</div>}
    </div>
  );
}

function SliderField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-primary-200">{label}</label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="input-field w-24 text-right text-xs py-1"
          step={step}
          min={min}
          max={max}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 appearance-none bg-primary-700 rounded-full accent-accent-400 cursor-pointer"
      />
    </div>
  );
}

function NumberField({ label, value, step, min, onChange }: { label: string; value: number; step?: number; min?: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-4">
      <label className="text-xs text-primary-200 mb-1 block">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="input-field w-full text-sm"
        step={step}
        min={min}
      />
    </div>
  );
}

export default function Parameters() {
  const { currentSimulation, updatePhysicsParams, addNote, addAttachment } = useSimulationStore();
  const { setShowSupplementModal } = useUIStore();
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<Note['type']>('student');
  const [noteVerbal, setNoteVerbal] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleParamChange = useCallback(
    (key: keyof PhysicsParams, value: number) => {
      updatePhysicsParams({ [key]: value });
    },
    [updatePhysicsParams]
  );

  if (!currentSimulation) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-primary-300">尚未创建模拟，请先新建模拟</p>
      </div>
    );
  }

  const params = currentSimulation.physicsParams;
  const dataPoints = currentSimulation.dataPoints;

  const handleAddNote = () => {
    if (!noteContent.trim()) return;
    addNote(noteContent, noteType, '当前用户', noteVerbal);
    setNoteContent('');
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((f) => {
      const type: Attachment['type'] = f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('video/') ? 'video' : 'document';
      addAttachment(f.name, type, URL.createObjectURL(f), f.size, '当前用户');
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => {
      const type: Attachment['type'] = f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('video/') ? 'video' : 'document';
      addAttachment(f.name, type, URL.createObjectURL(f), f.size, '当前用户');
    });
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <CollapsibleSection title="基础参数" defaultOpen>
        <SliderField
          label="坡道角度 (°)"
          value={params.rampAngle}
          min={1}
          max={89}
          step={1}
          onChange={(v) => handleParamChange('rampAngle', v)}
        />
        <NumberField
          label="坡道长度 (m)"
          value={params.rampLength}
          step={0.1}
          min={0.1}
          onChange={(v) => handleParamChange('rampLength', v)}
        />
        <NumberField
          label="滑板质量 (kg)"
          value={params.skateboardMass}
          step={0.1}
          min={0.01}
          onChange={(v) => handleParamChange('skateboardMass', v)}
        />
      </CollapsibleSection>

      <CollapsibleSection title="摩擦参数">
        <SliderField
          label="摩擦系数"
          value={params.frictionCoeff}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => handleParamChange('frictionCoeff', v)}
        />
        <NumberField
          label="空气阻力系数"
          value={params.airDragCoeff}
          step={0.01}
          min={0}
          onChange={(v) => handleParamChange('airDragCoeff', v)}
        />
      </CollapsibleSection>

      <CollapsibleSection title="环境参数">
        <NumberField
          label="重力加速度 (m/s²)"
          value={params.gravity}
          step={0.01}
          min={0.01}
          onChange={(v) => handleParamChange('gravity', v)}
        />
        <NumberField
          label="迎风面积 (m²)"
          value={params.frontalArea}
          step={0.01}
          min={0}
          onChange={(v) => handleParamChange('frontalArea', v)}
        />
        <NumberField
          label="空气密度 (kg/m³)"
          value={params.airDensity}
          step={0.001}
          min={0}
          onChange={(v) => handleParamChange('airDensity', v)}
        />
      </CollapsibleSection>

      <CollapsibleSection title="数据补录">
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-primary-700/30">
                <th className="py-2 text-left text-primary-300 font-medium">时间(s)</th>
                <th className="py-2 text-right text-primary-300 font-medium">位置(m)</th>
                <th className="py-2 text-right text-primary-300 font-medium">速度(m/s)</th>
                <th className="py-2 text-center text-primary-300 font-medium">补录</th>
              </tr>
            </thead>
            <tbody>
              {dataPoints.filter((_, i) => i % 10 === 0 || _.isSupplemented).map((d) => (
                <tr
                  key={d.id}
                  className={`border-b border-primary-700/10 ${d.isSupplemented ? 'bg-accent-400/10' : ''}`}
                >
                  <td className="py-1.5 text-primary-200">
                    {d.timestamp.toFixed(2)}
                    {d.isSupplemented && <span className="badge-supplement ml-1">补</span>}
                  </td>
                  <td className="py-1.5 text-right text-primary-200">{d.position.toFixed(3)}</td>
                  <td className="py-1.5 text-right text-primary-200">{d.velocity.toFixed(3)}</td>
                  <td className="py-1.5 text-center">
                    <button
                      onClick={() => setShowSupplementModal(true, d.id)}
                      className="text-primary-300 hover:text-accent-400 transition-colors"
                    >
                      <Edit3 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="附件管理">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center mb-3 transition-colors ${
            dragOver ? 'border-accent-400 bg-accent-400/10' : 'border-primary-600/30'
          }`}
        >
          <Upload size={24} className="mx-auto mb-2 text-primary-300" />
          <p className="text-xs text-primary-300 mb-2">拖放文件到此处上传</p>
          <label className="btn-primary text-xs cursor-pointer inline-block">
            选择文件
            <input type="file" multiple className="hidden" onChange={handleFileSelect} />
          </label>
        </div>
        {currentSimulation.attachments.length > 0 && (
          <div className="space-y-2">
            {currentSimulation.attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg bg-primary-800/50 px-3 py-2">
                <FileText size={14} className="text-primary-300" />
                <span className="text-xs text-primary-200 flex-1 truncate">{a.name}</span>
                <span className="text-xs text-primary-400">{(a.size / 1024).toFixed(1)}KB</span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="备注">
        <div className="mb-3">
          <div className="flex gap-2 mb-2">
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as Note['type'])}
              className="input-field text-xs py-1 px-2"
            >
              <option value="student">学生备注</option>
              <option value="teacher">教师备注</option>
              <option value="analysis">分析备注</option>
              <option value="verbal">口头备注</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-primary-200 cursor-pointer">
              <input
                type="checkbox"
                checked={noteVerbal}
                onChange={(e) => setNoteVerbal(e.target.checked)}
                className="accent-accent-400"
              />
              <Mic size={12} />
              口头
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="输入备注内容..."
              className="input-field flex-1 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <button onClick={handleAddNote} className="btn-primary text-sm">
              添加
            </button>
          </div>
        </div>
        {currentSimulation.notes.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {currentSimulation.notes.map((n) => (
              <div key={n.id} className="rounded-lg bg-primary-800/50 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-accent-400">{n.type}</span>
                  {n.isVerbal && <Mic size={10} className="text-accent-400" />}
                  <span className="text-xs text-primary-400 ml-auto">{n.createdAt.slice(0, 16)}</span>
                </div>
                <p className="text-xs text-primary-200">{n.content}</p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
