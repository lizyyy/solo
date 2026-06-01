import { useState } from 'react';
import { X, Upload, FileJson, FileSpreadsheet, Map, Tablet, Image, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { CrackRecord } from '../../types';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const IMPORT_SOURCES = [
  { type: 'gis', icon: Map, label: 'GIS扫描数据', color: 'text-blue-400', desc: '.json 格式坐标数据' },
  { type: 'tablet', icon: Tablet, label: '巡检平板记录', color: 'text-green-400', desc: '.json 格式巡检记录' },
  { type: 'excel', icon: FileSpreadsheet, label: 'Excel台账', color: 'text-emerald-400', desc: '.csv 格式导出文件' },
  { type: 'screenshot', icon: Image, label: '周会截图补录', color: 'text-amber-400', desc: '手动录入旧口径记录' }
] as const;

const DEMO_DATA: Record<string, Omit<CrackRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'>> = {
  gis: {
    code: 'YP-DEMO-GIS',
    location: 'tip',
    position3D: { x: 0.1, y: 4.5, z: 0 },
    crackType: 'suspected',
    riskLevel: 'high',
    status: 'pending',
    source: 'gis',
    description: '叶尖前缘GIS扫描异常信号，疑似前缘 erosion 或涂层脱落',
    suggestion: '建议无人机航拍确认前缘状况，如确认为前缘 erosion 需评估是否需要前缘保护修复',
    remark: '',
    isOldCaliber: false,
    sourceInfo: {
      id: 'demo-gis',
      sourceType: 'gis',
      sourceRef: 'GIS扫描报告 DEMO-W02，异常点编号A-023',
      originalData: '{"grid":"W02","point":"A-023","signalStrength":"1.8x","depth":"未知"}'
    }
  },
  tablet: {
    code: 'YP-DEMO-TAB',
    location: 'middle',
    position3D: { x: -0.1, y: 3, z: 0.1 },
    crackType: 'longitudinal',
    riskLevel: 'medium',
    status: 'pending',
    source: 'tablet',
    description: '叶中背风面纵向微裂纹，长约10cm，宽度约0.2mm',
    suggestion: '建议纳入下次定检计划，打磨后做表面修复，后续跟踪观察',
    remark: '',
    isOldCaliber: false,
    sourceInfo: {
      id: 'demo-tab',
      sourceType: 'tablet',
      sourceRef: '平板记录 DEMO，照片IMG_DEMO_089',
      originalData: '{"position":"叶中","length":"10cm","width":"0.2mm","photo":"IMG_DEMO_089"}'
    }
  },
  excel: {
    code: 'YP-DEMO-EXL',
    location: 'root',
    position3D: { x: 0.15, y: 0.8, z: -0.05 },
    crackType: 'mesh',
    riskLevel: 'high',
    status: 'pending',
    source: 'excel',
    description: '叶根法兰连接区域网状微裂纹，需超声波探伤确认内部情况',
    suggestion: '高优先级处理，建议尽快安排搭架检查，做超声波探伤确认内部是否有分层或裂纹扩展',
    remark: '',
    isOldCaliber: false,
    sourceInfo: {
      id: 'demo-exl',
      sourceType: 'excel',
      sourceRef: 'Excel台账 2024-Q2，第12行记录',
      originalData: '{"row":"12","sheet":"缺陷台账","reporter":"王巡检"}'
    }
  },
  screenshot: {
    code: 'YP-DEMO-OLD',
    location: 'middle',
    position3D: { x: 0.05, y: 2, z: -0.1 },
    crackType: 'transverse',
    riskLevel: 'low',
    status: 'confirmed',
    source: 'screenshot',
    description: '周会截图中旧记录，2022年发现的横向微裂纹，已跟踪观察2年',
    suggestion: '按旧口径为"观察类"，按新标准需复核。如确无明显扩展，可继续观察；如确认裂纹有变，需评估是否需要处理',
    remark: '从周会截图补录，原记录2022-03-15，原处理人：赵工',
    isOldCaliber: true,
    sourceInfo: {
      id: 'demo-scr',
      sourceType: 'screenshot',
      sourceRef: '周会截图 2024-06-10，第5页第5行',
      originalData: '{"oldCode":"OLD-2022-033","oldCategory":"观察类","oldStatus":"跟踪中","date":"2022-03-15"}'
    }
  }
};

