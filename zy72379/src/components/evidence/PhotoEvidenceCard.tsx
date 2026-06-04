import React, { useState } from 'react';
import { Camera, MapPin, Clock, Monitor, ZoomIn, X } from 'lucide-react';
import type { PhotoEvidence } from '@/types';

interface PhotoEvidenceCardProps {
  evidence: PhotoEvidence;
  isConflict?: boolean;
  onImageClick?: () => void;
}

export const PhotoEvidenceCard: React.FC<PhotoEvidenceCardProps> = ({ evidence, isConflict = false, onImageClick }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-lg ${
          isConflict ? 'border-danger-300 bg-danger-50' : 'border-neutral-200'
        }`}
      >
        <div className={`px-4 py-3 border-b ${isConflict ? 'bg-danger-50 border-danger-200' : 'bg-primary-50 border-primary-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className={`w-4 h-4 ${isConflict ? 'text-danger-600' : 'text-primary-600'}`} />
              <span className={`text-sm font-semibold ${isConflict ? 'text-danger-700' : 'text-primary-700'}`}>
                工况照片证据
              </span>
              <span className="font-mono text-xs text-neutral-500">{evidence.id}</span>
            </div>
            {isConflict && (
              <span className="px-2 py-0.5 bg-danger-100 text-danger-700 text-xs font-medium rounded">
                存在冲突
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          <div
            className="relative aspect-video bg-neutral-100 rounded-lg overflow-hidden cursor-pointer group mb-4"
            onClick={() => setShowModal(true)}
          >
            <img
              src={evidence.imageUrl}
              alt="工况照片"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-xs font-mono rounded">
              {evidence.extractedValue}{evidence.extractedUnit}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Monitor className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-500">提取数值：</span>
                <span className="font-mono font-bold text-neutral-900">
                  {evidence.extractedValue}{evidence.extractedUnit}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Monitor className="w-4 h-4 text-neutral-400" />
              <span className="text-neutral-500">采集设备：</span>
              <span className="text-neutral-700">{evidence.deviceInfo}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-neutral-400" />
              <span className="text-neutral-500">采集位置：</span>
              <span className="text-neutral-700">{evidence.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span className="text-neutral-500">采集时间：</span>
              <span className="text-neutral-700">{evidence.captureTime}</span>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8" onClick={() => setShowModal(false)}>
          <div className="relative max-w-4xl w-full max-h-full overflow-auto" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={evidence.imageUrl}
              alt="工况照片大图"
              className="w-full h-auto rounded-lg"
            />
            <div className="mt-4 bg-white rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">工况照片详情</h3>
                  <p className="text-sm text-neutral-500">{evidence.id}</p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold text-primary-600">
                    {evidence.extractedValue}
                    <span className="text-lg text-neutral-500">{evidence.extractedUnit}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface PhotoImportFormProps {
  recordId: string;
  onImport: (evidence: Omit<PhotoEvidence, 'id'>) => void;
}

export const PhotoImportForm: React.FC<PhotoImportFormProps> = ({ recordId, onImport }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [extractedValue, setExtractedValue] = useState('');
  const [extractedUnit, setExtractedUnit] = useState('με');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl || !extractedValue) return;

    onImport({
      recordId,
      imageUrl,
      extractedValue: parseFloat(extractedValue),
      extractedUnit,
      captureTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      deviceInfo: deviceInfo || '东华DH3816N静态应变仪',
      location: location || '材料力学实验室A区',
    });

    setImageUrl('');
    setExtractedValue('');
    setDeviceInfo('');
    setLocation('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-6">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        <Camera className="w-5 h-5 text-primary-600" />
        导入工况照片
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">照片URL</label>
          <input
            type="text"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="输入照片链接或使用示例URL"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">提取数值</label>
            <input
              type="number"
              value={extractedValue}
              onChange={e => setExtractedValue(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="1250"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">单位</label>
            <select
              value={extractedUnit}
              onChange={e => setExtractedUnit(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="με">微应变 (με)</option>
              <option value="mm/mm">应变 (mm/mm)</option>
              <option value="%">百分比 (%)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">采集设备</label>
            <input
              type="text"
              value={deviceInfo}
              onChange={e => setDeviceInfo(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="东华DH3816N静态应变仪"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">采集位置</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="材料力学实验室A区"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!imageUrl || !extractedValue}
          className="w-full py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
        >
          导入照片证据
        </button>
      </div>
    </form>
  );
};
