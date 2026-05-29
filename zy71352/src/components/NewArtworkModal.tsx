import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useArtworkStore } from '../store/artworkStore';
import { FormField, Input, Textarea } from './FormFields';
import { cn } from '../lib/utils';

export function NewArtworkModal() {
  const { newArtworkModalOpen, closeNewArtworkModal, showToast } = useUIStore();
  const { createArtwork } = useArtworkStore();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    artworkNo: '',
    artist: '',
    year: '',
    material: '',
    size: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = '请输入作品名称';
    if (!formData.artworkNo.trim()) newErrors.artworkNo = '请输入作品编号';
    if (!formData.artist.trim()) newErrors.artist = '请输入艺术家名称';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const success = await createArtwork(formData);
      if (success) {
        showToast('作品记录创建成功', 'success');
        closeNewArtworkModal();
        setFormData({
          name: '',
          artworkNo: '',
          artist: '',
          year: '',
          material: '',
          size: '',
        });
      } else {
        showToast('创建失败，请重试', 'error');
      }
    } catch (err) {
      showToast('创建失败，请重试', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!newArtworkModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeNewArtworkModal}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-scaleIn"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2
            className="text-lg font-bold text-stone-900"
            style={{ fontFamily: "'Noto Serif SC', serif" }}
          >
            新建作品记录
          </h2>
          <button
            onClick={closeNewArtworkModal}
            className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="作品名称" required error={errors.name}>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入作品名称"
                error={errors.name}
              />
            </FormField>

            <FormField label="作品编号" required error={errors.artworkNo}>
              <Input
                value={formData.artworkNo}
                onChange={(e) => setFormData({ ...formData, artworkNo: e.target.value })}
                placeholder="如：EXH-2026-001"
                error={!!errors.artworkNo}
              />
            </FormField>

            <FormField label="艺术家" required error={errors.artist}>
              <Input
                value={formData.artist}
                onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                placeholder="请输入艺术家名称"
                error={!!errors.artist}
              />
            </FormField>

            <FormField label="年代">
              <Input
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder="如：1948年 或 清代"
              />
            </FormField>

            <FormField label="材质">
              <Input
                value={formData.material}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                placeholder="如：设色纸本"
              />
            </FormField>

            <FormField label="尺寸">
              <Input
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                placeholder="如：180×90cm"
              />
            </FormField>
          </div>
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50 justify-end">
          <button
            type="button"
            onClick={closeNewArtworkModal}
            className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-200 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm',
            loading
              ? 'bg-stone-400 text-white cursor-not-allowed'
              : 'bg-slate-800 hover:bg-slate-900 text-white'
          )}
          >
            <Plus className="w-4 h-4" />
            {loading ? '创建中...' : '创建记录'}
          </button>
        </div>
      </div>
    </div>
  );
}
