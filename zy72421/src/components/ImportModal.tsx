import { useState } from 'react';
import { X, Upload, FileText, Plus, Minus } from 'lucide-react';
import { useAppStore } from '@/store';
import { TicketType, StandardType, AuthorizationStatus } from '@/types';

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

const emptyTrack: TrackForm = {
  name: '',
  alias: '',
  ticketType: 'paid',
  standard: 'new',
  authorization: 'valid',
  hasMixedTickets: false,
};

export const ImportModal = ({ isOpen, onClose }: ImportModalProps) => {
  const { importBatch, addToast, showHumanError } = useAppStore();
  const [tracks, setTracks] = useState<TrackForm[]>([{ ...emptyTrack }]);

  const addTrack = () => {
    setTracks([...tracks, { ...emptyTrack }]);
  };

  const removeTrack = (index: number) => {
    if (tracks.length === 1) return;
    setTracks(tracks.filter((_, i) => i !== index));
  };

  const updateTrack = (index: number, field: keyof TrackForm, value: string) => {
    const updated = [...tracks];
    updated[index] = { ...updated[index], [field]: value };
    setTracks(updated);
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

    importBatch(tracksWithMixedFlag);
    setTracks([{ ...emptyTrack }]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-2xl max-h-[80vh] overflow-hidden animate-slide-in">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-wine-800 flex items-center justify-center">
              <Upload className="text-gold-400" size={20} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-gold-200">导入曲目别名表</h2>
              <p className="text-xs text-white/50">手动录入曲目信息，模拟导入流程</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[50vh] scrollbar-thin space-y-4">
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

        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button onClick={handleSubmit} className="btn-gold">
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
};
