import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  Trash2,
  X,
  FileAudio,
  Clock,
  Calendar,
  Layers,
} from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { getTracksByProject } from '@/utils/db';
import Layout from '@/components/Layout';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

const DEMO_ZH_SRT = `1
00:00:01,000 --> 00:00:05,000
大家好，欢迎收听本期播客

2
00:00:05,500 --> 00:00:10,000
今天我们要讨论的是多语言字幕对齐技术

3
00:00:10,500 --> 00:00:15,000
这个工具可以帮助我们更高效地处理字幕

4
00:00:15,500 --> 00:00:20,000
让我们来看看它是如何工作的

5
00:00:20,500 --> 00:00:25,000
首先我们需要导入音频和字幕文件`;

const DEMO_EN_SRT = `1
00:00:01,000 --> 00:00:05,000
Hello everyone, welcome to this podcast

2
00:00:05,500 --> 00:00:10,000
Today we're discussing multi-language subtitle alignment

3
00:00:10,500 --> 00:00:15,000
This tool helps us process subtitles more efficiently

4
00:00:15,500 --> 00:00:20,000
Let's see how it works

5
00:00:20,500 --> 00:00:25,000
First we need to import audio and subtitle files`;

export default function Home() {
  const navigate = useNavigate();
  const { projects, loadProjects, createProject, deleteProject, importSubtitles } =
    useProjectStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [audioFileName, setAudioFileName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [trackCounts, setTrackCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const refreshTrackCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    for (const project of projects) {
      const tracks = await getTracksByProject(project.id);
      counts[project.id] = tracks.length;
    }
    setTrackCounts(counts);
  }, [projects]);

  useEffect(() => {
    refreshTrackCounts();
  }, [refreshTrackCounts]);

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    const duration = 1800 + Math.random() * 7200;
    await createProject(
      newProjectName.trim(),
      audioFileName || 'untitled.mp3',
      duration,
      '',
    );
    const allProjects = useProjectStore.getState().projects;
    const newProject = allProjects[allProjects.length - 1];
    if (newProject) {
      await importSubtitles(newProject.id, 'zh', DEMO_ZH_SRT, 'srt');
      await importSubtitles(newProject.id, 'en', DEMO_EN_SRT, 'srt');
    }
    setShowCreateModal(false);
    setNewProjectName('');
    setAudioFileName('');
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setShowDeleteConfirm(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFileName(file.name);
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="font-['JetBrains_Mono'] text-3xl font-bold text-white">
          播客字幕对齐工作台
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          多语言字幕时间轴对齐与校验工具
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-[#FF6B35] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#e55a28]"
        >
          <Plus size={18} />
          新建项目
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <FolderOpen size={56} className="mb-4 opacity-40" />
          <p className="text-lg font-medium">暂无项目</p>
          <p className="mt-1 text-sm">点击「新建项目」开始使用</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-xl border border-[#0F3460] bg-[#16213E] p-5 transition-colors hover:border-[#FF6B35]/50"
            >
              <h3 className="font-['JetBrains_Mono'] text-lg font-semibold text-white">
                {project.name}
              </h3>
              <div className="mt-3 space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <FileAudio size={14} className="shrink-0" />
                  <span className="truncate">{project.audioFileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="shrink-0" />
                  <span>{formatDuration(project.audioDuration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="shrink-0" />
                  <span>{formatDate(project.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers size={14} className="shrink-0" />
                  <span>{trackCounts[project.id] ?? 0} 条轨道</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0F3460] px-3 py-1.5 text-sm text-[#2EC4B6] transition-colors hover:bg-[#1a4a8a]"
                >
                  <FolderOpen size={14} />
                  打开
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(project.id)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[#E94560] transition-colors hover:bg-[#E94560]/10"
                >
                  <Trash2 size={14} />
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl bg-[#16213E] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-['JetBrains_Mono'] text-xl font-semibold text-white">
                新建项目
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 transition-colors hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">
                  项目名称
                </label>
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full rounded-lg border border-[#0F3460] bg-[#1A1A2E] px-3 py-2 text-white outline-none transition-colors focus:border-[#FF6B35]"
                  placeholder="输入项目名称"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">
                  音频文件
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer rounded-lg border border-[#0F3460] bg-[#1A1A2E] px-3 py-2 text-sm text-gray-400 transition-colors hover:border-[#FF6B35]">
                    选择文件
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  {audioFileName && (
                    <span className="truncate text-sm text-[#2EC4B6]">
                      {audioFileName}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={!newProjectName.trim()}
                className="w-full rounded-lg bg-[#FF6B35] py-2.5 font-medium text-white transition-colors hover:bg-[#e55a28] disabled:cursor-not-allowed disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl bg-[#16213E] p-6 shadow-2xl">
            <h2 className="font-['JetBrains_Mono'] text-lg font-semibold text-white">
              确认删除
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              确定要删除该项目吗？此操作不可撤销。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors hover:text-white"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="rounded-lg bg-[#E94560] px-4 py-2 text-sm text-white transition-colors hover:bg-[#d13050]"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
