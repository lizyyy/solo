import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Plus,
  Disc3,
  Link as LinkIcon,
  ExternalLink,
  History,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useStore } from '@/store/useStore';
import { getHistoryForEntity } from '@/services/historyService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, TextArea } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { HistoryTimeline } from '@/components/features/HistoryTimeline';
import type { Platform } from '@/types';
import { PLATFORM_LABELS, STATUS_LABELS } from '@/types';

export default function TrackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    tracks,
    updateTrack,
    deleteTrack,
    addPlatformLink,
    deletePlatformLink,
    linkTrackToSamplePack,
    unlinkTrackFromSamplePack,
    history,
    samplePacks,
    getSamplePacksForTrack,
    getPlatformLinksForTrack,
  } = useStore();

  const track = tracks.find((t) => t.id === id);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isSamplePackModalOpen, setIsSamplePackModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    artist: '',
    bpm: '',
    genre: '',
    projectPath: '',
  });
  const [linkData, setLinkData] = useState({
    platform: 'spotify' as Platform,
    url: '',
    publishedAt: '',
  });

  if (!track) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-medium text-[#1A1A2E]">曲目不存在</h2>
        <Button className="mt-4" onClick={() => navigate('/sample-packs')}>
          返回
        </Button>
      </div>
    );
  }

  const trackPacks = getSamplePacksForTrack(track.id);
  const trackLinks = getPlatformLinksForTrack(track.id);
  const trackHistory = getHistoryForEntity(history, 'track', track.id);
  const availablePacks = samplePacks.filter((p) => !track.samplePackIds.includes(p.id));

  const openEditModal = () => {
    setEditData({
      title: track.title,
      artist: track.artist,
      bpm: track.bpm?.toString() || '',
      genre: track.genre || '',
      projectPath: track.projectPath || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTrack(
      track.id,
      {
        title: editData.title,
        artist: editData.artist,
        bpm: editData.bpm ? Number(editData.bpm) : undefined,
        genre: editData.genre || undefined,
        projectPath: editData.projectPath || undefined,
      },
      '编辑曲目信息'
    );
    setIsEditModalOpen(false);
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addPlatformLink({
      trackId: track.id,
      platform: linkData.platform,
      url: linkData.url,
      publishedAt: linkData.publishedAt || undefined,
    });
    setIsLinkModalOpen(false);
    setLinkData({
      platform: 'spotify',
      url: '',
      publishedAt: '',
    });
  };

  const handleDelete = () => {
    if (window.confirm(`确定要删除曲目《${track.title}》吗？`)) {
      deleteTrack(track.id);
      navigate('/sample-packs');
    }
  };

  const handleLinkPack = (packId: string) => {
    linkTrackToSamplePack(track.id, packId);
    setIsSamplePackModalOpen(false);
  };

  const tabs = [
    { id: 'info', label: '基本信息', icon: <Disc3 className="w-4 h-4" /> },
    { id: 'samplepacks', label: '采样包', icon: <Disc3 className="w-4 h-4" /> },
    { id: 'links', label: '平台链接', icon: <LinkIcon className="w-4 h-4" /> },
    { id: 'history', label: '历史记录', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/sample-packs')}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1A1A2E]">《{track.title}》</h1>
          <p className="text-gray-500 mt-1">
            {track.genre && track.bpm
              ? `${track.genre} · BPM ${track.bpm}`
              : track.genre || track.bpm || '暂无详细信息'}
          </p>
        </div>
        <Button variant="outline" onClick={openEditModal} className="gap-2">
          <Edit3 className="w-4 h-4" />
          编辑
        </Button>
        <Button variant="danger" onClick={handleDelete} className="gap-2">
          <Trash2 className="w-4 h-4" />
          删除
        </Button>
      </div>

      {trackPacks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {trackPacks.map((pack) => (
            <Link
              key={pack.id}
              to={`/sample-packs/${pack.id}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm"
            >
              <span className="text-gray-500">使用采样包：</span>
              <span className="font-medium text-[#1A1A2E]">{pack.name}</span>
              <StatusBadge status={pack.status} />
            </Link>
          ))}
        </div>
      )}

      <Tabs tabs={tabs}>
        {(activeTab) => (
          <div>
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>曲目信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">曲目名称</span>
                      <span className="font-medium text-[#1A1A2E]">{track.title}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">艺术家</span>
                      <span className="font-medium text-[#1A1A2E]">{track.artist}</span>
                    </div>
                    {track.bpm && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">BPM</span>
                        <span className="font-medium text-[#1A1A2E]">{track.bpm}</span>
                      </div>
                    )}
                    {track.genre && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">音乐风格</span>
                        <span className="font-medium text-[#1A1A2E]">{track.genre}</span>
                      </div>
                    )}
                    {track.projectPath && (
                      <div className="py-2 border-b border-gray-100">
                        <span className="text-gray-500 block mb-1">工程文件路径</span>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded text-[#1A1A2E]">
                          {track.projectPath}
                        </code>
                      </div>
                    )}
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">创建时间</span>
                      <span className="font-medium text-[#1A1A2E]">
                        {format(new Date(track.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'samplepacks' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-[#1A1A2E]">使用的采样包</h3>
                  <Button size="sm" onClick={() => setIsSamplePackModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    关联采样包
                  </Button>
                </div>

                {trackPacks.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-gray-400">
                      <Disc3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>暂无关联采样包</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {trackPacks.map((pack) => (
                      <Card key={pack.id}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <Link
                              to={`/sample-packs/${pack.id}`}
                              className="flex-1"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1A1A2E] to-[#2a2a4a] flex items-center justify-center">
                                  <Disc3 className="w-5 h-5 text-[#E8B86D]" />
                                </div>
                                <div>
                                  <p className="font-medium text-[#1A1A2E] hover:text-[#E8B86D] transition-colors flex items-center gap-2">
                                    {pack.name}
                                    <ExternalLink className="w-4 h-4" />
                                  </p>
                                  <p className="text-sm text-gray-500">{pack.vendor}</p>
                                </div>
                              </div>
                            </Link>
                            <div className="flex items-center gap-3">
                              <StatusBadge status={pack.status} />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `确定取消与「${pack.name}」的关联吗？`
                                    )
                                  ) {
                                    unlinkTrackFromSamplePack(track.id, pack.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-gray-400" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'links' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-[#1A1A2E]">平台上架链接</h3>
                  <Button size="sm" onClick={() => setIsLinkModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    添加链接
                  </Button>
                </div>

                {trackLinks.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-gray-400">
                      <LinkIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>暂无平台链接</p>
                      <p className="text-sm mt-1">点击上方按钮添加上架平台链接</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {trackLinks.map((link) => (
                      <Card key={link.id}>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-[#6B8E9F]/10 flex items-center justify-center">
                                <LinkIcon className="w-5 h-5 text-[#6B8E9F]" />
                              </div>
                              <div>
                                <p className="font-medium text-[#1A1A2E]">
                                  {PLATFORM_LABELS[link.platform]}
                                </p>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-[#E8B86D] hover:underline flex items-center gap-1"
                                >
                                  {link.url}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {link.publishedAt && (
                                <span className="text-sm text-gray-500">
                                  上架于 {link.publishedAt}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm('确定删除此链接吗？')) {
                                    deletePlatformLink(link.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-gray-400" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h3 className="text-lg font-semibold text-[#1A1A2E] mb-4">操作历史</h3>
                <HistoryTimeline records={trackHistory} />
              </div>
            )}
          </div>
        )}
      </Tabs>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="编辑曲目"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="曲目名称"
            name="title"
            value={editData.title}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
            required
          />
          <Input
            label="艺术家"
            name="artist"
            value={editData.artist}
            onChange={(e) => setEditData({ ...editData, artist: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="BPM"
              name="bpm"
              type="number"
              value={editData.bpm}
              onChange={(e) => setEditData({ ...editData, bpm: e.target.value })}
              placeholder="可选"
            />
            <Input
              label="音乐风格"
              name="genre"
              value={editData.genre}
              onChange={(e) => setEditData({ ...editData, genre: e.target.value })}
              placeholder="例如：Synthwave"
            />
          </div>
          <Input
            label="工程文件路径"
            name="projectPath"
            value={editData.projectPath}
            onChange={(e) => setEditData({ ...editData, projectPath: e.target.value })}
            placeholder="可选，例如：/Projects/Song.ableton"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              取消
            </Button>
            <Button type="submit">保存修改</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="添加平台链接"
      >
        <form onSubmit={handleLinkSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="平台"
              name="platform"
              value={linkData.platform}
              onChange={(e) =>
                setLinkData({ ...linkData, platform: e.target.value as Platform })
              }
              options={Object.entries(PLATFORM_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Input
              label="上架日期"
              name="publishedAt"
              type="date"
              value={linkData.publishedAt}
              onChange={(e) => setLinkData({ ...linkData, publishedAt: e.target.value })}
            />
          </div>
          <Input
            label="链接地址"
            name="url"
            value={linkData.url}
            onChange={(e) => setLinkData({ ...linkData, url: e.target.value })}
            placeholder="https://..."
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsLinkModalOpen(false)}>
              取消
            </Button>
            <Button type="submit">添加链接</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isSamplePackModalOpen}
        onClose={() => setIsSamplePackModalOpen(false)}
        title="关联采样包"
      >
        {availablePacks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Disc3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无可关联的采样包</p>
          </div>
        ) : (
          <div className="space-y-2">
            {availablePacks.map((pack) => (
              <div
                key={pack.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-[#1A1A2E]">{pack.name}</p>
                  <p className="text-sm text-gray-500">{pack.vendor}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={pack.status} />
                  <Button size="sm" variant="outline" onClick={() => handleLinkPack(pack.id)}>
                    关联
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
