import { useState } from 'react';
import {
  Package,
  FileText,
  MessageSquare,
  FileEdit,
  Plus,
  Search,
  ChevronRight,
  Link,
  Zap,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { MaterialChange, BimNote, CollisionPoint, TrackingStatus } from '../types';
import StatusBadge from './StatusBadge';

interface TrackingProps {
  materialChanges: MaterialChange[];
  bimNotes: BimNote[];
  collisions: CollisionPoint[];
}

export default function Tracking({ materialChanges, bimNotes, collisions }: TrackingProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrackingStatus | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'source'>('overview');

  const filtered = materialChanges.filter((item) => {
    if (item.isBadData) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchTerm && !item.title.includes(searchTerm) && !item.description.includes(searchTerm)) return false;
    return true;
  });

  const selected = materialChanges.find((m) => m.id === selectedId);
  const relatedBimNote = selected ? bimNotes.find((b) => b.id === selected.bimNoteId) : null;
  const relatedCollisions = selected
    ? collisions.filter((c) => selected.collisionPointIds.includes(c.id))
    : [];

  const statusCounts = {
    pending: materialChanges.filter((m) => m.status === 'pending' && !m.isBadData).length,
    confirmed: materialChanges.filter((m) => m.status === 'confirmed' && !m.isBadData).length,
    supplement: materialChanges.filter((m) => m.status === 'supplement' && !m.isBadData).length,
    returned: materialChanges.filter((m) => m.status === 'returned' && !m.isBadData).length,
  };

  return (
    <div className="h-full flex">
      <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3">材料追踪列表</h3>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索变更..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-4 gap-1">
            <StatusFilter
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
              label="全部"
              count={filtered.length}
            />
            <StatusFilter
              active={statusFilter === 'pending'}
              onClick={() => setStatusFilter('pending')}
              label="待确认"
              count={statusCounts.pending}
              color="amber"
            />
            <StatusFilter
              active={statusFilter === 'confirmed'}
              onClick={() => setStatusFilter('confirmed')}
              label="已确认"
              count={statusCounts.confirmed}
              color="green"
            />
            <StatusFilter
              active={statusFilter === 'supplement'}
              onClick={() => setStatusFilter('supplement')}
              label="待补件"
              count={statusCounts.supplement}
              color="blue"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedId === item.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-white border border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 line-clamp-1">{item.title}</p>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400">
                  {item.materials.length} 项材料 · {item.author}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(item.updatedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {selected ? (
          <>
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{selected.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selected.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  {selected.changedJudgements.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                      <AlertCircle size={12} />
                      判断变更 {selected.changedJudgements.length}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-1 mt-4 border-b border-slate-200 -mx-4 px-4">
                <TabButton
                  active={activeTab === 'overview'}
                  onClick={() => setActiveTab('overview')}
                  icon={FileText}
                  label="总览"
                />
                <TabButton
                  active={activeTab === 'materials'}
                  onClick={() => setActiveTab('materials')}
                  icon={Package}
                  label={`材料明细 (${selected.materials.length})`}
                />
                <TabButton
                  active={activeTab === 'source'}
                  onClick={() => setActiveTab('source')}
                  icon={Link}
                  label="来源追溯"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeTab === 'overview' && (
                <OverviewTab item={selected} relatedBimNote={relatedBimNote} relatedCollisions={relatedCollisions} />
              )}
              {activeTab === 'materials' && <MaterialsTab materials={selected.materials} />}
              {activeTab === 'source' && (
                <SourceTab
                  item={selected}
                  relatedBimNote={relatedBimNote}
                  relatedCollisions={relatedCollisions}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Package size={48} className="mx-auto mb-3 opacity-50" />
              <p>选择一条材料追踪记录</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ item, relatedBimNote, relatedCollisions }: any) {
  return (
    <div className="p-5 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <InfoCard icon={FileEdit} title="场景标注" content={item.sceneAnnotation} />
          <InfoCard icon={MessageSquare} title="侧边说明" content={item.sideNote} />
          <InfoCard icon={FileText} title="页面摘要" content={item.pageSummary} />
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-slate-700 mb-3">基本信息</h4>
            <div className="space-y-2 text-sm">
              <InfoRow label="创建人" value={item.author} />
              <InfoRow label="审核人" value={item.reviewer || '待审核'} />
              <InfoRow
                label="创建时间"
                value={new Date(item.createdAt).toLocaleDateString('zh-CN')}
              />
              <InfoRow
                label="更新时间"
                value={new Date(item.updatedAt).toLocaleDateString('zh-CN')}
              />
              {item.reviewedAt && (
                <InfoRow
                  label="审核时间"
                  value={new Date(item.reviewedAt).toLocaleDateString('zh-CN')}
                />
              )}
            </div>
          </div>

          {relatedBimNote && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                <FileText size={14} />
                关联BIM备注
              </h4>
              <p className="text-sm text-blue-700 font-medium">{relatedBimNote.title}</p>
              <p className="text-xs text-blue-600 mt-1 line-clamp-2">{relatedBimNote.content}</p>
            </div>
          )}

          {relatedCollisions.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                <Zap size={14} />
                关联碰撞点 ({relatedCollisions.length})
              </h4>
              <div className="space-y-2">
                {relatedCollisions.map((c: any) => (
                  <div key={c.id} className="text-sm text-amber-700 flex items-center gap-2">
                    <ChevronRight size={12} />
                    {c.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {item.changedJudgements.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <h4 className="text-sm font-medium text-purple-800 mb-3 flex items-center gap-2">
            <AlertCircle size={16} />
            改变了哪些判断（周一早会重点）
          </h4>
          <ul className="space-y-2">
            {item.changedJudgements.map((judgement: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                {judgement}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MaterialsTab({ materials }: { materials: any[] }) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-slate-800">材料明细</h4>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={14} />
          添加材料
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                材料名称
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                规格
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                数量
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                单位
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                变更原因
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                原材料
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {materials.map((mat) => (
              <tr key={mat.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{mat.name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{mat.spec}</td>
                <td className="px-4 py-3 text-sm text-right text-slate-700 font-medium">
                  {mat.quantity}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{mat.unit}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{mat.changeReason}</td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {mat.originalMaterial || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourceTab({ item, relatedBimNote, relatedCollisions }: any) {
  return (
    <div className="p-5 space-y-6">
      <div className="bg-slate-50 rounded-xl p-5">
        <h4 className="font-medium text-slate-800 mb-4">溯源链</h4>
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div className="w-0.5 h-12 bg-blue-200" />
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <Zap size={18} />
            </div>
            <div className="w-0.5 h-12 bg-amber-200" />
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
              <Package size={18} />
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <div>
              <p className="text-sm font-medium text-slate-800">BIM模型备注</p>
              {relatedBimNote ? (
                <>
                  <p className="text-sm text-slate-600 mt-1">{relatedBimNote.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {relatedBimNote.author} · {new Date(relatedBimNote.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400 mt-1">未关联</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">碰撞点 ({relatedCollisions.length})</p>
              {relatedCollisions.length > 0 ? (
                <div className="space-y-1 mt-1">
                  {relatedCollisions.map((c: any) => (
                    <p key={c.id} className="text-sm text-slate-600">
                      · {c.name}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 mt-1">无关联碰撞点</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">施工变更材料追踪</p>
              <p className="text-sm text-slate-600 mt-1">{item.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {item.author} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h4 className="font-medium text-slate-800 mb-3">原始记录编号</h4>
        <p className="text-sm font-mono text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
          {item.id}
        </p>
        {item.originalRecordId && (
          <>
            <p className="text-xs text-slate-500 mt-3">关联原始BIM备注</p>
            <p className="text-sm font-mono text-slate-600 mt-1">{item.originalRecordId}</p>
          </>
        )}
      </div>
    </div>
  );
}

function StatusFilter({ active, onClick, label, count, color }: any) {
  const colorClasses: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
  };

  return (
    <button
      onClick={onClick}
      className={`py-1.5 text-xs rounded-md transition-colors ${
        active ? color ? colorClasses[color] : 'bg-slate-200 text-slate-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
      <span className="block text-[10px] mt-0.5">{count}</span>
    </button>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function InfoCard({ icon: Icon, title, content }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-blue-600" />
        <h4 className="text-sm font-medium text-slate-800">{title}</h4>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{content}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700 font-medium">{value}</span>
    </div>
  );
}
