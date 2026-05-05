import React, { useState, useCallback } from 'react';

interface DropZoneProps {
  onDrop: (folderPath: string) => void;
  onLoadSample: () => void;
  isLoading: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ onDrop, onLoadSample, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    
    if (files.length > 0) {
      const folderPath = files[0].path;
      onDrop(folderPath);
    }
  }, [onDrop]);

  const handleSelectFolder = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      onDrop(folderPath);
    }
  };

  return (
    <div className="drop-zone">
      <div
        className={`drop-box ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="drop-icon">📁</div>
        <div className="drop-title">
          {isDragOver ? '松开以导入文件夹' : '拖入文件夹开始创建项目'}
        </div>
        <div className="drop-hint">
          支持拖拽项目文件夹到此处，或点击下方按钮选择
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSelectFolder}
          disabled={isLoading}
          style={{ fontSize: '14px', padding: '12px 32px' }}
        >
          {isLoading ? <span className="spinner" /> : '📂'} 选择文件夹
        </button>
      </div>

      <div className="sample-section">
        <div className="sample-hint">
          第一次使用？加载示例数据体验完整功能
        </div>
        <button
          className="btn btn-secondary"
          onClick={onLoadSample}
          disabled={isLoading}
        >
          {isLoading ? <span className="spinner" style={{ marginRight: '8px' }} /> : '📦'}
          加载示例项目
        </button>
      </div>

      <div style={{ marginTop: '40px', maxWidth: '600px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '16px', color: '#333' }}>支持检测的敏感信息类型</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '12px',
          textAlign: 'left'
        }}>
          <div style={{ padding: '12px', background: '#fff2f0', borderRadius: '8px' }}>
            <div style={{ fontWeight: 600, color: '#cf1322', marginBottom: '4px' }}>📱 联系方式</div>
            <div style={{ fontSize: '12px', color: '#666' }}>手机号、邮箱、QQ、微信</div>
          </div>
          <div style={{ padding: '12px', background: '#f9f0ff', borderRadius: '8px' }}>
            <div style={{ fontWeight: 600, color: '#722ed1', marginBottom: '4px' }}>🆔 身份信息</div>
            <div style={{ fontSize: '12px', color: '#666' }}>身份证、姓名、车牌号</div>
          </div>
          <div style={{ padding: '12px', background: '#e6f7ff', borderRadius: '8px' }}>
            <div style={{ fontWeight: 600, color: '#1890ff', marginBottom: '4px' }}>🏢 组织机构</div>
            <div style={{ fontSize: '12px', color: '#666' }}>公司名称、机构名称</div>
          </div>
          <div style={{ padding: '12px', background: '#fff7e6', borderRadius: '8px' }}>
            <div style={{ fontWeight: 600, color: '#fa8c16', marginBottom: '4px' }}>💳 金融信息</div>
            <div style={{ fontSize: '12px', color: '#666' }}>银行卡号、账户信息</div>
          </div>
          <div style={{ padding: '12px', background: '#e6fffb', borderRadius: '8px' }}>
            <div style={{ fontWeight: 600, color: '#13c2c2', marginBottom: '4px' }}>📍 地理位置</div>
            <div style={{ fontSize: '12px', color: '#666' }}>地址信息、省市区</div>
          </div>
          <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
            <div style={{ fontWeight: 600, color: '#666', marginBottom: '4px' }}>📝 文本文件</div>
            <div style={{ fontSize: '12px', color: '#666' }}>.txt, .md, .csv, .json</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DropZone;
