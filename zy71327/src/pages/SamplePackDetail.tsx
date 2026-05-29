import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Plus,
  FileText,
  Music2,
  History,
  Info,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useStore } from '@/store/useStore';
import { getHistoryForEntity } from '@/services/historyService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, TextArea } from '@/components/ui/Input';
import { HistoryTimeline } from '@/components/features/HistoryTimeline';
import type { LicenseType, CredentialType } from '@/types';
import {
  LICENSE_TYPE_LABELS,
  CREDENTIAL_TYPE_LABELS,
  PLATFORM_LABELS,
} from '@/types';
import { RiskAlertItem } from '@/components/features/RiskAlertItem';

export default function SamplePackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    samplePacks,
    updateSamplePack,
    deleteSamplePack,
    addCredential,
    deleteCredential,
    linkTrackToSamplePack,
    unlinkTrackFromSamplePack,
    risks,
    tracks: allTracks,
    history,
    getTracksForSamplePack,
    getCredentialsForSamplePack,
    getPlatformLinksForTrack,
  } = useStore();

  const pack = samplePacks.find((p) => p.id === id);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    vendor: '',
    purchaseDate: '',
    licenseType: 'perpetual' as LicenseType,
    expiryDate: '',
    price: '',
    notes: '',
  });
  const [credentialData, setCredentialData] = useState({
    type: 'invoice' as CredentialType,
    fileName: '',
    description: '',
  });

  if (!pack) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-medium text-[#1A1A2E]">采样包不存在</h2>
        <Button className="mt-4" onClick={() => navigate('/sample-packs')}>
          返回列表
        </Button>
      </div>
    );
  }

  const packTracks = getTracksForSamplePack(pack.id);
  const packCredentials = getCredentialsForSamplePack(pack.id);
  const packHistory = getHistoryForEntity(history, 'samplePack', pack.id);
  const packRisks = risks.filter((r) => r.relatedEntityId === pack.id);
  const availableTracks = allTracks.filter((t) => !t.samplePackIds.includes(pack.id));

  const openEditModal = () => {
    setEditData({
      name: pack.name,
      vendor: pack.vendor,
      purchaseDate: pack.purchaseDate,
      licenseType: pack.licenseType,
      expiryDate: pack.expiryDate || '',
      price: pack.price?.toString() || '',
      notes: pack.notes || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSamplePack(
      pack.id,
      {
        name: editData.name,
        vendor: editData.vendor,
        purchaseDate: editData.purchaseDate,
        licenseType: editData.licenseType,
        expiryDate: editData.expiryDate || undefined,
        price: editData.price ? Number(editData.price) : undefined,
        notes: editData.notes || undefined,
      },
      '编辑采样包信息'
    );
    setIsEditModalOpen(false);
  };

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCredential({
      samplePackId: pack.id,
      type: credentialData.type,
      fileName: credentialData.fileName,
      description: credentialData.description || undefined,
    });
    setIsCredentialModalOpen(false);
    setCredentialData({
      type: 'invoice',
      fileName: '',
      description: '',
    });
  };

  const handleDelete = () => {
    if (window.confirm(`确定要删除采样包「${pack.name}」吗？此操作会记录到历史中。`)) {
      deleteSamplePack(pack.id);
      navigate('/sample-packs');
    }
  };

  const handleLinkTrack = (trackId: string) => {
    linkTrackToSamplePack(trackId, pack.id);
    setIsLinkModalOpen(false);
  };

  const tabs = [
    { id: 'info', label: '基本信息', icon: <Info className="w-4 h-4" /> },
    { id: 'credentials', label: '授权凭证', icon: <FileText className="w-4 h-4" /> },
    { id: 'tracks', label: '关联曲目', icon: <Music2 className="w-4 h-4" /> },
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1A1A2E]">{pack.name}</h1>
            <StatusBadge status={pack.status} />
          </div>
          <p className="text-gray-500 mt-1">{pack.vendor}</p>
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

      {packRisks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500">当前风险</h3>
          {packRisks.map((risk) => (
            <RiskAlertItem key={risk.id} alert={risk} showAction={false} />
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
                    <CardTitle>授权信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">授权类型</span>
                      <span className="font-medium text-[#1A1A2E]">
                        {LICENSE_TYPE_LABELS[pack.licenseType]}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">购买日期</span>
                      <span className="font-medium text-[#1A1A2E]">{pack.purchaseDate}</span>
                    </div>
                    {pack.expiryDate && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">到期日期</span>
                        <span className="font-medium text-[#1A1A2E]">{pack.expiryDate}</span>
                      </div>
                    )}
                    {pack.price && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">购买价格</span>
                        <span className="font-medium text-[#1A1A2E]">¥{pack.price}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">创建时间</span>
                      <span className="font-medium text-[#1A1A2E]">
                        {format(new Date(pack.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {pack.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle>备注</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 leading-relaxed">{pack.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'credentials' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-[#1A1A2E]">授权凭证</h3>
                  <Button size="sm" onClick={() => setIsCredentialModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    添加凭证
                  </Button>
                </div>

                {packCredentials.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>暂无授权凭证</p>
                      <p className="text-sm mt-1">点击上方按钮添加发票、合同等凭证</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {packCredentials.map((cred) => (
                      <Card key={cred.id}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#E8B86D]/10 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-[#E8B86D]" />
                              </div>
                              <div>
                                <p className="font-medium text-[#1A1A2E]">{cred.fileName}</p>
                                <p className="text-sm text-gray-500">
                                  {CREDENTIAL_TYPE_LABELS[cred.type]}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (window.confirm('确定删除此凭证吗？')) {
                                  deleteCredential(cred.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-gray-400" />
                            </Button>
                          </div>
                          {cred.description && (
                            <p className="text-sm text-gray-500 mt-3">{cred.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            上传于{' '}
                            {format(new Date(cred.uploadedAt), 'yyyy-MM-dd HH:mm', {
                              locale: zhCN,
                            })}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tracks' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-[#1A1A2E]">关联曲目</h3>
                  <Button size="sm" onClick={() => setIsLinkModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    关联曲目
                  </Button>
                </div>

                {packTracks.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-gray-400">
                      <Music2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>暂无关联曲目</p>
                      <p className="text-sm mt-1">点击上方按钮关联使用了该采样包的曲目</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {packTracks.map((track) => {
                      const links = getPlatformLinksForTrack(track.id);
                      return (
                        <Card key={track.id}>
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <Link
                                  to={`/tracks/${track.id}`}
                                  className="font-medium text-[#1A1A2E] hover:text-[#E8B86D] transition-colors flex items-center gap-2"
                                >
                                  《{track.title}》
                                  <ExternalLink className="w-4 h-4" />
                                </Link>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                  {track.bpm && <span>BPM {track.bpm}</span>}
                                  {track.genre && <span>{track.genre}</span>}
                                </div>
                                {links.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {links.map((link) => (
                                      <a
                                        key={link.id}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                      >
                                        {PLATFORM_LABELS[link.platform]}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `确定取消与《${track.title}》的关联吗？`
                                    )
                                  ) {
                                    unlinkTrackFromSamplePack(track.id, pack.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-gray-400" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h3 className="text-lg font-semibold text-[#1A1A2E] mb-4">操作历史</h3>
                <p className="text-sm text-gray-500 mb-6">
                  所有操作均已记录，原始数据永不覆盖
                </p>
                <HistoryTimeline records={packHistory} />
              </div>
            )}
          </div>
        )}
      </Tabs>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="编辑采样包"
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="采样包名称"
              name="name"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              required
            />
            <Input
              label="供应商"
              name="vendor"
              value={editData.vendor}
              onChange={(e) => setEditData({ ...editData, vendor: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="购买日期"
              name="purchaseDate"
              type="date"
              value={editData.purchaseDate}
              onChange={(e) => setEditData({ ...editData, purchaseDate: e.target.value })}
              required
            />
            <Select
              label="授权类型"
              name="licenseType"
              value={editData.licenseType}
              onChange={(e) =>
                setEditData({ ...editData, licenseType: e.target.value as LicenseType })
              }
              options={Object.entries(LICENSE_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Input
              label="到期日期"
              name="expiryDate"
              type="date"
              value={editData.expiryDate}
              onChange={(e) => setEditData({ ...editData, expiryDate: e.target.value })}
            />
          </div>
          <Input
            label="购买价格（元）"
            name="price"
            type="number"
            value={editData.price}
            onChange={(e) => setEditData({ ...editData, price: e.target.value })}
          />
          <TextArea
            label="备注"
            name="notes"
            value={editData.notes}
            onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
            rows={3}
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
        isOpen={isCredentialModalOpen}
        onClose={() => setIsCredentialModalOpen(false)}
        title="添加授权凭证"
      >
        <form onSubmit={handleCredentialSubmit} className="space-y-4">
          <Select
            label="凭证类型"
            name="type"
            value={credentialData.type}
            onChange={(e) =>
              setCredentialData({ ...credentialData, type: e.target.value as CredentialType })
            }
            options={Object.entries(CREDENTIAL_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Input
            label="文件名称"
            name="fileName"
            value={credentialData.fileName}
            onChange={(e) => setCredentialData({ ...credentialData, fileName: e.target.value })}
            placeholder="例如：Invoice_2025_001.pdf"
            required
          />
          <TextArea
            label="备注说明"
            name="description"
            value={credentialData.description}
            onChange={(e) => setCredentialData({ ...credentialData, description: e.target.value })}
            placeholder="可选，记录发票编号、邮件主题等关键信息"
            rows={2}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCredentialModalOpen(false)}
            >
              取消
            </Button>
            <Button type="submit">添加凭证</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="关联曲目"
      >
        {availableTracks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Music2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无可关联的曲目</p>
            <p className="text-sm mt-1">所有曲目都已关联到此采样包</p>
          </div>
        ) : (
          <div className="space-y-2">
            {availableTracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-[#1A1A2E]">《{track.title}》</p>
                  <p className="text-sm text-gray-500">
                    {track.genre && track.bpm
                      ? `${track.genre} · BPM ${track.bpm}`
                      : track.genre || track.bpm || '暂无信息'}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleLinkTrack(track.id)}>
                  关联
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
