import React, { useState, useRef } from 'react';
import { Upload, FileText, Wrench, AlertCircle, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import { parseCSV, validateScriptCSV, validatePartCSV, mapCSVToScript, mapCSVToPart } from '@/utils/export';
import { ImportResult } from '@/types';

interface ImportZoneProps {
  type: 'script' | 'part';
}

export const ImportZone: React.FC<ImportZoneProps> = ({ type }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importScripts, importParts } = useAppStore();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setMessage({ type: 'error', text: '请上传 CSV 格式文件' });
      return;
    }

    try {
      const data = await parseCSV<Record<string, unknown>>(file);

      if (type === 'script') {
        if (!validateScriptCSV(data)) {
          setMessage({ type: 'error', text: '文件格式不正确，请确保包含"步骤编号"、"标题"、"内容"列' });
          return;
        }
        const mappedData = data.map((row) => mapCSVToScript(row, file.name));
        const result: ImportResult = importScripts(mappedData, file.name);
        setMessage({
          type: result.success ? 'success' : 'error',
          text: result.message,
        });
      } else {
        if (!validatePartCSV(data)) {
          setMessage({ type: 'error', text: '文件格式不正确，请确保包含"零件编号"、"名称"列' });
          return;
        }
        const mappedData = data.map((row) => mapCSVToPart(row, file.name));
        const result: ImportResult = importParts(mappedData, file.name);
        setMessage({
          type: result.success ? 'success' : 'error',
          text: result.message,
        });
      }

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '文件解析失败，请检查文件格式' });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const config = {
    script: {
      icon: FileText,
      title: '导入演示脚本',
      description: '拖拽 CSV 文件到此处，或点击选择文件',
      hint: '格式要求：步骤编号、标题、内容',
    },
    part: {
      icon: Wrench,
      title: '导入零件清单',
      description: '拖拽 CSV 文件到此处，或点击选择文件',
      hint: '格式要求：零件编号、名称、数量、描述',
    },
  }[type];

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-star-gold bg-star-gold/5'
            : 'border-slate-300 hover:border-space-blue hover:bg-slate-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <config.icon
          size={40}
          className={`mx-auto mb-3 ${isDragging ? 'text-star-gold' : 'text-space-light'}`}
        />
        <h3 className="font-serif font-semibold text-graphite mb-1">{config.title}</h3>
        <p className="text-sm text-graphite-light mb-2">{config.description}</p>
        <p className="text-xs text-slate-400">{config.hint}</p>
        <button className="mt-4 btn-primary inline-flex items-center gap-2">
          <Upload size={16} />
          选择文件
        </button>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : message.type === 'error'
              ? 'bg-red-50 text-red-700'
              : 'bg-blue-50 text-blue-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle size={16} />
          ) : message.type === 'error' ? (
            <AlertCircle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {message.text}
        </div>
      )}
    </div>
  );
};
