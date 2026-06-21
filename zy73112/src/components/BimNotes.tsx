import { useState } from 'react';
import {
  Plus,
  Search,
  Tag,
  Clock,
  User,
  Trash2,
  FileText,
  X,
  Send,
  Sparkles,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Zap,
  Package,
} from 'lucide-react';
import type { BimNote, ChangeImpactResult } from '../types';

interface BimNotesProps {
  notes: BimNote[];
  selectedNoteId?: string;
  onSelectNote?: (note: BimNote) => void;
  onAddNote?: (note: BimNote) => ChangeImpactResult | void;
  impactResult?: ChangeImpactResult | null;
}

const tagOptions = ['机电', '碰撞', 'B2层', '装修', '材料变更', '1层', '结构', '钢结构', '屋面', '建筑', '车库', 'B1层', '外墙', '保温'];

export default function BimNotes({
  notes,
  selectedNoteId,
  onSelectNote,
  onAddNote,
  impactResult,
}: BimNotesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedNote, setSelectedNote] = useState<BimNote | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: [] as string[],
    modelVersion: 'v2.4.0',
    author: '小赵',
  });
  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImpact, setShowImpact] = useState(false);

  const filteredNotes = notes.filter((note) => {
    if (!showDeleted && note.isDeleted) return false;
    if (searchTerm && !note.title.includes(searchTerm) && !note.content.includes(searchTerm))
      return false;
    return true;
  });

  const activeCount = notes.filter((n) => !n.isDeleted).length;
  const deletedCount = notes.filter((n) => n.isDeleted).length;

  const handleNoteClick = (note: BimNote) => {
    setSelectedNote(note);
    onSelectNote?.(note);
  };

  const handleTagToggle = (tag: string) => {
    if (formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
    } else {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
  };

  const handleAddCustomTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    setIsSubmitting(true);

    const newNote: BimNote = {
      id: `bn-${Date.now()}`,
      title: formData.title,
      content: formData.content,
      author: formData.author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modelVersion: formData.modelVersion,
      tags: formData.tags,
      isDeleted: false,
      location: { x: 120 + Math.random() * 30, y: -80 - Math.random() * 30, z: 30 + Math.random() * 10 },
    };

    onAddNote?.(newNote);

    setTimeout(() => {
      setIsSubmitting(false);
      setShowImpact(true);
      setFormData({ title: '', content: '', tags: [], modelVersion: 'v2.4.0', author: '小赵' });
      setShowAddForm(false);
    }, 800);
  };

  const displayNote = selectedNoteId
    ? notes.find((n) => n.id === selectedNoteId) || selectedNote
    : selectedNote;

  return (
    <div className="h-full flex">
      <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">BIM模型备注</h3>
            <button
              onClick={() => setShowAddForm(true)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="新增备注"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="搜索备注..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowDeleted(false)}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                !showDeleted
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              有效 ({activeCount})
            </button>
            <button
              onClick={() => setShowDeleted(true)}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                showDeleted
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              已作废 ({deletedCount})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              onClick={() => handleNoteClick(note)}
              className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                displayNote?.id === note.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-white border border-slate-200 hover:border-blue-300'
              } ${note.isDeleted ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-800 line-clamp-1">
                  {note.title}
                </p>
                {note.isDeleted && (
                  <Trash2 size={14} className="text-slate-400 flex-shrink-0 ml-2" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{note.content}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <User size={12} />
                  {note.author}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(note.updatedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {note.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
                  >
                    <Tag size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white">
        {showAddForm ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <Plus size={22} className="text-blue-600" />
                新增BIM备注
              </h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-w-2xl space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  备注标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例如：B2层机电管线碰撞调整"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  备注内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="描述变更内容、位置、影响等..."
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  提交后系统将自动分析此备注对碰撞点和材料的影响
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">标签</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tagOptions.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleTagToggle(tag)}
                      className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                        formData.tags.includes(tag)
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                    placeholder="自定义标签"
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddCustomTag}
                    className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    添加
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    模型版本
                  </label>
                  <input
                    type="text"
                    value={formData.modelVersion}
                    onChange={(e) =>
                      setFormData({ ...formData, modelVersion: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    录入人
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.title.trim() || !formData.content.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Sparkles size={16} className="animate-pulse" />
                      分析影响中...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      提交并分析影响
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : showImpact && impactResult ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setShowImpact(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <ChevronRight size={18} className="rotate-180" />
              </button>
              <h2 className="text-xl font-semibold text-slate-800">变更影响分析</h2>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} className="text-green-600" />
                <p className="text-sm font-medium text-green-800">
                  系统已自动分析备注对碰撞点和材料追踪的影响
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <ImpactCard
                icon={Zap}
                label="新增碰撞点"
                value={impactResult.newCollisions.length}
                color="red"
                subtitle="待人工确认"
              />
              <ImpactCard
                icon={AlertCircle}
                label="疑似重复"
                value={impactResult.duplicateCollisions.length}
                color="amber"
                subtitle="需确认后合并"
              />
              <ImpactCard
                icon={Package}
                label="影响材料记录"
                value={impactResult.affectedMaterialChanges.length}
                color="blue"
                subtitle="已自动关联"
              />
            </div>

            {impactResult.newJudgements.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6">
                <h4 className="font-medium text-purple-800 mb-3 flex items-center gap-2">
                  <Sparkles size={16} />
                  改变了哪些判断
                </h4>
                <ul className="space-y-2">
                  {impactResult.newJudgements.map((j, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-purple-700"
                    >
                      <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                      {j}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h4 className="font-medium text-slate-700 mb-2">场景标注（自动生成）</h4>
                <p className="text-sm text-slate-600">{impactResult.updatedSceneAnnotation}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h4 className="font-medium text-slate-700 mb-2">侧边说明（自动生成）</h4>
                <p className="text-sm text-slate-600">{impactResult.updatedSideNote}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h4 className="font-medium text-slate-700 mb-2">页面摘要（自动生成）</h4>
                <p className="text-sm text-slate-600">{impactResult.updatedPageSummary}</p>
              </div>
            </div>

            <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <span className="font-medium">提示：</span>
                以上内容由系统基于BIM备注自动生成，三者保持一致。切换视角或修改数据时会同步更新。
              </p>
            </div>
          </div>
        ) : displayNote ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                  {displayNote.title}
                </h2>
                {displayNote.isDeleted && (
                  <span className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded-full">
                    已作废
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <User size={14} />
                  {displayNote.author}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  更新于 {new Date(displayNote.updatedAt).toLocaleString('zh-CN')}
                </span>
                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                  模型版本：{displayNote.modelVersion}
                </span>
              </div>
            </div>

            {displayNote.isDeleted && displayNote.deletedReason && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">作废原因：</span>
                  {displayNote.deletedReason}
                </p>
              </div>
            )}

            <div className="prose prose-sm max-w-none">
              <h4 className="text-sm font-medium text-slate-700 mb-2">备注内容</h4>
              <p className="text-sm text-slate-600 leading-relaxed">{displayNote.content}</p>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-slate-700 mb-2">标签</h4>
              <div className="flex flex-wrap gap-2">
                {displayNote.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-slate-100 text-slate-700 rounded-full"
                  >
                    <Tag size={12} />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-3">溯源信息</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">创建时间</p>
                  <p className="text-slate-700 mt-1">
                    {new Date(displayNote.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">备注编号</p>
                  <p className="text-slate-700 mt-1 font-mono">{displayNote.id}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <FileText size={48} className="mb-3 opacity-50" />
            <p className="mb-4">选择一条BIM备注查看详情</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              新增备注
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImpactCard({ icon: Icon, label, value, color, subtitle }: any) {
  const colorClasses: Record<string, string> = {
    red: 'bg-red-50 text-red-600 border-red-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs opacity-75 mt-1">{subtitle}</p>
    </div>
  );
}
