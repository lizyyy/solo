import React, { useState } from 'react';
import { FileText, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { importApi } from '../services/api';
import FileUpload from '../components/FileUpload';

const ImportPage = () => {
  const [activeTab, setActiveTab] = useState('ropes');
  const [importResults, setImportResults] = useState(null);
  const [importing, setImporting] = useState(false);

  const tabs = [
    { id: 'ropes', label: '绳索台账', description: '导入绳索基本信息 CSV' },
    { id: 'usage', label: '使用记录', description: '导入每日使用/冲坠记录 CSV' },
    { id: 'thresholds', label: '厂家阈值', description: '导入厂家阈值配置 JSON' }
  ];

  const currentTab = tabs.find(t => t.id === activeTab);

  const handleUpload = async (file) => {
    setImporting(true);
    setImportResults(null);

    try {
      let response;
      
      switch (activeTab) {
        case 'ropes':
          response = await importApi.importRopes(file);
          break;
        case 'usage':
          response = await importApi.importUsage(file);
          break;
        case 'thresholds':
          response = await importApi.importThresholds(file);
          break;
        default:
          throw new Error('未知的导入类型');
      }

      const data = response.data.data;
      setImportResults(data);
      
      if (data.errors > 0) {
        toast.warning(`导入完成，${data.imported} 条成功，${data.errors} 条失败`);
      } else {
        toast.success(`成功导入 ${data.imported} 条记录`);
      }
    } catch (error) {
      toast.error('导入失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setImporting(false);
    }
  };

  const getAcceptTypes = () => {
    switch (activeTab) {
      case 'thresholds':
        return '.json';
      case 'ropes':
      case 'usage':
      default:
        return '.csv,.txt';
    }
  };

  const getUploadLabel = () => {
    switch (activeTab) {
      case 'ropes':
        return '上传绳索台账 CSV';
      case 'usage':
        return '上传使用记录 CSV';
      case 'thresholds':
        return '上传厂家阈值 JSON';
      default:
        return '上传文件';
    }
  };

  return (
    <div>
      <div className="header">
        <h2>数据导入</h2>
      </div>

      <div className="page-content">
        <div className="tabs">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setImportResults(null);
              }}
            >
              {tab.label}
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{currentTab?.label}</h3>
          </div>
          <p className="text-secondary mb-4">{currentTab?.description}</p>

          <FileUpload
            onUpload={handleUpload}
            accept={getAcceptTypes()}
            label={getUploadLabel()}
            description={activeTab === 'thresholds' ? '支持 JSON 格式' : '支持 CSV 格式'}
            disabled={importing}
          />

          {importResults && (
            <div className="import-results">
              <h4>导入结果</h4>
              
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-green-600" size={18} />
                  <span>成功: <strong>{importResults.imported}</strong> 条</span>
                </div>
                {importResults.errors > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="text-red-600" size={18} />
                    <span>失败: <strong>{importResults.errors}</strong> 条</span>
                  </div>
                )}
              </div>

              {importResults.details && importResults.details.length > 0 && (
                <div className="mt-4">
                  <h5 className="font-medium mb-2">详情</h5>
                  <div className="max-h-60 overflow-y-auto">
                    {importResults.details.map((detail, index) => (
                      <div key={index} className="result-item">
                        <span>
                          {detail.rope_number || detail.brand || `第 ${index + 1} 条`}
                        </span>
                        <span className={`badge ${detail.action === 'created' ? 'badge-success' : 'badge-info'}`}>
                          {detail.action === 'created' ? '新增' : detail.action === 'updated' ? '更新' : detail.action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResults.not_found_ropes && importResults.not_found_ropes.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded">
                  <h5 className="font-medium mb-2 text-yellow-800">未找到的绳索编号</h5>
                  <p className="text-sm text-yellow-700">
                    {importResults.not_found_ropes.join(', ')}
                  </p>
                </div>
              )}

              {importResults.errors > 0 && importResults.errors_details && (
                <div className="mt-4 p-3 bg-red-50 rounded">
                  <h5 className="font-medium mb-2 text-red-800">错误详情</h5>
                  {importResults.errors_details.map((error, index) => (
                    <p key={index} className="text-sm text-red-700">
                      第 {error.row} 行: {error.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>文件格式说明</h3>
          </div>

          {activeTab === 'ropes' && (
            <div className="text-sm">
              <p className="mb-3"><strong>绳索台账 CSV 格式：</strong></p>
              <div className="table-container">
                <table className="text-sm">
                  <thead>
                    <tr>
                      <th>列名</th>
                      <th>说明</th>
                      <th>示例</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>绳索编号 / rope_number</td><td>必填，绳索唯一标识</td><td>R001</td></tr>
                    <tr><td>品牌 / brand</td><td>绳索品牌</td><td>Mammut</td></tr>
                    <tr><td>型号 / model</td><td>绳索型号</td><td>9.5 Crag</td></tr>
                    <tr><td>购买日期 / purchase_date</td><td>购买日期</td><td>2024-01-15</td></tr>
                    <tr><td>长度(m) / length_m</td><td>绳索长度</td><td>70</td></tr>
                    <tr><td>直径(mm) / diameter_mm</td><td>绳索直径</td><td>9.5</td></tr>
                    <tr><td>磨损等级 / wear_level</td><td>初始磨损等级 (0-5)</td><td>0</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="text-sm">
              <p className="mb-3"><strong>使用记录 CSV 格式：</strong></p>
              <div className="table-container">
                <table className="text-sm">
                  <thead>
                    <tr>
                      <th>列名</th>
                      <th>说明</th>
                      <th>示例</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>绳索编号 / rope_number</td><td>必填，绳索唯一标识</td><td>R001</td></tr>
                    <tr><td>使用日期 / usage_date</td><td>必填，使用日期</td><td>2024-05-20</td></tr>
                    <tr><td>使用次数 / uses_count</td><td>当日使用次数</td><td>5</td></tr>
                    <tr><td>冲坠能量(kJ) / fall_energy_kj</td><td>当日累计冲坠能量</td><td>2.5</td></tr>
                    <tr><td>冲坠系数 / fall_factor</td><td>最大冲坠系数</td><td>1.7</td></tr>
                    <tr><td>攀爬者体重(kg) / climber_weight_kg</td><td>攀爬者体重</td><td>70</td></tr>
                    <tr><td>冲坠距离(m) / fall_distance_m</td><td>最大冲坠距离</td><td>4</td></tr>
                    <tr><td>磨损等级 / wear_level</td><td>检查后的磨损等级</td><td>1</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'thresholds' && (
            <div className="text-sm">
              <p className="mb-3"><strong>厂家阈值 JSON 格式：</strong></p>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
{`[
  {
    "brand": "Mammut",
    "model": "9.5 Crag",
    "max_total_energy_kj": 100,
    "max_service_days": 365,
    "max_wear_level": 5,
    "max_daily_uses": 10,
    "max_daily_energy_kj": 50,
    "notes": "9.5mm 攀岩绳"
  },
  {
    "brand": "DEFAULT",
    "model": "DEFAULT",
    "max_total_energy_kj": 100,
    "max_service_days": 365,
    "max_wear_level": 5,
    "max_daily_uses": 10,
    "max_daily_energy_kj": 50,
    "notes": "默认阈值配置"
  }
]`}
              </pre>
              <p className="mt-3 text-secondary">
                <strong>字段说明：</strong><br />
                - max_total_energy_kj: 最大累计冲坠能量 (kJ)<br />
                - max_service_days: 最大使用天数<br />
                - max_wear_level: 最大磨损等级 (通常 0-5)<br />
                - max_daily_uses: 最大日使用次数<br />
                - max_daily_energy_kj: 最大日冲坠能量 (kJ)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportPage;
