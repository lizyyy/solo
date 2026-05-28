import { useState } from 'react';
import { Plus, Trash2, Eye, Download, X } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { useSchemeStore } from '../store/useSchemeStore';
import { usePigmentStore } from '../store/usePigmentStore';

export function SchemeManager() {
  const { schemes, addScheme, deleteScheme, initStore } = useSchemeStore();
  const { pigments, initStore: initPigmentStore } = usePigmentStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingScheme, setViewingScheme] = useState<string | null>(null);
  const [newSchemeName, setNewSchemeName] = useState('');
  const [newSchemeDesc, setNewSchemeDesc] = useState('');

  useState(() => {
    initStore();
    initPigmentStore();
  });

  const handleCreateScheme = () => {
    if (newSchemeName.trim()) {
      addScheme(newSchemeName.trim(), newSchemeDesc.trim(), []);
      setNewSchemeName('');
      setNewSchemeDesc('');
      setShowCreateModal(false);
    }
  };

  const getSchemePigments = (pigmentIds: string[]) => {
    return pigmentIds.map(id => pigments.find(p => p.id === id)).filter(Boolean);
  };

  const viewingSchemeData = schemes.find(s => s.id === viewingScheme);
  const viewingPigments = viewingSchemeData ? getSchemePigments(viewingSchemeData.pigmentIds) : [];

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <Navbar />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">方案管理</h1>
              <p className="text-slate-400">管理和对比配方方案</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              创建方案
            </button>
          </div>

          {schemes.length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">暂无方案</h3>
              <p className="text-slate-400 mb-4">创建您的第一个配方方案</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                创建方案
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schemes.map((scheme) => {
                const schemePigments = getSchemePigments(scheme.pigmentIds);
                return (
                  <div
                    key={scheme.id}
                    className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{scheme.name}</h3>
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                          {scheme.description || '暂无描述'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mb-4">
                      {schemePigments.slice(0, 5).map((pigment, i) => (
                        pigment && (
                          <div
                            key={i}
                            className="w-8 h-8 rounded-lg border-2 border-slate-700 -ml-1 first:ml-0"
                            style={{ backgroundColor: pigment.colorHex }}
                            title={pigment.name}
                          />
                        )
                      ))}
                      {schemePigments.length > 5 && (
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs text-slate-400 -ml-1">
                          +{schemePigments.length - 5}
                        </div>
                      )}
                      {schemePigments.length === 0 && (
                        <span className="text-sm text-slate-500">空方案</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">
                        {schemePigments.length} 个色料
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingScheme(scheme.id)}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                          title="导出方案"
                        >
                          <Download className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                          onClick={() => deleteScheme(scheme.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="删除方案"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">创建新方案</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">方案名称</label>
                <input
                  type="text"
                  value={newSchemeName}
                  onChange={(e) => setNewSchemeName(e.target.value)}
                  placeholder="输入方案名称"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">方案描述</label>
                <textarea
                  value={newSchemeDesc}
                  onChange={(e) => setNewSchemeDesc(e.target.value)}
                  placeholder="输入方案描述（可选）"
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateScheme}
                  disabled={!newSchemeName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingSchemeData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{viewingSchemeData.name}</h2>
                <p className="text-sm text-slate-400">{viewingSchemeData.description}</p>
              </div>
              <button
                onClick={() => setViewingScheme(null)}
                className="p-1 hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-96">
              {viewingPigments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  方案中暂无色料
                </div>
              ) : (
                <div className="space-y-3">
                  {viewingPigments.map((pigment) => (
                    pigment && (
                      <div
                        key={pigment.id}
                        className="flex items-center gap-4 p-3 bg-slate-700/50 rounded-lg"
                      >
                        <div
                          className="w-12 h-12 rounded-lg border border-slate-600"
                          style={{ backgroundColor: pigment.colorHex }}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-white">{pigment.name}</div>
                          <div className="text-sm text-slate-400">{pigment.code}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-slate-300">透明度 {(pigment.transparency * 100).toFixed(0)}%</div>
                          <div className="text-slate-400">耐光 {pigment.lightfastness ?? '未测'}</div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
