import React, { useState } from 'react';
import { Card, Button, Upload, Input, Form, message, Divider, Row, Col, Statistic, Alert } from 'antd';
import { UploadOutlined, FolderOpenOutlined, PlayCircleOutlined, FileTextOutlined, PictureOutlined } from '@ant-design/icons';
import moment from 'moment';
import { usePhotoScan } from '../context/PhotoScanContext';
import ImportService from '../services/ImportService';
import RiskService from '../services/RiskService';

const { Dragger } = Upload;

function ImportPage() {
  const { state, setRecords, setRisks, setImportInfo, clearRisks, addRisk, updateSettings } = usePhotoScan();
  const [csvContent, setCsvContent] = useState(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm();

  const handleCsvUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvContent(e.target.result);
      setCsvFileName(file.name);
      message.success(`已选择文件: ${file.name}`);
    };
    reader.readAsText(file);
    return false;
  };

  const parseCsv = async () => {
    if (!csvContent) {
      message.warning('请先上传 CSV 文件');
      return;
    }

    try {
      const records = await ImportService.parseCSV(csvContent);
      setPreviewData(records);
      message.success(`解析成功，共 ${records.length} 条记录`);
    } catch (error) {
      message.error(`解析失败: ${error.message}`);
    }
  };

  const runRiskCheck = () => {
    if (previewData.length === 0) {
      message.warning('请先解析 CSV 数据');
      return;
    }

    const risks = RiskService.checkAll(previewData, state.settings);
    clearRisks();
    
    risks.forEach(risk => {
      addRisk(risk);
    });

    message.info(`风险检查完成，发现 ${risks.length} 个风险点`);
  };

  const confirmImport = () => {
    if (previewData.length === 0) {
      message.warning('没有可导入的数据');
      return;
    }

    setImporting(true);
    setTimeout(() => {
      setRecords(previewData);
      setImportInfo({
        csvPath: csvFileName,
        importTime: moment().format('YYYY-MM-DD HH:mm:ss')
      });
      setImporting(false);
      message.success(`成功导入 ${previewData.length} 条记录`);
    }, 500);
  };

  const handleSettingsChange = (changedValues) => {
    updateSettings(changedValues);
  };

  const sampleCsvContent = `盒号,张号,扫描文件,分辨率,责任人,修复状态,备注
A001,1,A001_001.tif,300,张三,已修复,
A001,2,A001_002.tif,300,张三,修复中,轻微划痕
A001,3,A001_003.tif,600,李四,未修复,
B001,1,B001_001.tif,300,王五,已修复,`;

  const downloadSample = () => {
    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '扫描清单示例.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="导入扫描清单" size="small">
            <Alert
              message="CSV 格式要求"
              description={
                <div>
                  <p>CSV 文件应包含以下列（支持中英文表头）：</p>
                  <ul>
                    <li><strong>盒号 / boxId</strong>: 底片盒编号</li>
                    <li><strong>张号 / frameNumber</strong>: 底片张号</li>
                    <li><strong>扫描文件 / scanFile</strong>: 扫描文件名</li>
                    <li><strong>分辨率 / resolution</strong>: 扫描分辨率(DPI)</li>
                    <li><strong>责任人 / responsible</strong>: 负责人姓名</li>
                    <li><strong>修复状态 / repairStatus</strong>: 修复状态</li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              action={
                <Button size="small" onClick={downloadSample}>
                  下载示例
                </Button>
              }
            />
            
            <Dragger
              accept=".csv"
              beforeUpload={handleCsvUpload}
              fileList={csvFileName ? [{ name: csvFileName, uid: '1' }] : []}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽 CSV 文件到此处</p>
              <p className="ant-upload-hint">支持 .csv 格式</p>
            </Dragger>

            <Divider />

            <Row gutter={8}>
              <Col span={12}>
                <Button 
                  type="primary" 
                  icon={<FileTextOutlined />}
                  onClick={parseCsv}
                  disabled={!csvContent}
                  block
                >
                  解析 CSV
                </Button>
              </Col>
              <Col span={12}>
                <Button 
                  icon={<WarningOutlined />}
                  onClick={runRiskCheck}
                  disabled={previewData.length === 0}
                  block
                >
                  风险预检
                </Button>
              </Col>
            </Row>

            {previewData.length > 0 && (
              <>
                <Divider />
                <div style={{ textAlign: 'center' }}>
                  <Statistic 
                    title="预览记录数" 
                    value={previewData.length} 
                    suffix="条"
                    style={{ display: 'inline-block', marginRight: 32 }}
                  />
                  <Statistic 
                    title="发现风险" 
                    value={state.risks.length} 
                    suffix="个"
                    style={{ display: 'inline-block', color: state.risks.length > 0 ? '#ff4d4f' : '#52c41a' }}
                  />
                </div>
                <Divider />
                <Button 
                  type="primary" 
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={confirmImport}
                  loading={importing}
                  block
                >
                  确认导入数据
                </Button>
              </>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="扫描设置" size="small">
            <Form
              form={form}
              layout="vertical"
              initialValues={state.settings}
              onValuesChange={handleSettingsChange}
            >
              <Form.Item
                label="最低分辨率要求 (DPI)"
                name="minResolution"
                rules={[{ required: true, message: '请输入最低分辨率要求' }]}
              >
                <Input.Number min={72} max={1200} style={{ width: '100%' }} />
              </Form.Item>

              <Divider>文件夹索引（暂未启用）</Divider>

              <Alert
                message="文件夹索引说明"
                description={
                  <div>
                    <p>文件夹索引功能用于自动匹配扫描文件和交付图：</p>
                    <ul>
                      <li>选择扫描文件夹：系统会自动索引所有图片文件</li>
                      <li>选择交付文件夹：用于检查已修复照片的交付图</li>
                      <li>文件命名规则：{盒号}_{张号}.扩展名，如 A001_001.tif</li>
                    </ul>
                  </div>
                }
                type="warning"
                showIcon
              />

              <Divider style={{ marginTop: 24 }} />

              <Row gutter={8}>
                <Col span={12}>
                  <Button icon={<FolderOpenOutlined />} block disabled>
                    选择扫描文件夹
                  </Button>
                </Col>
                <Col span={12}>
                  <Button icon={<PictureOutlined />} block disabled>
                    选择交付文件夹
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card>

          {state.importInfo.importTime && (
            <Card title="当前导入信息" size="small" style={{ marginTop: 16 }}>
              <Statistic 
                title="总记录数" 
                value={state.records.length} 
                suffix="条"
                style={{ marginBottom: 16 }}
              />
              <p><strong>导入时间:</strong> {state.importInfo.importTime}</p>
              {state.importInfo.csvPath && (
                <p><strong>源文件:</strong> {state.importInfo.csvPath}</p>
              )}
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}

export default ImportPage;
