import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Users, Music, AlertCircle, CheckCircle, X } from 'lucide-react';
import type { Member, VoicePart, ImportData } from '../types';
import { importFromExcel, validateImportData } from '../utils/importUtils';
import { sampleMembers, sampleVoiceParts } from '../utils/sampleData';

interface DataImportProps {
  onDataLoaded: (data: ImportData) => void;
}

export function DataImport({ onDataLoaded }: DataImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [importedMembers, setImportedMembers] = useState<Member[] | null>(null);
  const [importedParts, setImportedParts] = useState<VoicePart[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [songName, setSongName] = useState('');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    setErrors([]);
    try {
      const data = await importFromExcel(file);
      const validation = validateImportData(data);
      
      if (!validation.valid) {
        setErrors(validation.errors);
      }
      
      if (data.members) {
        setImportedMembers(data.members);
      }
      if (data.voiceParts) {
        setImportedParts(data.voiceParts);
      }
      if (data.songName) {
        setSongName(data.songName);
      }
      if (data.teacherNotes) {
        setTeacherNotes(data.teacherNotes);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : '文件导入失败']);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleData = () => {
    setImportedMembers(sampleMembers);
    setImportedParts(sampleVoiceParts);
    setSongName('合唱曲目样例');
    setTeacherNotes('这是样例数据，用于演示系统功能。');
    setErrors([]);
  };

  const handleConfirm = () => {
    if (importedMembers && importedParts) {
      onDataLoaded({
        members: importedMembers,
        voiceParts: importedParts,
        attendanceRecords: [],
        songName,
        teacherNotes,
      });
    }
  };

  const clearData = () => {
    setImportedMembers(null);
    setImportedParts(null);
    setSongName('');
    setTeacherNotes('');
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">合唱声部分配器</h1>
        <p className="text-gray-500">导入团员数据和声部配置，自动进行智能分配</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            {isLoading ? (
              <div className="py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                <p className="text-gray-500">正在解析文件...</p>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-700 font-medium mb-1">点击或拖拽上传Excel文件</p>
                <p className="text-gray-400 text-sm">支持 .xlsx, .xls, .csv 格式</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-gray-400 text-sm">或</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <button
            onClick={loadSampleData}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-medium hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-5 h-5" />
            加载样例数据
          </button>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <AlertCircle className="w-5 h-5" />
                导入警告
              </div>
              <ul className="text-red-600 text-sm space-y-1">
                {errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">曲目名称</label>
            <input
              type="text"
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              placeholder="输入曲目名称"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">老师备注</label>
            <textarea
              value={teacherNotes}
              onChange={(e) => setTeacherNotes(e.target.value)}
              placeholder="输入备注信息"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {importedMembers && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <span className="font-medium text-gray-700">团员数据</span>
                </div>
                <span className="text-sm text-gray-500">{importedMembers.length} 人</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {importedMembers.slice(0, 8).map((member) => (
                  <span
                    key={member.id}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {member.name}
                  </span>
                ))}
                {importedMembers.length > 8 && (
                  <span className="px-3 py-1 text-gray-500 text-sm">
                    +{importedMembers.length - 8} 人
                  </span>
                )}
              </div>
            </div>
          )}

          {importedParts && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Music className="w-5 h-5 text-indigo-500" />
                  <span className="font-medium text-gray-700">声部配置</span>
                </div>
                <span className="text-sm text-gray-500">{importedParts.length} 个声部</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {importedParts.map((part) => (
                  <div
                    key={part.id}
                    className="px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg"
                  >
                    <div className="font-medium text-gray-700">{part.displayName}</div>
                    <div className="text-xs text-gray-500">
                      {part.minMembers}-{part.maxMembers}人
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={clearData}
              disabled={!importedMembers && !importedParts}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              清除
            </button>
            <button
              onClick={handleConfirm}
              disabled={!importedMembers || !importedParts}
              className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              开始分配
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
