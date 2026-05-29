import { useState, useRef } from 'react';
import {
  FileUp,
  Music,
  Users,
  BookOpen,
  FileSpreadsheet,
  Download,
  Check,
  Upload,
  X,
  Plus,
} from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { parseFile, downloadTemplate } from '../utils/fileParser';
import { StatusBadge } from '../components/common/StatusBadge';
import { ImportDataType, Part, Musician, Revision, Distribution } from '../types';

interface ImportSection {
  type: ImportDataType;
  title: string;
  icon: any;
  description: string;
  color: string;
  bgColor: string;
}

const importSections: ImportSection[] = [
  {
    type: 'parts',
    title: '声部谱',
    icon: Music,
    description: '导入各声部的乐谱页码信息',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'musicians',
    title: '乐手名单',
    icon: Users,
    description: '导入乐团乐手及其所属声部',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    type: 'revisions',
    title: '修订页',
    icon: BookOpen,
    description: '导入临时修订页及其适用声部',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    type: 'distributions',
    title: '发放记录',
    icon: FileSpreadsheet,
    description: '导入每个乐手的乐谱发放情况',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
];

export default function Import() {
  const { currentData, updateData, createVersion, versions } = useDataStore();
  const [uploading, setUploading] = useState<ImportDataType | null>(null);
  const [previewData, setPreviewData] = useState<Partial<Record<ImportDataType, any[]>>>({});
  const [versionName, setVersionName] = useState('');
  const [versionDesc, setVersionDesc] = useState('');
  const fileInputRefs = useRef<Record<ImportDataType, HTMLInputElement | null>>({
    parts: null,
    pageRules: null,
    musicians: null,
    revisions: null,
    distributions: null,
  });

  const handleFileUpload = async (type: ImportDataType, file: File) => {
    setUploading(type);
    try {
      const data = await parseFile(file, type);
      setPreviewData((prev) => ({ ...prev, [type]: data }));
    } catch (error) {
      alert('文件解析失败: ' + (error as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const applyPreview = (type: ImportDataType) => {
    if (previewData[type]) {
      updateData(type, previewData[type]!);
      setPreviewData((prev) => {
        const newData = { ...prev };
        delete newData[type];
        return newData;
      });
    }
  };

  const clearPreview = (type: ImportDataType) => {
    setPreviewData((prev) => {
      const newData = { ...prev };
      delete newData[type];
      return newData;
    });
  };

  const getDataCount = (type: ImportDataType) => {
    switch (type) {
      case 'parts':
        return currentData.parts.length;
      case 'musicians':
        return currentData.musicians.length;
      case 'revisions':
        return currentData.revisions.length;
      case 'distributions':
        return currentData.distributions.length;
      default:
        return 0;
    }
  };

  const handleSaveVersion = () => {
    if (!versionName) {
      alert('请输入版本名称');
      return;
    }
    createVersion(versionName, versionDesc, currentData);
    setVersionName('');
    setVersionDesc('');
    alert('版本保存成功！');
  };

  const renderPreviewTable = (type: ImportDataType, data: any[]) => {
    if (data.length === 0) return null;
    const sample = data[0];
    const keys = Object.keys(sample).slice(0, 4);

    return (
      <div className="mt-4 border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {keys.map((key) => (
                <th key={key} className="px-3 py-2 text-left font-medium text-gray-600">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 3).map((item, idx) => (
              <tr key={idx} className="border-t">
                {keys.map((key) => (
                  <td key={key} className="px-3 py-2 text-gray-700 truncate max-w-32">
                    {Array.isArray(item[key]) ? item[key].join(', ') : String(item[key] || '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 3 && (
          <div className="px-3 py-2 bg-gray-50 text-sm text-gray-500">
            共 {data.length} 条数据，仅显示前 3 条
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold text-gray-800">数据导入</h2>
          <p className="text-gray-500 mt-1">独立导入各类数据源，确保来源可追溯</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setPreviewData({})}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>清空预览</span>
          </button>
          <button
            onClick={handleSaveVersion}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>保存为新版本</span>
          </button>
        </div>
      </div>

      {versions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700">
            <Check className="w-5 h-5" />
            <span>当前已有 {versions.length} 个版本，可在「变更对比」页面查看历史</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">版本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">版本名称 *</label>
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="如：2026年春季音乐会 v1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">版本说明</label>
            <input
              type="text"
              value={versionDesc}
              onChange={(e) => setVersionDesc(e.target.value)}
              placeholder="简要描述本次修改内容"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {importSections.map((section) => (
          <div
            key={section.type}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${section.bgColor}`}>
                  <section.icon className={`w-5 h-5 ${section.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{section.title}</h3>
                  <p className="text-sm text-gray-500">{section.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status="info">{getDataCount(section.type)} 条</StatusBadge>
                {previewData[section.type] && (
                  <StatusBadge status="warning">待确认 {previewData[section.type]?.length} 条</StatusBadge>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={(el) => (fileInputRefs.current[section.type] = el)}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(section.type, e.target.files[0]);
                    }
                  }}
                  accept=".json,.csv,.xlsx,.xls"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRefs.current[section.type]?.click()}
                  disabled={uploading === section.type}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                >
                  {uploading === section.type ? (
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-gray-600">
                    {uploading === section.type ? '解析中...' : '点击上传文件'}
                  </span>
                </button>
                <button
                  onClick={() => downloadTemplate(section.type)}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">模板</span>
                </button>
              </div>

              {previewData[section.type] && (
                <>
                  {renderPreviewTable(section.type, previewData[section.type]!)}
                  <div className="flex gap-2">
                    <button
                      onClick={() => applyPreview(section.type)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>确认导入</span>
                    </button>
                    <button
                      onClick={() => clearPreview(section.type)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">当前数据概览</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Music className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-700">{currentData.parts.length}</div>
            <div className="text-sm text-blue-600">声部</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-700">{currentData.musicians.length}</div>
            <div className="text-sm text-green-600">乐手</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <BookOpen className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-700">{currentData.revisions.length}</div>
            <div className="text-sm text-purple-600">修订页</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <FileSpreadsheet className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-orange-700">{currentData.distributions.length}</div>
            <div className="text-sm text-orange-600">发放记录</div>
          </div>
        </div>
      </div>
    </div>
  );
}
