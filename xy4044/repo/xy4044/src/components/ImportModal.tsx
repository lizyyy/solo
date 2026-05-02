import React, { useState, useRef } from 'react';

interface ImportModalProps {
  onClose: () => void;
  onImport: (file: File) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      onImport(selectedFile);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>导入会话</h3>
          <button 
            className="btn btn-icon btn-secondary btn-small"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              支持导入以下类型的文件：
            </p>
            <ul style={{ 
              fontSize: '12px', 
              color: 'var(--text-secondary)',
              marginLeft: '20px',
              marginBottom: '16px'
            }}>
              <li><strong>会话 JSON</strong> - 完整的会话数据（源、事件、校准结果）</li>
              <li><strong>WebRTC Stats JSON</strong> - WebRTC getStats 日志</li>
              <li><strong>音频峰值 CSV/JSON</strong> - 音频拍手峰值检测数据</li>
              <li><strong>视频帧 CSV/JSON</strong> - 视频闪光帧检测数据</li>
              <li><strong>人工锚点 CSV</strong> - 手动标记的同步点</li>
            </ul>
          </div>

          <div
            className={`drop-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="drop-zone-text">
              {selectedFile ? (
                <>
                  📄 <strong>{selectedFile.name}</strong>
                  <div className="drop-zone-hint">
                    {selectedFile.size} bytes
                  </div>
                </>
              ) : (
                <>
                  拖拽文件到这里，或点击选择文件
                  <div className="drop-zone-hint">
                    支持 .json 和 .csv 格式
                  </div>
                </>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary"
            onClick={onClose}
          >
            取消
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!selectedFile}
          >
            导入
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
