import { useState } from 'react';
import { 
  LayoutGrid, Database, FileText, Building2, Lightbulb, 
  Palette, Ruler, Calendar, FileBarChart, Plus, Edit2, 
  Trash2, X, Save, ChevronLeft
} from 'lucide-react';
import { z } from 'zod';
import { useMainStore } from '@/store/mainStore';
import type { Gallery, LightSource, Artwork, SamplingData, Exhibition, ProtectionReport } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const TABS = [
  { key: 'gallery', label: '展厅', icon: Building2 },
  { key: 'lightSource', label: '光源', icon: Lightbulb },
  { key: 'artwork', label: '作品', icon: Palette },
  { key: 'sampling', label: '照度采样', icon: Ruler },
  { key: 'exhibition', label: '展期', icon: Calendar },
  { key: 'report', label: '保护报告', icon: FileBarChart },
];

const gallerySchema = z.object({ name: z.string().min(1).max(100), width: z.number().min(1).max(1000), depth: z.number().min(1).max(1000), height: z.number().min(1).max(100), material: z.string().optional() });
const lightSourceSchema = z.object({ name: z.string().min(1).max(100), type: z.enum(['spot', 'point', 'directional', 'area']), power: z.number().min(0).max(10000), intensity: z.number().min(0).max(100), posX: z.number(), posY: z.number(), posZ: z.number(), colorTemperature: z.number().min(1000).max(10000) });
const artworkSchema = z.object({ name: z.string().min(1).max(200), registrationNo: z.string().min(1), lightResistanceGrade: z.enum(['ISO 15426 Grade 1', 'ISO 15426 Grade 2', 'ISO 15426 Grade 3', 'ISO 15426 Grade 4']), protectionLevel: z.string().min(1), width: z.number().min(0), height: z.number().min(0), posX: z.number(), posY: z.number(), posZ: z.number() });
const samplingSchema = z.object({ samplingPointId: z.string().min(1), measuredValue: z.number().min(0).max(100000), instrumentId: z.string().min(1), instrumentCalibrationStatus: z.enum(['valid', 'expired', 'unknown']), measuredBy: z.string().min(1) });
const exhibitionSchema = z.object({ name: z.string().min(1).max(200), startDate: z.string().min(1), endDate: z.string().min(1), dailyOpenHours: z.number().min(0).max(24), responsiblePerson: z.string().min(1), status: z.enum(['planning', 'ongoing', 'ended']), approvalNo: z.string().optional() });

const SCHEMAS: Record<string, z.ZodSchema> = { gallery: gallerySchema, lightSource: lightSourceSchema, artwork: artworkSchema, sampling: samplingSchema, exhibition: exhibitionSchema };
type DataType = Gallery | LightSource | Artwork | SamplingData | Exhibition | ProtectionReport;

const FIELD_CONFIG: Record<string, Array<{ key: string; label: string; type: string; options?: string[] }>> = {
  gallery: [{ key: 'name', label: '展厅名称', type: 'text' }, { key: 'width', label: '宽度 (m)', type: 'number' }, { key: 'depth', label: '深度 (m)', type: 'number' }, { key: 'height', label: '高度 (m)', type: 'number' }, { key: 'material', label: '材质', type: 'text' }],
  lightSource: [{ key: 'name', label: '光源名称', type: 'text' }, { key: 'type', label: '类型', type: 'select', options: ['spot', 'point', 'directional', 'area'] }, { key: 'power', label: '功率 (W)', type: 'number' }, { key: 'intensity', label: '强度 (%)', type: 'number' }, { key: 'colorTemperature', label: '色温 (K)', type: 'number' }, { key: 'posX', label: '位置 X', type: 'number' }, { key: 'posY', label: '位置 Y', type: 'number' }, { key: 'posZ', label: '位置 Z', type: 'number' }],
  artwork: [{ key: 'name', label: '作品名称', type: 'text' }, { key: 'registrationNo', label: '登记号', type: 'text' }, { key: 'lightResistanceGrade', label: '耐光等级', type: 'select', options: ['ISO 15426 Grade 1', 'ISO 15426 Grade 2', 'ISO 15426 Grade 3', 'ISO 15426 Grade 4'] }, { key: 'protectionLevel', label: '保护等级', type: 'text' }, { key: 'width', label: '宽度 (cm)', type: 'number' }, { key: 'height', label: '高度 (cm)', type: 'number' }, { key: 'posX', label: '位置 X', type: 'number' }, { key: 'posY', label: '位置 Y', type: 'number' }, { key: 'posZ', label: '位置 Z', type: 'number' }],
  sampling: [{ key: 'samplingPointId', label: '采样点ID', type: 'text' }, { key: 'measuredValue', label: '测量值 (lux)', type: 'number' }, { key: 'instrumentId', label: '仪器ID', type: 'text' }, { key: 'instrumentCalibrationStatus', label: '校准状态', type: 'select', options: ['valid', 'expired', 'unknown'] }, { key: 'measuredBy', label: '测量人', type: 'text' }],
  exhibition: [{ key: 'name', label: '展期名称', type: 'text' }, { key: 'startDate', label: '开始日期', type: 'date' }, { key: 'endDate', label: '结束日期', type: 'date' }, { key: 'dailyOpenHours', label: '每日开放时长 (小时)', type: 'number' }, { key: 'responsiblePerson', label: '负责人', type: 'text' }, { key: 'status', label: '状态', type: 'select', options: ['planning', 'ongoing', 'ended'] }, { key: 'approvalNo', label: '审批编号', type: 'text' }],
};

