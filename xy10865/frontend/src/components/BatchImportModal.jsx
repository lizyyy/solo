import React, { useState } from 'react';

function BatchImportModal({ onClose, onSuccess }) {
  const [jsonData, setJsonData] = useState('');
  const [result, setResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const sampleData = JSON.stringify([
    {
      name: '示例服务A',
      description: '这是一个示例服务，用于演示批量导入功能',
      owner: '示例团队',
      tags: ['核心', 'API'],
      dependencies: [
        {
          name: 'MySQL-主库',
          url: 'mysql://localhost:3306/main',
          method: 'HEALTH',
          timeout: 3000
        },
        {
          name: 'Redis-缓存',
          url: 'redis://localhost:6379',
          method: 'PING',
          timeout: 1000
        }
      ]
    }
  ], null, 2);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setJsonData(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setJsonData(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(jsonData);
      const response = await fetch('/api/services/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      setResult(result);
      if (result.success.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (error) {
      setResult({ error: error.message });
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>📥 批量导入服务</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div
          className={`import-area ${isDragging ? 'dragover' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
          <p>拖拽 JSON 文件到此处或点击选择</p>
          <input
            id="fileInput"
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>

        <div className="form-group" style={{ marginTop: 20 }}>
          <label>或粘贴 JSON 数据</label>
          <textarea
            value={jsonData}
            onChange={(e) => setJsonData(e.target.value)}
            placeholder={sampleData}
            style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        <p className="import-hint">
          💡 提示: 数据格式为服务对象数组，每个服务可包含 name、description、owner、tags、dependencies 等字段
        </p>

        {result && (
          <div className={`import-result ${result.error ? 'error' : 'success'}`}>
            {result.error ? (
              <p>❌ 导入失败: {result.error}</p>
            ) : (
              <div>
                <p>✅ 导入成功: {result.success.length} 个服务</p>
                {result.failed.length > 0 && (
                  <p style={{ marginTop: 8, color: '#ef4444' }}>
                    ⚠️ 失败: {result.failed.length} 个
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!jsonData.trim()}
          >
            开始导入
          </button>
        </div>
      </div>
    </div>
  );
}

export default BatchImportModal;
