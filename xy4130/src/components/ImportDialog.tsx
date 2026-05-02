import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';
import type { StageProject } from '@/types';
import { importProjectFromFile } from '@/persistence';
import { detectAndParse } from '@/parsers';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportProject: (project: StageProject) => void;
  onImportData: (data: Record<string, unknown>) => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  onImportProject,
  onImportData,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    setError(null);
    setSuccess(null);

    const ext = file.name.toLowerCase().split('.').pop();

    if (ext !== 'json' && ext !== 'csv') {
      setError('仅支持 JSON 和 CSV 文件格式');
      return;
    }

    try {
      const content = await file.text();

      if (ext === 'json') {
        const project = await importProjectFromFile(file);
        onImportProject(project);
        setSuccess(`成功导入项目: ${file.name}`);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        const parsed = detectAndParse(file.name, content);
        if (Object.keys(parsed).length === 0) {
          setError('无法识别CSV数据格式，请检查列名');
          return;
        }
        onImportData(parsed as Record<string, unknown>);
        setSuccess(`成功导入数据: ${file.name}`);
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (e) {
      setError(`导入失败: ${(e as Error).message}`);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

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

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#16213e',
          borderRadius: '16px',
          width: '500px',
          maxWidth: '90vw',
          border: '1px solid #2a3a5a',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #2a3a5a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Upload size={20} color="#e94560" />
            <span style={{ fontWeight: '600', color: '#e94560', fontSize: '16px' }}>
              导入数据
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#8888aa',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? '#e94560' : '#2a3a5a'}`,
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: dragActive ? 'rgba(233, 69, 96, 0.05)' : '#1a1a2e',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Upload
              size={48}
              color={dragActive ? '#e94560' : '#444466'}
              style={{ marginBottom: '16px' }}
            />
            <p style={{ margin: '0 0 8px 0', color: '#ddddee', fontSize: '14px' }}>
              {dragActive ? '释放文件以导入' : '拖放文件到这里'}
            </p>
            <p style={{ margin: 0, color: '#666688', fontSize: '12px' }}>
              或点击选择文件
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <div
            style={{
              marginTop: '20px',
              padding: '16px',
              backgroundColor: '#1a1a2e',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <FileText size={16} color="#8888aa" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#aaaacc' }}>
                支持的格式
              </span>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e94560', marginBottom: '4px' }}>
                JSON (完整项目)
              </div>
              <div style={{ fontSize: '11px', color: '#666688' }}>
                包含舞台、吊杆、灯具、演员、时间轴等完整配置
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e94560', marginBottom: '4px' }}>
                CSV (单项数据)
              </div>
              <div style={{ fontSize: '11px', color: '#666688' }}>
                可分别导入：舞台尺寸、吊杆清单、灯具清单、演员走位时间表、限制区等
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: 'rgba(255, 68, 68, 0.1)',
                border: '1px solid rgba(255, 68, 68, 0.3)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} color="#ff4444" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '12px', color: '#ff8888' }}>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: 'rgba(68, 170, 68, 0.1)',
                border: '1px solid rgba(68, 170, 68, 0.3)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '16px' }}>✓</span>
              <span style={{ fontSize: '12px', color: '#88cc88' }}>{success}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
