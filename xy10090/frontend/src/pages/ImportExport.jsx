import { useState, useRef } from 'react';
import { importExport, STATUS_MAP } from '../api';

function ImportExport() {
  const [message, setMessage] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [exportFilters, setExportFilters] = useState({
    status: 'all',
    keyword: ''
  });

  const csvInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportResult(null);
      const res = await importExport.importCSV(file);
      if (res.success) {
        setImportResult(res.data);
        showMessage(
          res.data.errors?.length > 0 ? 'error' : 'success',
          `导入完成：成功 ${res.data.imported}/${res.data.total}`
        );
      } else {
        showMessage('error', res.error || '导入失败');
      }
    } catch (err) {
      showMessage('error', '导入失败: ' + err.message);
    } finally {
      setImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleJSONImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportResult(null);
      const res = await importExport.importJSON(file);
      if (res.success) {
        setImportResult(res.data);
        showMessage(
          res.data.errors?.length > 0 ? 'error' : 'success',
          `导入完成：成功 ${res.data.imported}/${res.data.total}`
        );
      } else {
        showMessage('error', res.error || '导入失败');
      }
    } catch (err) {
      showMessage('error', '导入失败: ' + err.message);
    } finally {
      setImporting(false);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  };

  const handleExport = (format) => {
    const params = { ...exportFilters };
    if (params.status === 'all') delete params.status;

    const url = format === 'csv'
      ? importExport.exportCSV(params)
      : importExport.exportJSON(params);

    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage('success', `导出 ${format.toUpperCase()} 已开始`);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">导入导出</h1>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">📥 数据导入</div>
        </div>
        <div className="card-body">
          {importing && (
            <div className="alert alert-info">正在处理文件，请稍候...</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <div className="stat-label" style={{ marginBottom: '12px' }}>
                从 CSV 导入
              </div>
              <div
                className="file-upload"
                onClick={() => csvInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
              >
                <div className="file-upload-icon">📄</div>
                <div>点击或拖拽上传 CSV 文件</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                  支持字段：票据号、开票日期、供应商、金额、税额、税号、供应商税号、审批金额、审批人、审批日期、审批意见
                </div>
              </div>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleCSVImport}
              />
            </div>

            <div>
              <div className="stat-label" style={{ marginBottom: '12px' }}>
                从 JSON 导入
              </div>
              <div
                className="file-upload"
                onClick={() => jsonInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
              >
                <div className="file-upload-icon">📋</div>
                <div>点击或拖拽上传 JSON 文件</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                  支持数组格式或包含 invoices 字段的对象
                </div>
              </div>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleJSONImport}
              />
            </div>
          </div>

          {importResult && (
            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                background:
                  importResult.errors?.length > 0 ? '#fef2f2' : '#f0fdf4',
                border:
                  '1px solid ' + (importResult.errors?.length > 0 ? '#fecaca' : '#bbf7d0'),
                borderRadius: '8px'
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                导入结果
              </div>
              <div style={{ fontSize: '14px' }}>
                总计: {importResult.total} | 成功: {importResult.imported} | 失败:{' '}
                {importResult.errors?.length || 0}
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    错误详情：
                  </div>
                  {importResult.errors.slice(0, 10).map((err, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: '12px',
                        color: '#dc2626',
                        padding: '4px 0'
                      }}
                    >
                      第 {err.row || err.index + 1} 行: {err.error}
                    </div>
                  ))}
                  {importResult.errors.length > 10 && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      还有 {importResult.errors.length - 10} 条错误...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div className="card-title">📤 数据导出</div>
        </div>
        <div className="card-body">
          <div className="filter-bar" style={{ marginBottom: '20px' }}>
            <div className="filter-group">
              <label className="form-label" style={{ marginBottom: 0 }}>状态筛选:</label>
              <select
                className="select-field"
                value={exportFilters.status}
                onChange={(e) =>
                  setExportFilters((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="all">全部状态</option>
                {Object.entries(STATUS_MAP).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label className="form-label" style={{ marginBottom: 0 }}>关键词:</label>
              <input
                type="text"
                className="input-field"
                placeholder="搜索票据号、供应商..."
                value={exportFilters.keyword}
                onChange={(e) =>
                  setExportFilters((prev) => ({ ...prev, keyword: e.target.value }))
                }
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" onClick={() => handleExport('csv')}>
              📄 导出 CSV
            </button>
            <button className="btn btn-secondary" onClick={() => handleExport('json')}>
              📋 导出 JSON
            </button>
          </div>

          <div
            className="alert alert-info"
            style={{ marginTop: '20px', marginBottom: 0 }}
          >
            💡 导出的文件包含：票据号、开票日期、供应商、金额、税额、税号、审批信息、状态、异常数等完整字段
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div className="card-title">📋 导入格式说明</div>
        </div>
        <div className="card-body">
          <div style={{ fontSize: '13px', lineHeight: 2 }}>
            <div style={{ marginBottom: '12px' }}>
              <strong>CSV 字段（支持中英文列名）:</strong>
            </div>
            <div
              style={{
                background: '#f9fafb',
                padding: '16px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
            >
              票据号, 开票日期, 供应商, 金额, 税额, 税号, 供应商税号, 审批金额, 审批人, 审批日期, 审批意见
            </div>

            <div style={{ marginTop: '20px', marginBottom: '12px' }}>
              <strong>JSON 格式示例:</strong>
            </div>
            <div
              style={{
                background: '#f9fafb',
                padding: '16px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                overflowX: 'auto'
              }}
            >
              <pre style={{ margin: 0 }}>{`[
  {
    "invoice_number": "INV001",
    "invoice_date": "2024-01-15",
    "vendor_name": "科技有限公司",
    "amount": 1000,
    "tax_amount": 130,
    "tax_number": "91110100MA00123456",
    "approval_amount": 1000,
    "approver_name": "张三",
    "approval_date": "2024-01-20",
    "approval_comments": "同意报销"
  }
]`}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportExport;