export default function DataManager() {
  const store = useMainStore();
  const [activeTab, setActiveTab] = useState('gallery');
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<DataType | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getData = (): DataType[] => {
    switch (activeTab) {
      case 'gallery': return store.gallery ? [store.gallery] : [];
      case 'lightSource': return store.lightSources;
      case 'artwork': return store.artworks;
      case 'sampling': return store.samplingData;
      case 'exhibition': return store.exhibitions;
      case 'report': return store.reports;
      default: return [];
    }
  };

  const getDefaultData = (): Record<string, unknown> => {
    const now = new Date().toISOString();
    switch (activeTab) {
      case 'gallery': return { name: '', width: 20, depth: 15, height: 4, material: '石膏板' };
      case 'lightSource': return { name: '', type: 'spot', power: 50, intensity: 80, posX: 0, posY: 3, posZ: 0, colorTemperature: 3000 };
      case 'artwork': return { name: '', registrationNo: '', lightResistanceGrade: 'ISO 15426 Grade 3', protectionLevel: '一级', width: 80, height: 100, posX: 0, posY: 1.5, posZ: -5 };
      case 'sampling': return { samplingPointId: '', measuredValue: 200, instrumentId: '', instrumentCalibrationStatus: 'valid', measuredBy: '' };
      case 'exhibition': return { name: '', startDate: now.slice(0, 10), endDate: now.slice(0, 10), dailyOpenHours: 8, responsiblePerson: '', status: 'planning' };
      default: return {};
    }
  };

  const handleAdd = () => { setEditingItem(null); setFormData(getDefaultData()); setErrors({}); setIsEditing(true); };
  const handleEdit = (item: DataType) => { setEditingItem(item); setFormData({ ...item }); setErrors({}); setIsEditing(true); };
  const handleDelete = (id: string) => {
    if (!confirm('确定要删除这条数据吗？')) return;
    if (activeTab === 'artwork') store.deleteArtwork(id);
    if (activeTab === 'lightSource') store.deleteLightSource(id);
    if (activeTab === 'exhibition') store.updateExhibition(id, { status: 'ended' });
  };

  const handleSave = () => {
    const schema = SCHEMAS[activeTab];
    if (!schema) return;
    const result = schema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => { newErrors[issue.path.join('.')] = issue.message; });
      setErrors(newErrors);
      return;
    }
    const now = new Date().toISOString();
    const idempotencyKey = uuidv4();
    const data = result.data as Record<string, unknown>;
    switch (activeTab) {
      case 'gallery':
        store.setGallery({ id: editingItem?.id || uuidv4(), walls: [], createdBy: '当前用户', createdAt: (editingItem as Gallery)?.createdAt || now, lastModifiedBy: '当前用户', lastModifiedAt: now, ...data } as Gallery);
        break;
      case 'lightSource':
        if (editingItem) {
          store.updateLightSource(editingItem.id, data);
        } else {
          store.addLightSource({ id: uuidv4(), galleryId: store.gallery?.id || '', angleX: 0, angleY: 0, angleZ: 0, beamAngle: 30, createdBy: '当前用户', createdAt: now, ...data } as LightSource, idempotencyKey);
        }
        break;
      case 'artwork':
        if (editingItem) {
          store.updateArtwork(editingItem.id, data);
        } else {
          store.addArtwork({ id: uuidv4(), galleryId: store.gallery?.id || '', exhibitionId: store.currentExhibition?.id, createdBy: '当前用户', createdAt: now, ...data } as Artwork, idempotencyKey);
        }
        break;
      case 'sampling':
        store.addSamplingData({ id: uuidv4(), measuredAt: now, ...data } as SamplingData, idempotencyKey);
        break;
      case 'exhibition':
        if (editingItem) {
          store.updateExhibition(editingItem.id, data);
        } else {
          store.addExhibition({ id: uuidv4(), createdBy: '当前用户', createdAt: now, ...data } as Exhibition, idempotencyKey);
        }
        break;
    }
    setIsEditing(false);
    setEditingItem(null);
  };

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const navigate = (path: string) => { window.location.href = path; };
  const data = getData();
  const activeTabInfo = TABS.find(t => t.key === activeTab)!;

  if (isEditing) {
    const fields = FIELD_CONFIG[activeTab] || [];
    const tabLabel = TABS.find(t => t.key === activeTab)?.label || '';
    return (
      <div className="h-screen bg-[var(--color-bg-primary)] overflow-auto">
        <header className="h-14 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 flex items-center gap-4">
          <button className="btn btn-ghost" onClick={() => setIsEditing(false)}><ChevronLeft className="w-4 h-4" /> 返回</button>
          <h1 className="text-lg font-semibold">{editingItem ? '编辑' : '新增'}{tabLabel}</h1>
          <div className="flex-1" />
          <button className="btn btn-secondary" onClick={() => setIsEditing(false)}><X className="w-4 h-4" /> 取消</button>
          <button className="btn btn-primary" onClick={handleSave}><Save className="w-4 h-4" /> 保存</button>
        </header>
        <div className="max-w-2xl mx-auto p-6">
          <div className="card p-6 space-y-4">
            {fields.map(field => (
              <div key={field.key}>
                <label className="label">{field.label}</label>
                {field.type === 'select' ? (
                  <select className={`input ${errors[field.key] ? 'input-error' : ''}`} value={String(formData[field.key] || '')} onChange={e => handleInputChange(field.key, e.target.value)}>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input type={field.type} className={`input ${errors[field.key] ? 'input-error' : ''}`} value={String(formData[field.key] ?? '')} onChange={e => handleInputChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)} />
                )}
                {errors[field.key] && <p className="text-xs text-red-400 mt-1">{errors[field.key]}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
      <header className="h-14 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2"><Database className="w-6 h-6 text-blue-400" /><span className="font-semibold text-lg">数据管理</span></div>
          <div className="h-6 w-px bg-[var(--color-border)]" />
          <nav className="flex items-center gap-1">
            <button className="btn btn-ghost" onClick={() => navigate('/')}><LayoutGrid className="w-4 h-4" /> 工作台</button>
            <button className="btn btn-primary"><Database className="w-4 h-4" /> 数据管理</button>
            <button className="btn btn-ghost" onClick={() => navigate('/report')}><FileText className="w-4 h-4" /> 报告预览</button>
          </nav>
        </div>
        {activeTab !== 'report' && <button className="btn btn-primary" onClick={handleAdd}><Plus className="w-4 h-4" /> 新增</button>}
      </header>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-48 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex-shrink-0">
          <nav className="p-2 space-y-1">
            {TABS.map(tab => (
              <button key={tab.key} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${activeTab === tab.key ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}`} onClick={() => setActiveTab(tab.key)}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-auto p-6">
          <div className="card">
            <div className="px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-semibold">{activeTabInfo.label}列表</h2>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">共 {data.length} 条记录</p>
            </div>
            {data.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-muted)]"><p>暂无数据</p><p className="text-sm mt-2">点击右上角按钮添加新数据</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-[var(--color-border)]"><th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-secondary)]">名称</th><th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-secondary)]">操作</th></tr></thead>
                  <tbody>
                    {data.map(item => (
                      <tr key={item.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]">
                        <td className="py-3 px-4">
                          <div className="font-medium text-[var(--color-text-primary)]">{'name' in item ? item.name : 'reportNo' in item ? item.reportNo : item.id}</div>
                          <div className="text-xs text-[var(--color-text-tertiary)] mt-1">ID: {item.id.slice(0, 8)}...</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {activeTab !== 'report' && (
                              <>
                                <button className="btn btn-ghost p-1" onClick={() => handleEdit(item)}><Edit2 className="w-4 h-4" /></button>
                                {activeTab !== 'gallery' && <button className="btn btn-ghost p-1 text-red-400 hover:text-red-300" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></button>}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
