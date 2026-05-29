import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { FolderPlus, ChevronDown, FolderOpen, Trash2 } from 'lucide-react';

export function ProjectSelector() {
  const { projects, currentProject, setCurrentProject, createProject, deleteProject } =
    useProjectStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleCreate = async () => {
    if (newName.trim()) {
      await createProject(newName.trim(), newDesc.trim());
      setNewName('');
      setNewDesc('');
      setShowNewModal(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除该项目吗？所有相关数据将被永久删除。')) {
      await deleteProject(id);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors min-w-[240px]"
      >
        <FolderOpen className="w-4 h-4 text-primary-600" />
        <span className="flex-1 text-left font-medium text-slate-700">
          {currentProject?.name || '选择项目'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg z-50 animate-fade-in">
          <div className="p-2 border-b border-slate-100">
            <button
              onClick={() => setShowNewModal(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              新建项目
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {projects.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">
                暂无项目，请先创建
              </div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer group"
                  onClick={() => {
                    setCurrentProject(project.id);
                    setIsOpen(false);
                  }}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      currentProject?.id === project.id
                        ? 'bg-primary-600'
                        : 'bg-slate-300'
                    }`}
                  />
                  <span className="flex-1 text-sm">{project.name}</span>
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                    title="删除项目"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl animate-slide-up">
            <h3 className="font-serif text-lg font-bold text-slate-900 mb-4">
              新建项目
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  项目名称
                </label>
                <input
                  type="text"
                  className="input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="输入项目名称"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  项目描述
                </label>
                <textarea
                  className="textarea h-20"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="输入项目描述（可选）"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  className="btn-secondary"
                  onClick={() => setShowNewModal(false)}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
