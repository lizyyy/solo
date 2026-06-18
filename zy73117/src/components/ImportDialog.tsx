import { X, Upload, FileText } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/store/useStore';

interface ImportDialogProps {
  onClose: () => void;
}

export function ImportDialog({ onClose }: ImportDialogProps) {
  const importMaterials = useStore((state) => state.importMaterials);
  const [jsonData, setJsonData] = useState('');
  const [error, setError] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setJsonData(JSON.stringify(data, null, 2));
        setError('');
      } catch {
        setError('JSON 格式解析失败，请检查文件内容');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(jsonData);
      if (!Array.isArray(data)) {
        setError('数据格式错误，应为数组');
        return;
      }

      const materials = data.map((item: any) => ({
        projectName: item.projectName || item['项目名称'] || '',
        buildingNo: item.buildingNo || item['楼号'] || '',
        materialType: item.materialType || item['材料类型'] || '',
        surveyNo: item.surveyNo || item['测绘编号'] || '',
        status: item.status || 'normal',
        currentConclusion: item.currentConclusion || item['结论'] || '',
        manualNote: item.manualNote || item['备注'] || '',
        screenshotUrl: item.screenshotUrl || '',
        screenshotNote: item.screenshotNote || '',
        exceptionReason: '',
        nextStep: '',
        isPending: false,
      }));

      importMaterials(materials);
      onClose();
    } catch (e) {
      setError('导入失败：' + (e as Error).message);
    }
  };

  const handleImportSample = () => {
    const sampleMaterials = [
      {
        projectName: '新建路15号工厂改造',
        buildingNo: '1号车间',
        materialType: '屋面测绘',
        surveyNo: 'CH-2024-0320',
        status: 'normal' as const,
        currentConclusion: '屋面防水层完好，可继续使用',
        manualNote: '已核对现场照片',
        screenshotUrl: '',
        screenshotNote: '',
        exceptionReason: '',
        nextStep: '',
        isPending: false,
      },
      {
        projectName: '新建路15号工厂改造',
        buildingNo: '2号车间',
        materialType: '地面测绘',
        surveyNo: 'CH-2024-0321',
        status: 'normal' as const,
        currentConclusion: '地面平整度符合要求',
        manualNote: '',
        screenshotUrl: '',
        screenshotNote: '',
        exceptionReason: '',
        nextStep: '',
        isPending: false,
      },
    ];
    importMaterials(sampleMaterials);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-industrial-800 border border-industrial-700 rounded-lg w-full max-w-lg mx-4 animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-industrial-700">
          <h3 className="text-lg font-semibold text-industrial-100 flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-400" />
            导入材料数据
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-industrial-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-industrial-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="label-field">上传 JSON 文件</label>
            <div className="border-2 border-dashed border-industrial-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileText className="w-10 h-10 text-industrial-500 mx-auto mb-2" />
                <p className="text-sm text-industrial-300">点击或拖拽上传 JSON 文件</p>
                <p className="text-xs text-industrial-500 mt-1">支持项目名称、楼号、材料类型、测绘编号、结论等字段</p>
              </label>
            </div>
          </div>

          <div className="text-center">
            <span className="text-xs text-industrial-500">或</span>
          </div>

          <div>
            <label className="label-field">粘贴 JSON 数据</label>
            <textarea
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              placeholder='[{"projectName": "项目名", "buildingNo": "楼号", "materialType": "类型", "surveyNo": "编号", "currentConclusion": "结论"}]'
              className="input-field h-32 font-mono text-xs resize-none"
            />
          </div>

          {error && (
            <div className="bg-danger-900/30 border border-danger-700 rounded p-3 text-sm text-danger-300">
              {error}
            </div>
          )}

          <div className="bg-industrial-900/50 rounded p-3 border border-industrial-700">
            <p className="text-xs text-industrial-400 mb-2">快速导入示例数据：</p>
            <button
              onClick={handleImportSample}
              className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              + 导入2条示例数据（新建路15号工厂改造项目）
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-industrial-700">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={!jsonData.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}