export const ImportDialog = ({ isOpen, onClose }: ImportDialogProps) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { addRecord, importRecords } = useAppStore();

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setFileContent(content);
        setError(null);
      } catch (err) {
        setError('文件读取失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
  };

  const handleImportDemo = () => {
    if (!selectedSource) return;
    
    const demoRecord = DEMO_DATA[selectedSource as keyof typeof DEMO_DATA];
    if (demoRecord) {
      addRecord(demoRecord);
      onClose();
    }
  };

  const handleImportFile = () => {
    if (!fileContent) {
      setError('请先选择要导入的文件');
      return;
    }

    try {
      const data = JSON.parse(fileContent);
      const records = Array.isArray(data) ? data : [data];
      importRecords(records);
      onClose();
    } catch (err) {
      setError('JSON 格式解析失败，请检查文件内容');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="glass rounded-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">导入数据</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-400 mb-4">
            选择数据来源类型，支持导入 JSON/CSV 格式文件，或使用演示数据快速体验
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {IMPORT_SOURCES.map(source => (
              <button
                key={source.type}
                onClick={() => setSelectedSource(source.type)}
                className={`p-4 rounded-lg text-left transition-all border-2 ${
                  selectedSource === source.type
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-transparent bg-dark-800/50 hover:bg-dark-700/50'
                }`}
              >
                <source.icon className={`w-6 h-6 mb-2 ${source.color}`} />
                <p className="text-sm font-medium text-white">{source.label}</p>
                <p className="text-xs text-gray-500">{source.desc}</p>
              </button>
            ))}
          </div>

          {selectedSource && (
            <div className="bg-dark-800/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-300 mb-3">
                已选择：<span className="font-medium text-white">
                  {IMPORT_SOURCES.find(s => s.type === selectedSource)?.label}
                </span>
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-2">上传文件</label>
                  <label className="flex items-center justify-center gap-2 w-full py-3 px-4 border-2 border-dashed border-dark-600 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-500/5 transition-colors">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-400">点击选择文件</span>
                    <input
                      type="file"
                      accept=".json,.csv"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  {fileContent && (
                    <p className="text-xs text-success-400 mt-2 flex items-center gap-1">
                      <FileJson className="w-3 h-3" />
                      已选择文件，大小: {fileContent.length} 字节
                    </p>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <div className="relative flex items-center justify-center py-2">
                  <div className="absolute inset-x-0 top-1/2 border-t border-dark-600" />
                  <span className="relative bg-dark-800/90 px-3 text-xs text-gray-500">或者</span>
                </div>

                <button
                  onClick={() => setShowDemoConfirm(true)}
                  className="w-full py-2 px-4 bg-warning-600 hover:bg-warning-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  导入演示数据（快速体验）
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleImportFile}
              disabled={!fileContent}
              className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:bg-dark-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
            >
              导入
            </button>
          </div>
        </div>
      </div>

      {showDemoConfirm && selectedSource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="glass rounded-xl p-6 max-w-sm w-full mx-4">
            <h4 className="text-base font-semibold text-white mb-2">确认导入演示数据</h4>
            <p className="text-sm text-gray-300 mb-4">
              将导入一条
              <span className="text-warning-400 font-medium mx-1">
                {IMPORT_SOURCES.find(s => s.type === selectedSource)?.label}
              </span>
              类型的演示记录，用于快速体验功能。确定要继续吗？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDemoConfirm(false)}
                className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImportDemo}
                className="px-4 py-2 rounded-lg bg-warning-600 hover:bg-warning-500 text-white text-sm font-medium transition-colors"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
