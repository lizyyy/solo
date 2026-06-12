import { useState } from 'react';
import { X, Upload, FileText, Plus, Minus, Camera, Image as ImageIcon } from 'lucide-react';
import { useAppStore } from '@/store';
import { TicketType, StandardType, AuthorizationStatus, Photo } from '@/types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TrackForm {
  name: string;
  alias: string;
  ticketType: TicketType;
  standard: StandardType;
  authorization: AuthorizationStatus;
  hasMixedTickets: boolean;
}

interface PhotoForm {
  remark: string;
  hasOldStandard: boolean;
  takenAt: string;
}

const emptyTrack: TrackForm = {
  name: '',
  alias: '',
  ticketType: 'paid',
  standard: 'new',
  authorization: 'valid',
  hasMixedTickets: false,
};

const emptyPhoto: PhotoForm = {
  remark: '',
  hasOldStandard: false,
  takenAt: new Date().toISOString().slice(0, 10),
};

const samplePhotoUrls = [
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=music%20classroom%20attendance%20sheet%20with%20signatures%20warm%20lighting&image_size=square',
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=concert%20ticket%20stubs%20mixed%20free%20and%20paid%20vintage%20style&image_size=square',
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=old%20music%20sheet%20with%20handwritten%20notes%20vintage%20paper&image_size=square',
];

const generateId = () => Math.random().toString(36).substring(2, 9);

