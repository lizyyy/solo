import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Image, Palette, Layout, X, File } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { MaterialFile, MaterialType } from '@/types';

const typeIcons: Record<MaterialType, React.ElementType> = {
  text: FileText,
  image: Image,
  color: Palette,
  layout: Layout,
};

const typeLabels: Record<MaterialType, string> = {
  text: '文本',
  image: '图片',
  color: '色卡',
  layout: '版式',
};

export default function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const { addFile, currentTask } = useAppStore();

  const detectFileType = (filename: string): MaterialType => {
    if (filename.includes('色') || filename.includes('color') || filename.endsWith('.json')) {
      return 'color';
    }
    if (filename.includes('版') || filename.includes('layout')) {
      return 'layout';
    }
    if (/\.(jpg|jpeg|png|gif|svg)$/i.test(filename)) {
      return 'image';
    }
    return 'text';
  };

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const type = detectFileType(file.name);

          const newFile: MaterialFile = {
            id: Math.random().toString(36).substring(2, 11),
            name: file.name,
            type,
            content,
            uploadTime: Date.now(),
            version: 'v1.0',
          };

          addFile(newFile);
        };
        reader.readAsText(file);
      });
    },
    [addFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-primary-400 bg-primary-50'
            : 'border-slate-300 hover:border-primary-300 hover:bg-slate-50'
        }`}
      >
        <input
          type="file"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <motion.div
          animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
            <Upload size={28} className="text-primary-500" />
          </div>
          <p className="font-medium text-slate-700 mb-1">拖拽文件到这里，或点击上传</p>
          <p className="text-sm text-slate-500">支持 .txt, .json, .md, .csv 等格式</p>
        </motion.div>
      </div>

      {currentTask && currentTask.files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-600">
            已上传 {currentTask.files.length} 个文件
          </p>
          <div className="grid grid-cols-2 gap-2">
            {currentTask.files.map((file) => {
              const Icon = typeIcons[file.type] || File;
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:shadow-sm transition-shadow"
                >
                  <div className="p-2 rounded-lg bg-slate-100">
                    <Icon size={18} className="text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {typeLabels[file.type]} · {file.version}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
