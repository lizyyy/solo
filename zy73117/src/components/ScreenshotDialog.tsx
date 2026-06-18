import { X, Camera, Image, Upload, Sparkles } from 'lucide-react';
import { useState, useRef } from 'react';
import { useStore } from '@/store/useStore';

interface ScreenshotDialogProps {
  materialId: string;
  currentScreenshotUrl: string;
  currentScreenshotNote: string;
  onClose: () => void;
}

const DEFAULT_SCREENSHOT_URL = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=engineering%20blueprint%20of%20building%20foundation%20survey%20with%20red%20markings%20showing%20change%20areas%20technical%20drawing&image_size=landscape_16_9';

export function ScreenshotDialog({ materialId, currentScreenshotUrl, currentScreenshotNote, onClose }: ScreenshotDialogProps) {
  const updateMaterialScreenshot = useStore((state) => state.updateMaterialScreenshot);
  const addRecord = useStore((state) => state.addRecord);
  const getSelectedMaterial = useStore((state) => state.getSelectedMaterial);

  const [screenshotUrl, setScreenshotUrl] = useState(currentScreenshotUrl);
  const [screenshotNote, setScreenshotNote] = useState(currentScreenshotNote);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setScreenshotUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUseExample = () => {
    setScreenshotUrl(DEFAULT_SCREENSHOT_URL);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotNote.trim()) return;

    updateMaterialScreenshot(materialId, screenshotUrl, screenshotNote.trim());

    const material = getSelectedMaterial();
    if (material && screenshotNote) {
      addRecord({
        materialId,
        type: 'note',
        content: '补充截图说明',
        operator: '阿宁',
        previousConclusion: material.currentConclusion,
        newConclusion: material.currentConclusion,
        reason: '补充资料',
        changeOrderNo: '',
        hasChangeOrder: false,
        changeOrderLate: false,
        remark: `已上传截图说明：${screenshotNote.trim()}`,
      });
    }

    onClose();
  };

  const handleRemoveScreenshot = () => {
    setScreenshotUrl('');
    setScreenshotNote('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-industrial-800 border border-industrial-700 rounded-lg w-full max-w-lg mx-4 animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-success-700/50 bg-success-900/20">
          <h3 className="text-lg font-semibold text-success-300 flex items-center gap-2">
            <Camera className="w-5 h-5" />
            截图说明
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-industrial-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-industrial-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {screenshotUrl ? (
            <div className="relative group">
              <img
                src={screenshotUrl}
                alt="截图说明"
                className="w-full rounded-lg border border-industrial-600 max-h-64 object-contain bg-industrial-900"
              />
              <button
                type="button"
                onClick={handleRemoveScreenshot}
                className="absolute top-2 right-2 p-1.5 bg-danger-600 hover:bg-danger-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-industrial-600 rounded-lg p-8 text-center hover:border-success-500 transition-colors cursor-pointer"
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
              />
              <Image className="w-12 h-12 text-industrial-500 mx-auto mb-3" />
              <p className="text-sm text-industrial-300 mb-1">点击上传截图</p>
              <p className="text-xs text-industrial-500">支持 JPG、PNG 格式，最大 5MB</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary flex-1 flex items-center justify-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              {screenshotUrl ? '重新上传' : '上传截图'}
            </button>
            {!screenshotUrl && (
              <button
                type="button"
                onClick={handleUseExample}
                className="btn-primary flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                示例图片
              </button>
            )}
          </div>

          <div>
            <label className="label-field">截图说明 *</label>
            <textarea
              value={screenshotNote}
              onChange={(e) => setScreenshotNote(e.target.value)}
              placeholder="请详细说明截图内容，例如：红线为原设计路线，蓝线为调整后路线，标注了变更位置..."
              className="input-field resize-none h-24"
              required
            />
            <p className="text-xs text-industrial-500 mt-1">* 说明文字必填，图片可选（可后续补充）</p>
          </div>

          <div className="bg-industrial-900/50 rounded p-3 border border-industrial-700">
            <p className="text-xs text-industrial-400">
              <span className="text-success-400 font-medium">说明：</span>
              截图说明将作为结论变更的重要依据，现场老师查看时会优先检查截图与变更内容的对应关系。请确保说明清晰、标注准确。
            </p>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-industrial-700">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!screenshotNote.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存截图
          </button>
        </div>
      </div>
    </div>
  );
}
