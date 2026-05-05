import React, { useState, useEffect } from 'react';
import path from 'path';

interface CreateProjectModalProps {
  folderPath: string | null;
  onCancel: () => void;
  onConfirm: (projectName: string) => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ 
  folderPath, 
  onCancel, 
  onConfirm 
}) => {
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (folderPath) {
      const name = path.basename(folderPath);
      setProjectName(name);
    }
  }, [folderPath]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim()) {
      onConfirm(projectName.trim());
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">创建新项目</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">项目名称</label>
              <input
                type="text"
                className="form-input"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="请输入项目名称"
                autoFocus
              />
            </div>

            {folderPath && (
              <div className="form-group">
                <label className="form-label">文件夹路径</label>
                <div 
                  className="form-text" 
                  style={{ 
                    background: '#f5f5f5', 
                    padding: '12px', 
                    borderRadius: '6px',
                    fontFamily: 'SF Mono, Monaco, monospace',
                    wordBreak: 'break-all'
                  }}
                >
                  {folderPath}
                </div>
              </div>
            )}

            <div style={{ 
              background: '#e6f7ff', 
              padding: '16px', 
              borderRadius: '8px',
              border: '1px solid #91d5ff'
            }}>
              <div style={{ fontWeight: 600, color: '#1890ff', marginBottom: '8px' }}>
                💡 提示
              </div>
              <div style={{ fontSize: '13px', color: '#333', lineHeight: 1.6 }}>
                创建项目后，系统将自动扫描文件夹中的所有文件，并检测其中的敏感信息。
                您可以逐条确认或忽略检测结果，然后应用脱敏处理并导出交付包。
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              取消
            </button>
            <button 
              type="submit" 
              className="btn btn-success"
              disabled={!projectName.trim()}
            >
              创建项目
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
