import { useState } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';

interface SketchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string;
  routeId: string;
}

export function SketchUploadModal({ isOpen, onClose, issueId, routeId }: SketchUploadModalProps) {
  const [description, setDescription] = useState('');
  const [floor, setFloor] = useState(1);
  const [imageUrl, setImageUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const addFloorSketch = useProjectStore(state => state.addFloorSketch);
  const supplementIssue = useProjectStore(state => state.supplementIssue);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!imageUrl.trim()) return;

    const newSketch = {
      projectId: useProjectStore.getState().currentProjectId!,
      floor,
      imageUrl: imageUrl.trim(),
      description: description.trim() || `楼层${floor}剖面草图`,
      uploadedBy: '阿景',
      relatedRouteIds: [routeId],
    };

    addFloorSketch(newSketch);

    setTimeout(() => {
      const sketches = useProjectStore.getState().sketches;
      const latestSketch = sketches[sketches.length - 1];
      if (latestSketch) {
        supplementIssue(issueId, latestSketch.id);
      }
    }, 100);

    setImageUrl('');
    setDescription('');
    onClose();
  };

  const sampleImages = [
    {
      url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cross%20section%20technical%20drawing%20of%20stage%20floor%20with%20structural%20beams%20and%20obstacle%20marked%20in%20red%20engineering%20blueprint&image_size=landscape_16_9',
      label: '楼层剖面样图1'
    },
    {
      url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=architectural%20floor%20plan%20with%20hoisting%20points%20and%20elevation%20markings%20technical%20drawing&image_size=landscape_16_9',
      label: '楼层剖面样图2'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-industrial-100">
          <h3 className="text-lg font-semibold text-industrial-600">补录楼层剖面草图</h3>
          <button onClick={onClose} className="p-1 hover:bg-industrial-50 rounded">
            <X className="w-5 h-5 text-industrial-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-industrial-500 mb-2">楼层</label>
            <input
              type="number"
              value={floor}
              onChange={(e) => setFloor(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-industrial-200 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-industrial-500 mb-2">图片URL (或选择下方样图)</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="输入图片URL..."
              className="w-full px-3 py-2 border border-industrial-200 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors`}
            style={{ borderColor: isDragging ? '#165DFF' : '#C9CDD4' }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
          >
            <Upload className="w-10 h-10 text-industrial-300 mx-auto mb-2" />
            <p className="text-sm text-industrial-400">拖拽图片到此处</p>
            <p className="text-xs text-industrial-300 mt-1">(演示模式下请使用URL上传)</p>
          </div>

          <div>
            <p className="text-xs font-medium text-industrial-400 mb-2">或快速选择样图:</p>
            <div className="grid grid-cols-2 gap-2">
              {sampleImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setImageUrl(img.url)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all`}
                  style={{ borderColor: imageUrl === img.url ? '#165DFF' : 'transparent' }}
                >
                  <img src={img.url} alt={img.label} className="w-full h-20 object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-industrial-500 mb-2">草图说明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述草图内容，例如：避让消防管道调整段..."
              className="w-full px-3 py-2 border border-industrial-200 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t border-industrial-100 bg-industrial-50">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-white border border-industrial-200 text-industrial-600 rounded-lg hover:bg-industrial-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!imageUrl.trim()}
            className="flex-1 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            提交补充
          </button>
        </div>
      </div>
    </div>
  );
}
