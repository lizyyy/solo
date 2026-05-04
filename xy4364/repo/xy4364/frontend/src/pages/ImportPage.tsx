import React, { useState, useRef } from 'react';
import { batchApi, temperatureCurveApi, formulaApi } from '../api';

interface ImportPageProps {
  onImportSuccess: () => void;
}

function ImportPage({ onImportSuccess }: ImportPageProps) {
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [tempCurveFile, setTempCurveFile] = useState<File | null>(null);
  const [formulaFile, setFormulaFile] = useState<File | null>(null);
  const [batchNumber, setBatchNumber] = useState('');
  
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const tempCurveFileInputRef = useRef<HTMLInputElement>(null);
  const formulaFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (file: File | null) => void,
    allowedTypes: string[]
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && allowedTypes.includes(ext)) {
        setFile(file);
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: `请选择 ${allowedTypes.join(', ')} 格式的文件` });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (
    e: React.DragEvent,
    setFile: (file: File | null) => void,
    allowedTypes: string[]
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && allowedTypes.includes(ext)) {
        setFile(file);
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: `请选择 ${allowedTypes.join(', ')} 格式的文件` });
      }
    }
  };

  const handleImportBatch = async () => {
    if (!batchFile) {
      setMessage({ type: 'error', text: '请选择要导入的批次 CSV 文件' });
      return;
    }

    setImporting(true);
    setMessage({ type: 'info', text: '正在导入批次数据...' });

    try {
      const result = await batchApi.importCSV(batchFile);
      setMessage({ type: 'success', text: `成功导入 ${result.batches.length} 个批次！` });
      setBatchFile(null);
      if (batchFileInputRef.current) {
        batchFileInputRef.current.value = '';
      }
      onImportSuccess();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '导入失败，请重试' });
    } finally {
      setImporting(false);
    }
  };

  const handleImportTempCurve = async () => {
    if (!tempCurveFile) {
      setMessage({ type: 'error', text: '请选择要导入的温度曲线 JSON 文件' });
      return;
    }

    setImporting(true);
    setMessage({ type: 'info', text: '正在导入温度曲线数据...' });

    try {
      await temperatureCurveApi.importJSON(tempCurveFile, batchNumber || undefined);
      setMessage({ type: 'success', text: '温度曲线数据导入成功！' });
      setTempCurveFile(null);
      if (tempCurveFileInputRef.current) {
        tempCurveFileInputRef.current.value = '';
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '导入失败，请重试' });
    } finally {
      setImporting(false);
    }
  };

  const handleImportFormula = async () => {
    if (!formulaFile) {
      setMessage({ type: 'error', text: '请选择要导入的配方 JSON 文件' });
      return;
    }

    setImporting(true);
    setMessage({ type: 'info', text: '正在导入配方数据...' });

    try {
      await formulaApi.importJSON(formulaFile, batchNumber || undefined);
      setMessage({ type: 'success', text: '配方数据导入成功！' });
      setFormulaFile(null);
      if (formulaFileInputRef.current) {
        formulaFileInputRef.current.value = '';
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '导入失败，请重试' });
    } finally {
      setImporting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">数据导入</h1>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.5rem' }}>
          {message.text}
        </div>
      )}

      <div className="import-section">
        <div className="import-section-header">
          <span className="import-section-icon">📋</span>
          <div>
            <h2 className="import-section-title">1. 导入布卷批次 CSV</h2>
            <p className="import-section-desc">
              导入包含批次号、面料类型、客户名称、目标色 Lab 值和测量色 Lab 值的 CSV 文件
            </p>
          </div>
        </div>

        <div
          className="dropzone"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, setBatchFile, ['csv'])}
          onClick={() => batchFileInputRef.current?.click()}
        >
          <input
            ref={batchFileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelect(e, setBatchFile, ['csv'])}
          />
          <div className="dropzone-icon">📁</div>
          <div className="dropzone-text">
            点击选择或拖拽文件到此处
          </div>
          <div className="dropzone-hint">支持 .csv 格式</div>
        </div>

        {batchFile && (
          <div className="file-info">
            <span className="file-info-icon">📄</span>
            <div>
              <div className="file-info-name">{batchFile.name}</div>
              <div className="file-info-size">{formatFileSize(batchFile.size)}</div>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setBatchFile(null);
                if (batchFileInputRef.current) {
                  batchFileInputRef.current.value = '';
                }
              }}
            >
              移除
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleImportBatch}
              disabled={importing}
            >
              {importing ? '导入中...' : '导入'}
            </button>
          </div>
        )}

        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
          <strong>CSV 文件格式示例：</strong>
          <pre style={{ 
            marginTop: '0.5rem', 
            padding: '0.75rem', 
            background: 'white', 
            borderRadius: '4px',
            fontSize: '0.75rem',
            overflowX: 'auto'
          }}>
{`batchNumber,fabricType,customerName,targetColor_L,targetColor_a,targetColor_b,measuredColor_L,measuredColor_a,measuredColor_b
B2024001,纯棉府绸,客户A,85.2,-12.5,32.1,84.8,-11.8,31.5
B2024002,涤棉混纺,客户B,72.5,18.3,-25.6,73.1,17.9,-26.2`}
          </pre>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            支持中英文表头：batchNumber(批次号), fabricType(面料类型), customerName(客户名称), 
            targetColor_L(目标色_L), targetColor_a(目标色_a), targetColor_b(目标色_b),
            measuredColor_L(测量色_L), measuredColor_a(测量色_a), measuredColor_b(测量色_b)
          </p>
        </div>
      </div>

      <div className="import-section">
        <div className="import-section-header">
          <span className="import-section-icon">🌡️</span>
          <div>
            <h2 className="import-section-title">2. 导入染缸温度曲线 JSON</h2>
            <p className="import-section-desc">
              导入包含目标温度曲线和实际温度曲线的 JSON 文件
            </p>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">关联批次号（可选）</label>
          <input
            type="text"
            className="form-input"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
            placeholder="输入批次号以关联数据，或在 JSON 文件中包含 batchNumber 字段"
            style={{ maxWidth: '400px' }}
          />
        </div>

        <div
          className="dropzone"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, setTempCurveFile, ['json'])}
          onClick={() => tempCurveFileInputRef.current?.click()}
        >
          <input
            ref={tempCurveFileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelect(e, setTempCurveFile, ['json'])}
          />
          <div className="dropzone-icon">📁</div>
          <div className="dropzone-text">
            点击选择或拖拽文件到此处
          </div>
          <div className="dropzone-hint">支持 .json 格式</div>
        </div>

        {tempCurveFile && (
          <div className="file-info">
            <span className="file-info-icon">📄</span>
            <div>
              <div className="file-info-name">{tempCurveFile.name}</div>
              <div className="file-info-size">{formatFileSize(tempCurveFile.size)}</div>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setTempCurveFile(null);
                if (tempCurveFileInputRef.current) {
                  tempCurveFileInputRef.current.value = '';
                }
              }}
            >
              移除
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleImportTempCurve}
              disabled={importing}
            >
              {importing ? '导入中...' : '导入'}
            </button>
          </div>
        )}

        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
          <strong>JSON 文件格式示例：</strong>
          <pre style={{ 
            marginTop: '0.5rem', 
            padding: '0.75rem', 
            background: 'white', 
            borderRadius: '4px',
            fontSize: '0.75rem',
            overflowX: 'auto'
          }}>
{`{
  "batchNumber": "B2024001",
  "targetCurve": [
    { "time": 0, "temperature": 25 },
    { "time": 10, "temperature": 60 },
    { "time": 30, "temperature": 130 },
    { "time": 60, "temperature": 130 },
    { "time": 70, "temperature": 80 }
  ],
  "actualCurve": [
    { "time": 0, "temperature": 25 },
    { "time": 10, "temperature": 58 },
    { "time": 30, "temperature": 125 },
    { "time": 60, "temperature": 128 },
    { "time": 70, "temperature": 82 }
  ]
}`}
          </pre>
        </div>
      </div>

      <div className="import-section">
        <div className="import-section-header">
          <span className="import-section-icon">⚗️</span>
          <div>
            <h2 className="import-section-title">3. 导入配方记录 JSON</h2>
            <p className="import-section-desc">
              导入包含目标配方和实际添加记录的 JSON 文件，系统将自动检测漏加助剂
            </p>
          </div>
        </div>

        <div
          className="dropzone"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, setFormulaFile, ['json'])}
          onClick={() => formulaFileInputRef.current?.click()}
        >
          <input
            ref={formulaFileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelect(e, setFormulaFile, ['json'])}
          />
          <div className="dropzone-icon">📁</div>
          <div className="dropzone-text">
            点击选择或拖拽文件到此处
          </div>
          <div className="dropzone-hint">支持 .json 格式</div>
        </div>

        {formulaFile && (
          <div className="file-info">
            <span className="file-info-icon">📄</span>
            <div>
              <div className="file-info-name">{formulaFile.name}</div>
              <div className="file-info-size">{formatFileSize(formulaFile.size)}</div>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setFormulaFile(null);
                if (formulaFileInputRef.current) {
                  formulaFileInputRef.current.value = '';
                }
              }}
            >
              移除
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleImportFormula}
              disabled={importing}
            >
              {importing ? '导入中...' : '导入'}
            </button>
          </div>
        )}

        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
          <strong>JSON 文件格式示例：</strong>
          <pre style={{ 
            marginTop: '0.5rem', 
            padding: '0.75rem', 
            background: 'white', 
            borderRadius: '4px',
            fontSize: '0.75rem',
            overflowX: 'auto'
          }}>
{`{
  "batchNumber": "B2024001",
  "targetFormula": [
    { "chemicalName": "活性红 X-3B", "dosage": 2.5, "unit": "g/L" },
    { "chemicalName": "活性黄 X-6G", "dosage": 1.2, "unit": "g/L" },
    { "chemicalName": "元明粉", "dosage": 50, "unit": "g/L" },
    { "chemicalName": "纯碱", "dosage": 20, "unit": "g/L" }
  ],
  "actualFormula": [
    { "chemicalName": "活性红 X-3B", "dosage": 2.5, "unit": "g/L", "added": true },
    { "chemicalName": "活性黄 X-6G", "dosage": 1.2, "unit": "g/L", "added": true },
    { "chemicalName": "元明粉", "dosage": 50, "unit": "g/L", "added": true },
    { "chemicalName": "纯碱", "dosage": 20, "unit": "g/L", "added": false }
  ]
}`}
          </pre>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            系统将自动比较目标配方和实际添加记录，检测漏加的助剂并生成风险评估
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📝 客户目标色说明</h2>
        </div>
        <div className="card-body">
          <p style={{ marginBottom: '1rem' }}>
            客户目标色通过 Lab 色彩空间表示，这是印染行业最常用的颜色测量系统：
          </p>
          <div className="detail-grid">
            <div style={{ padding: '1rem', background: 'var(--bg-color)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>L* - 明度</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                范围 0-100，0 表示黑色，100 表示白色
              </div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--bg-color)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>a* - 红绿色轴</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                正值表示红色，负值表示绿色
              </div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--bg-color)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>b* - 黄蓝色轴</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                正值表示黄色，负值表示蓝色
              </div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--bg-color)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>DeltaE - 色差</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                总体色差，值越小表示颜色越接近
              </div>
            </div>
          </div>
          <div className="alert alert-info" style={{ marginTop: '1.5rem' }}>
            <strong>DeltaE 参考标准：</strong>
            <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
              <li>DeltaE ≤ 1: 肉眼几乎无法察觉</li>
              <li>DeltaE 1-3: 轻微差异，专业人员可察觉</li>
              <li>DeltaE 3-5: 明显差异，需要注意</li>
              <li>DeltaE > 5: 严重差异，建议返工</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportPage;
