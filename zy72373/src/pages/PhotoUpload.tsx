import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, ArrowRight, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { useDiagnosisStore } from '../store/useDiagnosisStore';
import { StepProgress } from '../components/StepProgress';
import type { StepInfo } from '../types';

export function PhotoUpload() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getCurrentTask, addPhoto, setCurrentTask } = useDiagnosisStore();

  const task = getCurrentTask();
  const [photoDescription, setPhotoDescription] = useState('');

  const steps: StepInfo[] = [
    { step: 1, title: '数据导入', description: '导入传感器数据', status: 'completed' },
    { step: 2, title: '照片补录', description: '补录工况照片', status: 'active' },
    { step: 3, title: '生成报告', description: '生成交接报告', status: 'pending' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && taskId) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const url = event.target?.result as string;
          addPhoto(taskId, {
            url,
            thumbnail: url,
            filename: file.name,
            uploadTime: new Date().toISOString(),
            uploadBy: '训练教练老唐',
            description: photoDescription || '工况照片',
            nodeIndex: task?.photos.length || 0,
          });
        };
        reader.readAsDataURL(file);
      });
      setPhotoDescription('');
    }
  };

  const handleAddDemoPhotos = () => {
    if (taskId) {
      const demoPhotos = [
        {
          url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20fan%20blade%20close%20up%20showing%20wear%20and%20tear%20in%20factory%20setting&image_size=square',
          thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20fan%20blade%20close%20up%20showing%20wear%20and%20tear%20in%20factory%20setting&image_size=square',
          filename: 'blade_a_wear.jpg',
          uploadTime: new Date().toISOString(),
          uploadBy: '训练教练老唐',
          description: '叶片A磨损情况实拍，边缘有明显腐蚀痕迹',
          nodeIndex: 0,
        },
        {
          url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20vibration%20measurement%20equipment%20on%20large%20fan%20in%20power%20plant&image_size=square',
          thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20vibration%20measurement%20equipment%20on%20large%20fan%20in%20power%20plant&image_size=square',
          filename: 'vibration_test.jpg',
          uploadTime: new Date().toISOString(),
          uploadBy: '训练教练老唐',
          description: '整体振动检测现场，传感器安装位置',
          nodeIndex: 1,
        },
      ];
      demoPhotos.forEach(photo => addPhoto(taskId, photo));
    }
  };

  const handleNext = () => {
    if (taskId) {
      setCurrentTask(taskId);
      navigate(`/diagnosis/${taskId}/review`);
    }
  };

  const handleBack = () => {
    if (taskId) {
      navigate(`/diagnosis/${taskId}/import`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="card">
        <StepProgress steps={steps} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-industrial-900">第二步：补录工况照片</h2>
            <p className="text-sm text-industrial-500 mt-1">
              工况照片后来才补到群里，训练教练老唐回看时才发现问题
            </p>
          </div>
          <button onClick={handleAddDemoPhotos} className="btn-secondary">
            添加演示照片
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-industrial-700 mb-2">
            照片说明（可选）
          </label>
          <input
            type="text"
            value={photoDescription}
            onChange={e => setPhotoDescription(e.target.value)}
            placeholder="例如：叶片磨损情况、检测现场等"
            className="input-field"
          />
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-industrial-200 rounded-xl p-8 text-center cursor-pointer hover:border-industrial-400 hover:bg-industrial-50 transition-all"
        >
          <Camera className="w-12 h-12 mx-auto mb-4 text-industrial-400" />
          <p className="text-industrial-600 mb-2">点击或拖拽上传工况照片</p>
          <p className="text-sm text-industrial-400">支持 JPG、PNG 格式</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {task?.photos && task.photos.length > 0 && (
          <div className="mt-8">
            <h3 className="font-medium text-industrial-900 mb-4">
              已上传照片 ({task.photos.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {task.photos.map(photo => (
                <div key={photo.id} className="photo-thumbnail group">
                  <img
                    src={photo.url}
                    alt={photo.description}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-xs text-center px-2">
                      {photo.description}
                    </p>
                  </div>
                  <p className="text-xs text-industrial-500 mt-1 truncate">
                    {photo.filename}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-6 mt-6 border-t border-industrial-100">
          <button onClick={handleBack} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            上一步
          </button>
          <div className="flex items-center gap-2 text-sm text-industrial-500">
            <ImageIcon className="w-4 h-4" />
            {task?.photos.length || 0} 张照片
          </div>
          <button onClick={handleNext} className="btn-primary flex items-center gap-2">
            下一步：人工复核
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
