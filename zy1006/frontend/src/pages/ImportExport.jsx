import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Upload,
  message,
  DatePicker,
  Select,
  Space,
  Divider,
  Descriptions,
  Alert,
  List
} from 'antd';
import {
  ImportOutlined,
  ExportOutlined,
  DownloadOutlined,
  UploadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { api } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

function ImportExport() {
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [exportStatus, setExportStatus] = useState('');
  const [exportDateRange, setExportDateRange] = useState(null);

  const handleExportTemplate = async () => {
    try {
      await api.exportTemplate();
      message.success('模板下载成功');
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleExportRecords = async () => {
    try {
      setExportStatus('exporting');
      const params = {};
      if (exportDateRange && exportDateRange.length === 2) {
        params.startDate = exportDateRange[0].format('YYYY-MM-DD');
        params.endDate = exportDateRange[1].format('YYYY-MM-DD');
      }
      await api.exportBorrowRecords(params);
      message.success('导出成功');
    } catch (error) {
      message.error(error.message);
    } finally {
      setExportStatus('');
    }
  };

  const handleImport = async (file) => {
    setImportLoading(true);
    setImportResult(null);
    
    try {
      const result = await api.importSamples(file);
      setImportResult(result);
      
      if (result.success) {
        if (result.errors && result.errors.length > 0) {
          message.warning(`部分导入成功：${result.message}`);
        } else {
          message.success(`导入成功：${result.message}`);
        }
      }
    } catch (error) {
      message.error(error.message);
    } finally {
      setImportLoading(false);
    }
    
    return false;
  };

  const importProps = {
    beforeUpload: handleImport,
    showUploadList: false,
    accept: '.csv',
  };

  return (
    <div>
      <h2 style={{ margin: 0, marginBottom: 24 }}>导入导出</h2>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title={
              <Space>
                <ImportOutlined />
                批量导入样品
              </Space>
            }
            extra={
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={handleExportTemplate}
              >
                下载导入模板
              </Button>
            }
          >
            <Alert
              message="导入说明"
              description={
                <div>
                  <p>1. 请先下载模板，按照模板格式填写样品信息</p>
                  <p>2. 模板列说明：</p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li><strong>名称：</strong>样品名称（必填）</li>
                    <li><strong>编号：</strong>样品唯一编号（必填，重复会被拒绝）</li>
                    <li><strong>分类：</strong>样品分类，如：相机、镜头、配件</li>
                    <li><strong>库存位置：</strong>存放位置，如：A柜-1层</li>
                    <li><strong>押金：</strong>借用押金金额（数字）</li>
                    <li><strong>价值：</strong>样品实际价值（数字）</li>
                  </ul>
                  <p>3. 系统会自动校验重复编号，已存在的编号会跳过并提示</p>
                  <p>4. 仅支持 CSV 格式文件</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <div style={{ textAlign: 'center', padding: 40, border: '2px dashed #d9d9d9', borderRadius: 8 }}>
              <Upload {...importProps}>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  size="large"
                  loading={importLoading}
                >
                  选择 CSV 文件导入
                </Button>
              </Upload>
              <p style={{ marginTop: 12, color: '#999' }}>支持 .csv 格式文件</p>
            </div>

            {importResult && (
              <Card
                size="small"
                title="导入结果"
                style={{ marginTop: 16 }}
                type={importResult.errors?.length > 0 ? 'inner' : 'inner'}
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="总记录数">{importResult.total}</Descriptions.Item>
                  <Descriptions.Item label="成功导入">{importResult.imported}</Descriptions.Item>
                  <Descriptions.Item label="失败记录">{importResult.errors?.length || 0}</Descriptions.Item>
                </Descriptions>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Divider style={{ margin: '12px 0' }}>错误详情</Divider>
                    <List
                      size="small"
                      dataSource={importResult.errors}
                      renderItem={(item) => (
                        <List.Item style={{ color: '#ff4d4f' }}>
                          <span style={{ marginRight: 8 }}>⚠️</span>
                          {item}
                        </List.Item>
                      )}
                    />
                  </div>
                )}
              </Card>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card
            title={
              <Space>
                <ExportOutlined />
                导出借用记录
              </Space>
            }
          >
            <Alert
              message="导出说明"
              description={
                <div>
                  <p>导出当前所有借用记录为 CSV 格式，方便每周对账使用。</p>
                  <p>导出内容包括：</p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>记录ID、样品名称、样品编号</li>
                    <li>借用人、联系方式</li>
                    <li>借用日期、预计归还日期、实际归还日期</li>
                    <li>当前状态、损坏/缺件说明</li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>筛选条件（可选）</h4>
              <Space>
                <RangePicker
                  placeholder={['开始日期', '结束日期']}
                  value={exportDateRange}
                  onChange={setExportDateRange}
                  style={{ width: 300 }}
                />
                <Button
                  onClick={() => {
                    setExportDateRange(null);
                  }}
                >
                  清除筛选
                </Button>
              </Space>
            </div>

            <div style={{ textAlign: 'center', padding: 40, border: '2px dashed #d9d9d9', borderRadius: 8 }}>
              <Button
                type="primary"
                icon={<ExportOutlined />}
                size="large"
                onClick={handleExportRecords}
                loading={exportStatus === 'exporting'}
              >
                导出借用记录 CSV
              </Button>
              <p style={{ marginTop: 12, color: '#999' }}>
                {exportDateRange
                  ? `导出范围：${exportDateRange[0].format('YYYY-MM-DD')} 至 ${exportDateRange[1].format('YYYY-MM-DD')}`
                  : '导出全部借用记录'}
              </p>
            </div>
          </Card>

          <Card
            title={
              <Space>
                <FileTextOutlined />
                快速操作
              </Space>
            }
            style={{ marginTop: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                block
                onClick={handleExportTemplate}
                icon={<DownloadOutlined />}
              >
                下载样品导入模板
              </Button>
              <Button
                block
                onClick={handleExportRecords}
                icon={<ExportOutlined />}
              >
                导出全部借用记录
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }}>
        <h4>常见问题</h4>
        <div>
          <p><strong>Q: 导入时提示"样品编号已存在"怎么办？</strong></p>
          <p>A: 请检查 CSV 文件中的编号是否与系统中已有样品重复，或者 CSV 文件内部是否有重复编号。系统会自动跳过重复编号的记录，只导入新的样品。</p>
          
          <p><strong>Q: 导出的 CSV 文件用什么打开？</strong></p>
          <p>A: 可以用 Excel、WPS 表格、Numbers 或任何文本编辑器打开。如果用 Excel 打开时乱码，请尝试用「数据」→「从文本/CSV 导入」的方式打开。</p>
          
          <p><strong>Q: 可以只导出特定状态的记录吗？</strong></p>
          <p>A: 目前导出功能支持按日期范围筛选。如果需要按状态筛选，可以先在「借用记录」页面筛选后，导出时会包含筛选结果。</p>
        </div>
      </Card>
    </div>
  );
}

export default ImportExport;
