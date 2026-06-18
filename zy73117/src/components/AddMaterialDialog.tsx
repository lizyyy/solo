import { X, Plus } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/store/useStore';

interface AddMaterialDialogProps {
  onClose: () => void;
}

export function AddMaterialDialog({ onClose }: AddMaterialDialogProps) {
  const addMaterial = useStore((state) => state.addMaterial);

  const [formData, setFormData] = useState({
    projectName: '',
    buildingNo: '',
    materialType: '',
    surveyNo: '',
    currentConclusion: '',
    status: 'normal' as const,
    manualNote: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName || !formData.buildingNo || !formData.materialType || !formData.surveyNo || !formData.currentConclusion) {
      return;
    }

    addMaterial({
      ...formData,
      screenshotUrl: '',
      screenshotNote: '',
      exceptionReason: '',
      nextStep: '',
      isPending: false,
    });

    onClose();
  };

  const materialTypes = ['结构测绘', '墙体测绘', '地基测绘', '管线测绘', '门窗测绘', '屋面测绘', '地面测绘'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-industrial-800 border border-industrial-700 rounded-lg w-full max-w-lg mx-4 animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-industrial-700">
          <h3 className="text-lg font-semibold text-industrial-100 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-400" />
            新增材料记录
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-industrial-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-industrial-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">项目名称 *</label>
              <input
                type="text"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="例如：建国路88号旧楼改造"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label-field">楼号 *</label>
              <input
                type="text"
                value={formData.buildingNo}
                onChange={(e) => setFormData({ ...formData, buildingNo: e.target.value })}
                placeholder="例如：3号楼"
                className="input-field"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">材料类型 *</label>
              <select
                value={formData.materialType}
                onChange={(e) => setFormData({ ...formData, materialType: e.target.value })}
                className="input-field"
                required
              >
                <option value="">请选择</option>
                {materialTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">测绘编号 *</label>
              <input
                type="text"
                value={formData.surveyNo}
                onChange={(e) => setFormData({ ...formData, surveyNo: e.target.value })}
                placeholder="例如：CH-2024-0315"
                className="input-field font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="label-field">初始结论 *</label>
            <textarea
              value={formData.currentConclusion}
              onChange={(e) => setFormData({ ...formData, currentConclusion: e.target.value })}
              placeholder="例如：结构承载力满足设计要求"
              className="input-field resize-none h-20"
              required
            />
          </div>

          <div>
            <label className="label-field">人工备注</label>
            <textarea
              value={formData.manualNote}
              onChange={(e) => setFormData({ ...formData, manualNote: e.target.value })}
              placeholder="补充说明信息..."
              className="input-field resize-none h-16"
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-industrial-700">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary"
          >
            确认新增
          </button>
        </div>
      </div>
    </div>
  );
}
