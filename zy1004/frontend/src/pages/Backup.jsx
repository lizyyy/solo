import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Upload,
  message,
  Divider,
  Radio,
  Alert,
  Modal,
  List,
  Tag,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  DatabaseOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { backupAPI } from '../services/api';

function Backup() {
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await backupAPI.export();
      
      const dataStr = JSON.stringify(res.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `repair-shop-backup-${dayjs().format('YYYYMMDDHHmmss')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      message.success('数据导出成功');
    } catch (error) {
      message.error(error.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (options) => {
    const { file, onSuccess, onError } = options;
    
    try {
      setImporting(true);
      
      const res = await backupAPI.import(file, overwrite);
      
      setImportResult(res.data);
      setResultModalVisible(true);
      onSuccess('ok');
      
      message.success('数据导入成功');
    } catch (error) {
      const errDetail = error.response?.data?.detail;
      if (errDetail && typeof errDetail === 'object' && errDetail.errors) {
        setImportResult({
          success: false,
          message: errDetail.message,
          errors: errDetail.errors,
        });
        setResultModalVisible(true);
      } else {
        message.error(errDetail || error.message || '导入失败');
      }
      onError(error);
    } finally {
      setImporting(false);
    }
  };

  const uploadProps = {
    name: 'file',
    accept: '.json',
    customRequest: handleImport,
    showUploadList: false,
    disabled: importing,
  };

  return (
    <div>
      <Card>
        <Alert
          message="数据备份说明"
          description="导出功能会将所有数据（技师、备件、维修单、沟通记录等）导出为 JSON 文件。导入功能可以恢复这些数据，但请注意：覆盖导入会清除所有现有数据。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={24}>
          <Col span={12}>
            <Card title={<Space><DownloadOutlined /> 数据导出</Space>} size="small">
              <p style={{ marginBottom: 16, color: '#666' }}>
                导出所有数据为 JSON 备份文件，包括：
              </p>
              <List
                size="small"
                dataSource={[
                  '技师信息',
                  '备件库存',
                  '维修单记录',
                  '沟通记录',
                  '状态变更历史',
                  '库存变动记录',
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                    {item}
                  </List.Item>
                )}
              />
              <Divider />
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExport}
                loading={exporting}
              >
                导出数据
              </Button>
            </Card>
          </Col>

          <Col span={12}>
            <Card title={<Space><UploadOutlined /> 数据导入</Space>} size="small">
              <Alert
                message="导入前请确认"
                description={
                  <div>
                    <p>导入的数据会进行以下校验：</p>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      <li>状态字段有效性检查</li>
                      <li>库存字段非负检查</li>
                      <li>必填字段完整性检查</li>
                    </ul>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <div style={{ marginBottom: 16 }}>
                <Radio.Group
                  value={overwrite}
                  onChange={(e) => setOverwrite(e.target.value)}
                >
                  <Radio value={false}>
                    <span style={{ color: '#52c41a' }}>追加导入</span>
                    <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                      （保留现有数据，添加新数据）
                    </span>
                  </Radio>
                  <Divider type="vertical" />
                  <Radio value={true}>
                    <span style={{ color: '#ff4d4f' }}>覆盖导入</span>
                    <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                      <WarningOutlined style={{ marginRight: 4 }} />
                      （清除所有现有数据）
                    </span>
                  </Radio>
                </Radio.Group>
              </div>

              <Divider />

              <Upload {...uploadProps}>
                <Button
                  type={overwrite ? 'danger' : 'primary'}
                  icon={<UploadOutlined />}
                  loading={importing}
                >
                  选择 JSON 文件导入
                </Button>
              </Upload>
            </Card>
          </Col>
        </Row>
      </Card>

      <Modal
        title={
          <Space>
            {importResult?.success ? (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ) : (
              <WarningOutlined style={{ color: '#faad14' }} />
            )}
            导入结果
          </Space>
        }
        open={resultModalVisible}
        onCancel={() => setResultModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setResultModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        {importResult && (
          <div>
            <p style={{ marginBottom: 16 }}>
              <strong>状态:</strong>{' '}
              {importResult.success ? (
                <Tag color="success">成功</Tag>
              ) : (
                <Tag color="error">失败</Tag>
              )}
            </p>
            <p style={{ marginBottom: 16 }}>
              <strong>消息:</strong> {importResult.message}
            </p>
            {importResult.imported && (
              <p style={{ marginBottom: 16 }}>
                <strong>导入记录数:</strong> {importResult.imported}
              </p>
            )}
            {importResult.errors && importResult.errors.length > 0 && (
              <div>
                <strong>错误详情:</strong>
                <List
                  dataSource={importResult.errors}
                  renderItem={(err) => (
                    <List.Item style={{ color: '#ff4d4f' }}>
                      <WarningOutlined style={{ marginRight: 8 }} />
                      {err}
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Backup;
