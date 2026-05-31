import React, { useState } from 'react';
import { 
  FileDown, 
  FileText, 
  Lightbulb, 
  Download,
  Eye,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/StatusBadge';
import { exportToExcel, getStatusLabel, getSourceLabel } from '../utils';

const ExportSettings: React.FC = () => {
  const { records, curationNotes, lightingSchemes, getStatistics, currentUser } = useStore();
  const [activeTab, setActiveTab] = useState<'export' | 'notes' | 'schemes'>('export');
  const [showPreview, setShowPreview] = useState(false);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);

  const stats = getStatistics();

  const handleExport = () => {
    const exportData = records.map(record => ({
      '材料编号': record.materialCode,
      '作品名称': record.name,
      '展墙位置': record.location,
      '来源': getSourceLabel(record.source),
      '当前状态': getStatusLabel(record.currentStatus),
      '版本号': `v${record.versions.length}`,
      '创建人': record.createdBy,
      '创建时间': record.createdAt,
      '最后修改人': record.updatedBy,
      '最后修改时间': record.updatedAt,
      '最新备注': record.versions[record.versions.length - 1]?.reason || ''
    }));
    
    const timestamp = new Date().toLocaleString('zh-CN').replace(/[/:]/g, '-');
    exportToExcel(exportData, `布展清单_${timestamp}`);
  };

  const copyNoteContent = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedNoteId(id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  const handleAddNote = () => {
    if (newNoteTitle && newNoteContent) {
      useStore.getState().addCurationNote({
        title: newNoteTitle,
        content: newNoteContent,
        uploadedBy: currentUser,
        isSample: false
      });
      setNewNoteTitle('');
      setNewNoteContent('');
      setShowAddNote(false);
    }
  };

  const canExport = stats.pending === 0 && stats.abnormal === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Noto Serif SC, serif' }}>
          导出与设置
        </h2>
        <p className="text-slate-500 mt-1">导出布展清单、管理策展备注和灯光方案</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-1 inline-flex gap-1">
        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'export' 
              ? 'bg-slate-900 text-white' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileDown className="w-4 h-4" />
          清单导出
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'notes' 
              ? 'bg-slate-900 text-white' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          策展备注
        </button>
        <button
          onClick={() => setActiveTab('schemes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'schemes' 
              ? 'bg-slate-900 text-white' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          灯光方案
        </button>
      </div>

      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className={`p-6 rounded-xl border ${
            canExport 
              ? 'bg-emerald-50 border-emerald-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-start gap-4">
              {canExport ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5" />
              )}
              <div>
                <h3 className={`font-semibold ${
                  canExport ? 'text-emerald-800' : 'text-amber-800'
                }`}>
                  {canExport ? '可以导出' : '导出前需要复核'}
                </h3>
                <p className={`text-sm mt-1 ${
                  canExport ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {canExport 
                    ? '所有记录状态正常，可以导出布展清单。'
                    : `还有 ${stats.pending + stats.abnormal} 条记录待处理（待确认：${stats.pending}，异常：${stats.abnormal}），建议处理完成后再导出。`
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">布展清单</h3>
                <p className="text-sm text-slate-500">共 {records.length} 条记录</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? '收起预览' : '预览清单'}
                </button>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  导出Excel
                </button>
              </div>
            </div>

            {showPreview && (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">编号</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">作品</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">位置</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map(record => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 font-mono text-slate-600">{record.materialCode}</td>
                        <td className="px-4 py-3 text-slate-900">{record.name}</td>
                        <td className="px-4 py-3 text-slate-600">{record.location}</td>
                        <td className="px-4 py-3"><StatusBadge status={record.currentStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 mb-4">导出操作指南</h3>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 font-medium flex-shrink-0">1</span>
                <span>先查看<strong>待处理中心</strong>，确认所有异常和待确认记录已处理</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 font-medium flex-shrink-0">2</span>
                <span>点击<strong>预览清单</strong>复核所有记录的状态和位置信息</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 font-medium flex-shrink-0">3</span>
                <span>确认无误后点击<strong>导出Excel</strong>生成布展清单</span>
              </li>
            </ol>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">策展备注样例</h3>
                <p className="text-sm text-slate-500">可以复制样例内容作为参考，或上传新的备注</p>
              </div>
              <button
                onClick={() => setShowAddNote(!showAddNote)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                上传备注
              </button>
            </div>

            {showAddNote && (
              <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-4">
                <input
                  type="text"
                  placeholder="备注标题"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
                />
                <textarea
                  placeholder="备注内容"
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 resize-none"
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowAddNote(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddNote}
                    disabled={!newNoteTitle || !newNoteContent}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {curationNotes.map(note => (
                <div key={note.id} className="p-4">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{note.title}</p>
                        <p className="text-sm text-slate-500">
                          {note.uploadedBy} · {note.uploadedAt}
                        </p>
                      </div>
                      {note.isSample && (
                        <span className="px-2 py-0.5 text-xs bg-sky-100 text-sky-700 rounded">样例</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyNoteContent(note.content, note.id);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        {copiedNoteId === note.id ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      {expandedNote === note.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                  {expandedNote === note.id && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{note.content}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schemes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-6">灯光方案历史版本</h3>
            <div className="grid grid-cols-3 gap-4">
              {lightingSchemes.map((scheme, index) => (
                <div 
                  key={scheme.id}
                  className={`p-5 rounded-xl border ${
                    index === lightingSchemes.length - 1
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-slate-900">{scheme.version}</span>
                    {index === lightingSchemes.length - 1 && (
                      <span className="px-2 py-0.5 text-xs bg-emerald-500 text-white rounded">当前</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mb-2">{scheme.createdBy}</p>
                  <p className="text-xs text-slate-400 mb-4">{scheme.createdAt}</p>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-100">
                    {scheme.content}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">版本对比</h3>
              <p className="text-sm text-slate-500">查看灯光方案的变更历史，了解被覆盖的内容</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-200">
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-500 mb-3">旧版本 (v1.0)</h4>
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <pre className="text-sm text-red-700 whitespace-pre-wrap">{lightingSchemes[0]?.content}</pre>
                </div>
              </div>
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-500 mb-3">当前版本 (v2.0)</h4>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <pre className="text-sm text-emerald-700 whitespace-pre-wrap">{lightingSchemes[2]?.content}</pre>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 mb-4">查看灯光方案变更</h3>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                <span>在<strong>历史版本</strong>中查看所有灯光方案的迭代记录</span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5" />
                <span><strong>版本对比</strong>中红色显示旧版本，绿色显示当前版本</span>
              </li>
              <li className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-slate-400 mt-0.5" />
                <span>每条巡检记录的<strong>历史轨迹</strong>中也保存了当时使用的灯光方案快照</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportSettings;
