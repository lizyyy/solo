import React, { useState } from 'react';
import {
  Button,
  Space,
  Card,
  Typography,
  Upload,
  Row,
  Col,
  Alert,
  Divider,
  Statistic,
  message,
  Popconfirm
} from 'antd';
import {
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined,
  ImportOutlined,
  ExportOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

function ImportExportPage({ onRefresh }) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.export();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feature-flag-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file) => {
    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          await api.import(data);
          message.success('导入成功');
          if (onRefresh) onRefresh();
        } catch (parseError) {
          message.error('JSON 解析失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      message.error('导入失败');
    } finally {
      setImporting(false);
    }
    return false;
  };

  const handleInitSample = async () => {
    try {
      await api.initSample();
      message.success('示例数据初始化成功');
      if (onRefresh) onRefresh();
    } catch (error) {
      message.error('初始化失败');
    }
  };

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.json',
    beforeUpload: handleImport,
    showUploadList: false
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <FileTextOutlined />
            导入导出
          </Space>
        }
      >
        <Alert
          message="数据导入导出说明"
          description="可以将所有配置（用户、Segment、Flag、审计记录）导出为 JSON 文件备份，或从 JSON 文件导入恢复数据。导入会覆盖现有数据。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card
              title={
                <Space>
                  <ExportOutlined style={{ color: '#1890ff' }} />
                  导出数据
                </Space>
              }
            >
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                将所有配置导出为 JSON 文件，包括：
              </Paragraph>
              <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
                <li>用户样本</li>
                <li>Segment 规则</li>
                <li>Feature Flags</li>
                <li>审计记录</li>
              </ul>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExport}
                loading={exporting}
                size="large"
                block
              >
                导出为 JSON 文件
              </Button>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card
              title={
                <Space>
                  <ImportOutlined style={{ color: '#722ed1' }} />
                  导入数据
                </Space>
              }
            >
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                从 JSON 文件导入配置，将覆盖现有数据。
              </Paragraph>
              
              <Dragger {...uploadProps} disabled={importing}>
                <p className="ant-upload-drag-icon">
                  <UploadOutlined style={{ fontSize: 48, color: '#40a9ff' }} />
                </p>
                <p className="ant-upload-text">
                  {importing ? '导入中...' : '点击或拖拽 JSON 文件到此处'}
                </p>
                <p className="ant-upload-hint">支持 .json 格式文件</p>
              </Dragger>
            </Card>
          </Col>
        </Row>

        <Divider />

        <Card
          title={
            <Space>
              <ReloadOutlined style={{ color: '#faad14' }} />
              重置示例数据
            </Space>
          }
        >
          <Row gutter={[16, 16]} align="middle">
            <Col flex="1">
              <Paragraph type="secondary">
                如果想重新开始，可以重置所有数据为示例数据。这将：
              </Paragraph>
              <ul style={{ paddingLeft: 20 }}>
                <li>重置 24 个示例用户样本</li>
                <li>重置 6 个示例 Segment 规则</li>
                <li>重置 7 个示例 Feature Flags</li>
                <li>清空审计记录</li>
              </ul>
            </Col>
            <Col>
              <Popconfirm
                title="确定要重置为示例数据吗？这将覆盖所有现有数据。"
                onConfirm={handleInitSample}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="primary"
                  danger
                  icon={<ReloadOutlined />}
                  size="large"
                >
                  重置为示例数据
                </Button>
              </Popconfirm>
            </Col>
          </Row>
        </Card>
      </Card>
    </div>
  );
}

export default ImportExportPage;
