import React, { useState } from 'react';
import { exportApi } from '../api';
import { useAppStore } from '../store';

export default function ImportExport() {
  const { showNotification } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      showNotification('warning', '请选择文件');
      return;
    }

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch('/api/import/slots', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        showNotification('success', '导入成功');
        setSelectedFile(null);
      }
    } catch (error) {
      showNotification('error', '导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>📦 数据导入导出</h2>

      <div className="grid-2" style={{ gap: '20px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>📥 导入数据</h3>
          
          <div 
            className="upload-area"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📁</div>
            <p>点击选择文件或拖拽文件到此处</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>支持 CSV 格式</p>
          </div>
          
          <input
            id="file-upload"
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {selectedFile && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
              <p><strong>已选择文件:</strong> {selectedFile.name}</p>
              <p style={{ fontSize: '12px', color: '#6c757d' }}>
                大小: {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!selectedFile || importing}
            style={{ marginTop: '16px', width: '100%' }}
          >
            {importing ? <span className="spinner" style={{ marginRight: '8px' }}></span> : null}
            导入号源数据
          </button>

          <div style={{ marginTop: '20px', padding: '16px', background: '#e3f2fd', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>📋 CSV 文件格式说明</h4>
            <p style={{ fontSize: '12px', color: '#666' }}>
              文件应包含以下列：
            </p>
            <ul style={{ fontSize: '12px', color: '#666', paddingLeft: '20px', marginTop: '8px' }}>
              <li><code>department_id</code> - 科室ID</li>
              <li><code>department_name</code> - 科室名称</li>
              <li><code>external_system_id</code> - 外部系统ID</li>
              <li><code>date</code> - 日期 (YYYY-MM-DD)</li>
              <li><code>time_slot</code> - 时段</li>
              <li><code>total_count</code> - 总号数</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>📤 导出数据</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => exportApi.exportSlots()}
              style={{ justifyContent: 'flex-start' }}
            >
              📋 导出号源列表
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => exportApi.exportVouchers()}
              style={{ justifyContent: 'flex-start' }}
            >
              📄 导出预约凭证
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => exportApi.exportStatistics()}
              style={{ justifyContent: 'flex-start' }}
            >
              📊 导出统计报表
            </button>
          </div>

          <div style={{ marginTop: '20px', padding: '16px', background: '#e8f5e9', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>💡 导出说明</h4>
            <ul style={{ fontSize: '12px', color: '#666', paddingLeft: '20px', marginTop: '8px' }}>
              <li>号源列表：包含所有号源的详细信息</li>
              <li>预约凭证：包含所有预约记录和状态</li>
              <li>统计报表：按日期和科室的统计数据</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3>📋 API 接口文档</h3>
        <table className="table" style={{ marginTop: '16px' }}>
          <thead>
            <tr>
              <th>接口</th>
              <th>方法</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>/api/slots</code></td>
              <td>GET</td>
              <td>获取号源列表，支持筛选：department_id, date, status, page, pageSize</td>
            </tr>
            <tr>
              <td><code>/api/slots/:id</code></td>
              <td>GET</td>
              <td>获取单个号源详情</td>
            </tr>
            <tr>
              <td><code>/api/slots/:id/timeline</code></td>
              <td>GET</td>
              <td>获取号源时间线（锁号、凭证、释放、冲突记录）</td>
            </tr>
            <tr>
              <td><code>/api/slots/:id/lock</code></td>
              <td>POST</td>
              <td>锁号操作</td>
            </tr>
            <tr>
              <td><code>/api/locks/:id/release</code></td>
              <td>POST</td>
              <td>释放锁号</td>
            </tr>
            <tr>
              <td><code>/api/locks/:id/confirm</code></td>
              <td>POST</td>
              <td>确认锁号并生成预约凭证</td>
            </tr>
            <tr>
              <td><code>/api/vouchers/:id/checkin</code></td>
              <td>POST</td>
              <td>凭证签到</td>
            </tr>
            <tr>
              <td><code>/api/vouchers/:id/cancel</code></td>
              <td>POST</td>
              <td>取消预约</td>
            </tr>
            <tr>
              <td><code>/api/conflicts/:id/resolve</code></td>
              <td>POST</td>
              <td>处理冲突（解决/忽略）</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
