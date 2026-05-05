import React, { useState } from 'react';
import { parseHiveLedger, parseSensorData, parseInspectionRecords, parseWateringShadingSchedule } from '../utils/csvParser';
import './FileImporter.css';

const FileImporter = ({ onImportHives, onImportSensorData, onImportInspectionRecords, onImportWateringSchedules }) => {
  const [activeTab, setActiveTab] = useState('hives');
  const [importStatus, setImportStatus] = useState(null);
  const [importedCount, setImportedCount] = useState(0);

  const handleFileUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setImportStatus('loading');
      
      const text = await file.text();
      let parsedData;
      let importFunction;

      switch (type) {
        case 'hives':
          parsedData = parseHiveLedger(text);
          importFunction = onImportHives;
          break;
        case 'sensor':
          parsedData = parseSensorData(text);
          importFunction = onImportSensorData;
          break;
        case 'inspection':
          parsedData = parseInspectionRecords(text);
          importFunction = onImportInspectionRecords;
          break;
        case 'watering':
          parsedData = parseWateringShadingSchedule(text);
          importFunction = onImportWateringSchedules;
          break;
        default:
          throw new Error('未知的导入类型');
      }

      if (parsedData.length === 0) {
        setImportStatus('error');
        setImportedCount(0);
        return;
      }

      importFunction(parsedData);
      setImportedCount(parsedData.length);
      setImportStatus('success');
      
      setTimeout(() => {
        setImportStatus(null);
      }, 3000);

    } catch (error) {
      console.error('文件导入失败:', error);
      setImportStatus('error');
    }

    event.target.value = '';
  };

  const tabs = [
    { id: 'hives', label: '蜂箱台账', icon: '📋', description: '导入蜂箱基本信息，包括ID、位置坐标、蜂王状态等' },
    { id: 'sensor', label: '温湿度数据', icon: '🌡️', description: '导入温湿度传感器数据，用于检测过热风险' },
    { id: 'inspection', label: '检查记录', icon: '🔍', description: '导入开箱检查记录，用于评估蜂王状态和蜂群健康' },
    { id: 'watering', label: '补水遮阴', icon: '💧', description: '导入补水和遮阴安排，用于检测缺水风险' }
  ];

  const getTabContent = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    const acceptTypes = '.csv,.txt';
    
    return (
      <div className="import-content">
        <p className="import-description">{tab.description}</p>
        
        <div className="import-area">
          <input
            type="file"
            id={`file-upload-${tabId}`}
            accept={acceptTypes}
            onChange={(e) => handleFileUpload(e, tabId)}
            className="file-input"
          />
          <label htmlFor={`file-upload-${tabId}`} className="file-label">
            <span className="file-icon">{tab.icon}</span>
            <span className="file-text">点击选择CSV文件</span>
            <span className="file-hint">或拖拽文件到此处</span>
          </label>
        </div>

        {importStatus && (
          <div className={`import-status ${importStatus}`}>
            {importStatus === 'loading' && (
              <span>正在导入...</span>
            )}
            {importStatus === 'success' && (
              <span>✅ 成功导入 {importedCount} 条记录</span>
            )}
            {importStatus === 'error' && (
              <span>❌ 导入失败，请检查文件格式</span>
            )}
          </div>
        )}

        <div className="format-hint">
          <h4>文件格式提示</h4>
          {getFormatExample(tabId)}
        </div>
      </div>
    );
  };

  const getFormatExample = (tabId) => {
    switch (tabId) {
      case 'hives':
        return (
          <pre>
{`蜂箱ID,X坐标,Y坐标,蜂王状态,蜂群数量
A01,1,1,正常,50000
A02,2,1,产卵,45000
B01,1,2,未见,35000`}
          </pre>
        );
      case 'sensor':
        return (
          <pre>
{`蜂箱ID,温度,湿度,时间戳
A01,36.5,45,2026-05-05T18:00:00
A02,34.2,52,2026-05-05T18:00:00
B01,38.1,38,2026-05-05T18:00:00`}
          </pre>
        );
      case 'inspection':
        return (
          <pre>
{`蜂箱ID,检查日期,蜂王观察,子脾模式,储蜜情况,病虫害
A01,2026-05-04,true,normal,normal,none
A02,2026-05-03,true,normal,good,none
B01,2026-05-02,false,irregular,low,mites`}
          </pre>
        );
      case 'watering':
        return (
          <pre>
{`蜂箱ID,上次补水日期,下次补水日期,遮阴状态,遮阴备注
A01,2026-05-03,2026-05-06,false,
A02,2026-05-01,2026-05-04,true,已安装遮阳网
B01,2026-04-28,2026-05-01,false,需要补水`}
          </pre>
        );
      default:
        return null;
    }
  };

  return (
    <div className="file-importer-container">
      <h3 className="importer-title">数据导入</h3>
      
      <div className="tabs-container">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setImportStatus(null);
            }}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="tab-content">
        {getTabContent(activeTab)}
      </div>
    </div>
  );
};

export default FileImporter;
