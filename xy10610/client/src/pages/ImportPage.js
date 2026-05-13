import React, { useState } from 'react';
import axios from 'axios';

const ImportPage = () => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.CSV'))) {
      setFile(droppedFile);
      setResult(null);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post('/api/import/packages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setResult(res.data);
    } catch (err) {
      console.error('导入失败:', err);
      setResult({
        success: false,
        message: '导入失败，请检查文件格式'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const header = 'tracking_number,sender_name,sender_country,receiver_name,receiver_address,weight,declared_value,currency,product_name,quantity,unit_price,category\n';
    const sampleData = 'TEST001,Zhang Wei,China,John Smith,123 Main St, New York,2.5,150.00,USD,Smart Phone,1,150.00,electronics\n';
    const csvContent = header + sampleData;
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'import_template.csv');
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">批量导入</h1>
        <button className="btn btn-success" onClick={downloadTemplate}>
          📄 下载模板
        </button>
      </div>

      <div className="card">
        <div
          className={`upload-area ${isDragging ? 'dragover' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📤</div>
          <h3 style={{ marginBottom: '8px' }}>拖拽文件到此处或点击上传</h3>
          <p style={{ color: '#718096' }}>支持 CSV 格式文件</p>
          <input
            id="fileInput"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {file && (
          <div style={{ marginTop: '20px', padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>已选择文件：</strong> {file.name}
                <span style={{ marginLeft: '8px', color: '#718096' }}>
                  ({(file.size / 1024).toFixed(2)} KB)
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={loading}
              >
                {loading ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-4">
            <div className={`alert ${result.success || result.imported > 0 ? 'alert-success' : 'alert-error'}`}>
              <strong>导入结果</strong>
              <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
                <li>总记录数：{result.total || 0}</li>
                <li>成功导入：{result.imported || 0}</li>
                <li>失败：{result.failed || 0}</li>
              </ul>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ marginBottom: '8px' }}>错误详情：</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>行号</th>
                      <th>运单号</th>
                      <th>错误信息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, idx) => (
                      <tr key={idx}>
                        <td>{err.row}</td>
                        <td>{err.tracking_number || '-'}</td>
                        <td>{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <h3 className="section-title">导入说明</h3>
          <div style={{ color: '#4a5568', lineHeight: '1.8' }}>
            <p><strong>必填字段：</strong></p>
            <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
              <li><code>tracking_number</code> - 运单号（唯一）</li>
            </ul>

            <p><strong>可选字段：</strong></p>
            <ul style={{ marginLeft: '20px' }}>
              <li><code>sender_name</code> - 发件人姓名</li>
              <li><code>sender_country</code> - 发件国家</li>
              <li><code>receiver_name</code> - 收件人姓名</li>
              <li><code>receiver_address</code> - 收件地址</li>
              <li><code>weight</code> - 重量（kg）</li>
              <li><code>declared_value</code> - 申报价值</li>
              <li><code>currency</code> - 货币（默认 USD）</li>
              <li><code>product_name</code> - 商品名称</li>
              <li><code>quantity</code> - 数量</li>
              <li><code>unit_price</code> - 单价</li>
              <li><code>category</code> - 品类（general/electronics/luxury/food/cosmetics）</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportPage;