export const ImportModal = ({ isOpen, onClose }: ImportModalProps) => {
  const { importBatch, addToast, showHumanError } = useAppStore();
  const [activeTab, setActiveTab] = useState<'tracks' | 'photos'>('tracks');
  const [tracks, setTracks] = useState<TrackForm[]>([{ ...emptyTrack }]);
  const [photos, setPhotos] = useState<PhotoForm[]>([]);

  const addTrack = () => {
    setTracks([...tracks, { ...emptyTrack }]);
  };

  const removeTrack = (index: number) => {
    if (tracks.length === 1) return;
    setTracks(tracks.filter((_, i) => i !== index));
  };

  const updateTrack = (index: number, field: keyof TrackForm, value: string | boolean) => {
    const updated = [...tracks];
    updated[index] = { ...updated[index], [field]: value };
    setTracks(updated);
  };

  const addPhoto = () => {
    if (photos.length >= 3) {
      addToast('warning', '最多添加3张签到照片哦');
      return;
    }
    setPhotos([...photos, { ...emptyPhoto }]);
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const updatePhoto = (index: number, field: keyof PhotoForm, value: string | boolean) => {
    const updated = [...photos];
    updated[index] = { ...updated[index], [field]: value };
    setPhotos(updated);
  };

  const handleSubmit = () => {
    const validTracks = tracks.filter((t) => t.name.trim() && t.alias.trim());
    if (validTracks.length === 0) {
      showHumanError('EMPTY_DATA');
      return;
    }

    const hasMixed = validTracks.some(t => t.ticketType === 'mixed') ||
                    (validTracks.filter(t => t.ticketType === 'free').length > 0 &&
                     validTracks.filter(t => t.ticketType === 'paid').length > 0);

    const tracksWithMixedFlag = validTracks.map(t => ({
      ...t,
      hasMixedTickets: hasMixed || t.ticketType === 'mixed',
    }));

    const photoRecords: Photo[] = photos.map((p, idx) => ({
      id: `p${generateId()}${idx}`,
      url: samplePhotoUrls[idx % samplePhotoUrls.length],
      remark: p.remark || '课时签到照片',
      takenAt: p.takenAt,
      hasOldStandard: p.hasOldStandard,
    }));

    importBatch(tracksWithMixedFlag, photoRecords);
    setTracks([{ ...emptyTrack }]);
    setPhotos([]);
    setActiveTab('tracks');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-2xl max-h-[85vh] overflow-hidden animate-slide-in flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-wine-800 flex items-center justify-center">
              <Upload className="text-gold-400" size={20} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-gold-200">导入曲目别名表</h2>
              <p className="text-xs text-white/50">录入曲目和签到照片，模拟完整导入流程</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('tracks')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'tracks'
                ? 'text-gold-300 border-b-2 border-gold-800 bg-white/5'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <FileText size={16} />
            曲目别名表
            <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-xs">{tracks.filter(t => t.name.trim()).length}</span>
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'photos'
                ? 'text-gold-300 border-b-2 border-gold-800 bg-white/5'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Camera size={16} />
            课时签到照片
            <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-xs">{photos.length}</span>
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto max-h-[50vh] scrollbar-thin">
          {activeTab === 'tracks' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-wine-900/20 border border-wine-800/30 mb-4">
                <p className="text-sm text-gold-200">
                  💡 <span className="font-medium">曲目别名表是主材料</span>，先把曲子录进去。签到照片常常藏着关键备注，可以在右边标签页添加。
                </p>
              </div>

              {tracks.map((track, index) => (
                <div key={index} className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-gold-400" />
                      <span className="text-sm font-medium text-white">曲目 {index + 1}</span>
                    </div>
                    {tracks.length > 1 && (
                      <button
                        onClick={() => removeTrack(index)}
                        className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-white/50 mb-1">曲目名称</label>
                      <input
                        type="text"
                        value={track.name}
                        onChange={(e) => updateTrack(index, 'name', e.target.value)}
                        placeholder="例如：夜曲"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1">别名</label>
                      <input
                        type="text"
                        value={track.alias}
                        onChange={(e) => updateTrack(index, 'alias', e.target.value)}
                        placeholder="例如：Yeq"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1">票种类型</label>
                      <select
                        value={track.ticketType}
                        onChange={(e) => updateTrack(index, 'ticketType', e.target.value)}
                        className="input-field"
                      >
                        <option value="paid">售票</option>
                        <option value="free">赠票</option>
                        <option value="mixed">混合（同首曲目）</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1">口径</label>
                      <select
                        value={track.standard}
                        onChange={(e) => updateTrack(index, 'standard', e.target.value as StandardType)}
                        className="input-field"
                      >
                        <option value="new">新口径</option>
                        <option value="old">旧口径</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addTrack}
                className="w-full py-3 border-2 border-dashed border-white/20 rounded-lg text-white/50 hover:border-gold-800/50 hover:text-gold-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                添加曲目
              </button>
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 mb-4">
                <p className="text-sm text-gray-300">
                  📸 <span className="font-medium">课时签到照片常常藏着关键备注</span>，尤其是旧口径的记录。添加后可以在详情页里补录信息。
                </p>
              </div>

              {photos.length === 0 && (
                <div className="text-center py-8">
                  <ImageIcon size={48} className="mx-auto mb-3 text-white/20" />
                  <p className="text-white/40 mb-4">还没有添加签到照片</p>
                  <p className="text-xs text-white/30">点击下方按钮添加，照片里的备注很重要哦</p>
                </div>
              )}

              {photos.map((photo, index) => (
                <div key={index} className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Camera size={16} className="text-gold-400" />
                      <span className="text-sm font-medium text-white">签到照片 {index + 1}</span>
                    </div>
                    <button
                      onClick={() => removePhoto(index)}
                      className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-white/50 mb-1">照片备注</label>
                      <textarea
                        value={photo.remark}
                        onChange={(e) => updatePhoto(index, 'remark', e.target.value)}
                        placeholder="例如：2023年之前入库曲目，按旧口径保留"
                        rows={2}
                        className="input-field resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-white/50 mb-1">拍摄日期</label>
                        <input
                          type="date"
                          value={photo.takenAt}
                          onChange={(e) => updatePhoto(index, 'takenAt', e.target.value)}
                          className="input-field"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={photo.hasOldStandard}
                            onChange={(e) => updatePhoto(index, 'hasOldStandard', e.target.checked)}
                            className="w-4 h-4 rounded border-white/30 bg-white/5 text-gold-800 focus:ring-gold-800"
                          />
                          <span className="text-sm text-white/70">包含旧口径备注</span>
                        </label>
                      </div>
                    </div>
                    {photo.hasOldStandard && (
                      <div className="p-2 rounded bg-gray-700/30 border border-gray-600/30">
                        <p className="text-xs text-gray-300">
                          ⚠️ 这张照片含旧口径备注，导入后可以用来补录曲目信息
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={addPhoto}
                className="w-full py-3 border-2 border-dashed border-white/20 rounded-lg text-white/50 hover:border-gold-800/50 hover:text-gold-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                添加签到照片
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-white/10">
          <div className="text-xs text-white/40">
            {tracks.filter(t => t.name.trim()).length} 首曲目 · {photos.length} 张照片
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button onClick={handleSubmit} className="btn-gold">
              确认导入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
