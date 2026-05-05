import React, { useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { 
  parseRouteCSV, 
  parseMemberFlowCSV, 
  parseAscentCSV, 
  parseIncidentNoteCSV,
  detectFileType,
  parseJSON
} from '../../services/importService';
import type { 
  AppData,
  ImportResult
} from '../../types';
import './DataImport.css';

const DataImport: React.FC = () => {
  const { dispatch } = useAppContext();
  const [isDragging, setIsDragging] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const processFiles = async (files: File[]) => {
    setIsImporting(true);
    const results: ImportResult[] = [];
    
    for (const file of files) {
      try {
        const content = await readFile(file);
        const result = await processFile(file, content);
        results.push(result);
        
        if (result.success) {
          dispatchResultToStore(result, content);
        }
      } catch (error) {
        results.push({
          success: false,
          type: 'unknown',
          recordsCount: 0,
          errors: [`处理文件 "${file.name}" 时出错: ${(error as Error).message}`],
          warnings: []
        });
      }
    }
    
    setImportResults(prev => [...prev, ...results]);
    setIsImporting(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  };

  const processFile = async (file: File, content: string): Promise<ImportResult> => {
    const fileType = detectFileType(file.name, content);
    
    switch (fileType) {
      case 'routes': {
        const { data, result } = parseRouteCSV(content);
        if (data.length > 0) {
          return result;
        }
        return result;
      }
      
      case 'memberFlow': {
        const { data, result } = parseMemberFlowCSV(content);
        if (data.length > 0) {
          return result;
        }
        return result;
      }
      
      case 'ascent': {
        const { data, result } = parseAscentCSV(content);
        if (data.length > 0) {
          return result;
        }
        return result;
      }
      
      case 'incidentNote': {
        const { data, result } = parseIncidentNoteCSV(content);
        if (data.length > 0) {
          return result;
        }
        return result;
      }
      
      case 'appData': {
        const jsonData = parseJSON<AppData>(content);
        if (jsonData) {
          return {
            success: true,
            type: 'appData',
            recordsCount: 1,
            errors: [],
            warnings: []
          };
        }
        return {
          success: false,
          type: 'appData',
          recordsCount: 0,
          errors: ['JSON 格式不正确'],
          warnings: []
        };
      }
      
      default:
        return {
          success: false,
          type: 'unknown',
          recordsCount: 0,
          errors: [`无法识别文件类型: ${file.name}`],
          warnings: [
            '支持的文件格式：',
            '- 线路表: 包含"线路"、"难度"、"区域"等字段的 CSV',
            '- 客流记录: 包含"会员"、"入场时间"等字段的 CSV',
            '- 完攀记录: 包含"线路"、"成功"、"时间"等字段的 CSV',
            '- 伤情投诉: 包含"类型"、"标题"等字段的 CSV',
            '- 完整数据: 包含 routes、memberFlows 等字段的 JSON'
          ]
        };
    }
  };

  const dispatchResultToStore = (result: ImportResult, content: string) => {
    switch (result.type) {
      case 'routes': {
        const { data } = parseRouteCSV(content);
        if (data.length > 0) {
          dispatch({ type: 'SET_ROUTES', payload: data });
        }
        break;
      }
      
      case 'memberFlow': {
        const { data } = parseMemberFlowCSV(content);
        if (data.length > 0) {
          dispatch({ type: 'SET_MEMBER_FLOWS', payload: data });
        }
        break;
      }
      
      case 'ascent': {
        const { data } = parseAscentCSV(content);
        if (data.length > 0) {
          dispatch({ type: 'SET_ASCENTS', payload: data });
        }
        break;
      }
      
      case 'incidentNote': {
        const { data } = parseIncidentNoteCSV(content);
        if (data.length > 0) {
          dispatch({ type: 'SET_INCIDENT_NOTES', payload: data });
        }
        break;
      }
      
      case 'appData': {
        const data = parseJSON<AppData>(content);
        if (data) {
          dispatch({ type: 'SET_DATA', payload: data });
        }
        break;
      }
    }
  };

  const clearResults = () => {
    setImportResults([]);
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      routes: '线路表',
      memberFlow: '客流记录',
      ascent: '完攀记录',
      incidentNote: '伤情/投诉',
      appData: '完整数据'
    };
    return labels[type] || type;
  };

  return (
    <div className="data-import">
      <div className="data-import__header">
        <h3>数据导入</h3>
        <p className="data-import__description">
          支持导入线路表、会员刷卡客流、完攀记录和伤情/投诉备注。
          可以拖放多个文件到下方区域，或点击选择文件。
        </p>
      </div>

      <div
        className={`data-import__dropzone ${isDragging ? 'data-import__dropzone--dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        {isImporting ? (
          <div className="data-import__loading">
            <div className="data-import__spinner"></div>
            <p>正在处理文件...</p>
          </div>
        ) : (
          <>
            <div className="data-import__icon">📁</div>
            <p className="data-import__text">
              拖放文件到这里，或<span className="data-import__highlight">点击选择文件</span>
            </p>
            <p className="data-import__hint">
              支持 CSV 和 JSON 格式
            </p>
          </>
        )}
      </div>

      {importResults.length > 0 && (
        <div className="data-import__results">
          <div className="data-import__results-header">
            <h4>导入结果</h4>
            <button
              className="data-import__clear-btn"
              onClick={clearResults}
            >
              清除
            </button>
          </div>
          
          <div className="data-import__results-list">
            {importResults.map((result, index) => (
              <div
                key={index}
                className={`data-import__result-item ${
                  result.success 
                    ? 'data-import__result-item--success' 
                    : 'data-import__result-item--error'
                }`}
              >
                <div className="data-import__result-icon">
                  {result.success ? '✅' : '❌'}
                </div>
                <div className="data-import__result-content">
                  <div className="data-import__result-type">
                    {getTypeLabel(result.type)}
                    {result.recordsCount > 0 && (
                      <span className="data-import__result-count">
                        ({result.recordsCount} 条记录)
                      </span>
                    )}
                  </div>
                  
                  {result.errors.length > 0 && (
                    <div className="data-import__result-errors">
                      <div className="data-import__result-label">错误:</div>
                      <ul>
                        {result.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {result.warnings.length > 0 && (
                    <div className="data-import__result-warnings">
                      <div className="data-import__result-label">提示:</div>
                      <ul>
                        {result.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="data-import__tips">
        <h4>📋 导入文件格式说明</h4>
        <div className="data-import__tips-grid">
          <div className="data-import__tip-item">
            <strong>线路表 (CSV)</strong>
            <p>必需字段: 线路名称、难度</p>
            <p>可选字段: 区域、颜色、定线员、定线日期</p>
          </div>
          
          <div className="data-import__tip-item">
            <strong>客流记录 (CSV)</strong>
            <p>必需字段: 会员标识、入场时间</p>
            <p>可选字段: 离场时间、活动区域、活动类型</p>
          </div>
          
          <div className="data-import__tip-item">
            <strong>完攀记录 (CSV)</strong>
            <p>必需字段: 线路标识、会员标识、时间、成功状态</p>
            <p>可选字段: 尝试次数、攀爬方式、备注</p>
          </div>
          
          <div className="data-import__tip-item">
            <strong>伤情/投诉 (CSV)</strong>
            <p>必需字段: 类型、标题、时间</p>
            <p>可选字段: 线路标识、会员标识、描述、严重程度</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataImport;
