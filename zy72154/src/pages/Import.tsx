import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Database, UserCheck, ClipboardList, Trash2, Eye, FileSpreadsheet } from 'lucide-react';
import { db } from '@/db';
import { GISPoint, ResidentFeedback, InspectionRecord, DataSourceType } from '@/types';
import { generateId } from '@/utils/matching';

interface FileInfo {
  id: string;
  name: string;
  type: DataSourceType;
  size: number;
  recordCount: number;
  uploadedAt: Date;
  previewData: any[];
}

export default function Import() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedType, setSelectedType] = useState<DataSourceType>('gis');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const typeLabels: Record<DataSourceType, string> = {
    gis: 'GIS点位',
    feedback: '居民反馈',
    inspection: '巡检记录'
  };

  const typeIcons: Record<DataSourceType, React.ReactNode> = {
    gis: <Database className="w-5 h-5" />,
    feedback: <UserCheck className="w-5 h-5" />,
    inspection: <ClipboardList className="w-5 h-5" />
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  }, [selectedType]);

  async function processFile(file: File) {
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const fileInfo: FileInfo = {
        id: generateId(),
        name: file.name,
        type: selectedType,
        size: file.size,
        recordCount: jsonData.length,
        uploadedAt: new Date(),
        previewData: jsonData.slice(0, 5)
      };

      setFiles(prev => [...prev, fileInfo]);
      await importToDB(jsonData, selectedType);
    } catch (error) {
      console.error('文件解析失败', error);
      alert('文件解析失败，请检查格式');
    }
    setLoading(false);
  }

  async function importToDB(data: any[], type: DataSourceType) {
    if (type === 'gis') {
      const records: GISPoint[] = data.map((row: any) => ({
        id: generateId(),
        lamp_id: String(row['路灯编号'] || row['lamp_id'] || row['编号'] || ''),
        address: String(row['地址'] || row['address'] || ''),
        longitude: parseFloat(row['经度'] || row['longitude'] || 0),
        latitude: parseFloat(row['纬度'] || row['latitude'] || 0),
        power_rating: parseFloat(row['功率'] || row['power_rating'] || 0),
        operating_hours: String(row['运行时间'] || row['operating_hours'] || ''),
        district: String(row['区域'] || row['district'] || ''),
        street: String(row['街道'] || row['street'] || ''),
        raw_data: row,
        created_at: new Date()
      }));
      await db.gisPoints.bulkAdd(records);
    } else if (type === 'feedback') {
      const records: ResidentFeedback[] = data.map((row: any) => ({
        id: generateId(),
        feedback_id: String(row['反馈编号'] || row['feedback_id'] || ''),
        lamp_id: String(row['路灯编号'] || row['lamp_id'] || ''),
        address: String(row['地址'] || row['address'] || ''),
        description: String(row['问题描述'] || row['description'] || ''),
        reporter: String(row['反馈人'] || row['reporter'] || ''),
        phone: String(row['联系电话'] || row['phone'] || ''),
        feedback_time: String(row['反馈时间'] || row['feedback_time'] || ''),
        old_format_note: String(row['旧口径备注'] || row['old_format'] || ''),
        raw_note: String(row['原始备注'] || row['raw_note'] || row['备注'] || JSON.stringify(row)),
        created_at: new Date()
      }));
      await db.residentFeedbacks.bulkAdd(records);
    } else if (type === 'inspection') {
      const records: InspectionRecord[] = data.map((row: any) => ({
        id: generateId(),
        record_id: String(row['巡检编号'] || row['record_id'] || ''),
        lamp_id: String(row['路灯编号'] || row['lamp_id'] || ''),
        address: String(row['地址'] || row['address'] || ''),
        inspector: String(row['巡检人'] || row['inspector'] || ''),
        inspection_time: String(row['巡检时间'] || row['inspection_time'] || ''),
        photo_urls: String(row['照片'] || row['photos'] || '').split(',').filter(Boolean),
        status: String(row['状态'] || row['status'] || ''),
        manual_note: String(row['巡检备注'] || row['manual_note'] || row['手改备注'] || ''),
        created_at: new Date()
      }));
      await db.inspectionRecords.bulkAdd(records);
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  }

  async function removeFile(fileId: string) {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }

  async function clearAllData() {
    if (confirm('确定要清空所有数据吗？')) {
      await db.clearAllData();
      setFiles([]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">数据导入</h2>
          <p className="text-sm text-gray-500">上传多源数据，保留原始格式不做清洗</p>
        </div>
        <button
          onClick={clearAllData}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>清空所有数据</span>
        </button>
      </div>

      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-600 mb-3">选择要导入的数据类型：</p>
        <div className="flex space-x-2">
          {(['gis', 'feedback', 'inspection'] as DataSourceType[]).map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedType === type
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {typeIcons[type]}
              <span>{typeLabels[type]}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          dragOver ? 'border-orange-400 bg-orange-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <Upload className={`w-12 h-12 mx-auto mb-4 ${dragOver ? 'text-orange-500' : 'text-gray-400'}`} />
        <p className="text-gray-600 mb-2">拖拽文件到这里，或点击选择文件</p>
        <p className="text-sm text-gray-400 mb-4">支持 Excel (.xlsx, .xls) 和 CSV 格式</p>
        <label className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
          <FileSpreadsheet className="w-4 h-4" />
          <span>选择文件</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInput}
            className="hidden"
            disabled={loading}
          />
        </label>
        {loading && <p className="mt-4 text-sm text-orange-600">正在处理...</p>}
      </div>

      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">已导入文件</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">文件名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">记录数</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">上传时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {files.map(file => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">{file.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center space-x-1 text-xs text-gray-600">
                      {typeIcons[file.type]}
                      <span>{typeLabels[file.type]}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{file.recordCount} 条</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {file.uploadedAt.toLocaleTimeString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setPreviewData(file.previewData);
                          setShowPreview(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="预览"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-96 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">数据预览（前5条）</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {previewData[0] && Object.keys(previewData[0]).map(key => (
                    <th key={key} className="px-2 py-2 text-left text-gray-500 font-medium truncate max-w-32">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {Object.values(row).map((val: any, i) => (
                      <td key={i} className="px-2 py-2 text-gray-700 truncate max-w-32" title={String(val)}>
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
