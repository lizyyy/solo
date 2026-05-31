import React, { useState } from 'react';
import {
  Upload,
  Button,
  Card,
  Alert,
  Table,
  Tag,
  Space,
  Typography,
  Divider,
} from 'antd';
import {
  UploadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { artworkAPI } from '../utils/api';

const { Title, Text, Paragraph } = Typography;

function ImportPage() {
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleUpload = async (file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await artworkAPI.import(formData);
      setImportResult(response.data);
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        message: error.response?.data?.detail || '导入失败，请检查文件格式是否正确',
        issues: [],
      });
    } finally {
      setUploading(false);
    }
    return false;
  };

  const issueColumns = [
    {
      title: '行号',
      dataIndex: 'row',
      key: 'row',
      width: 80,
      render: (text) => text === 0 ? '-' : text,
    },
    {
      title: '作品编号',
      dataIndex: 'artwork_id',
      key: 'artwork_id',
      width: 120,
    },
    {
      title: '问题类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => {
        const typeMap = {
          missing_field: '缺少字段',
          invalid_number: '格式错误',
          unit_error: '单位问题',
          dimension_warning: '尺寸异常',
          dimension_error: '尺寸错误',
          import_error: '导入失败',
          position_change: '位置变动',
        };
        return typeMap[type] || type;
      },
    },
    {
      title: '问题描述',
      dataIndex: 'message',
      key: 'message',
      render: (text, record) => (
        <Text type={record.severity === 'error' ? 'danger' : 'warning'}>
          {text}
        </Text>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity) => {
        if (severity === 'error') {
          return <Tag color="red">错误</Tag>;
        }
        return <Tag color="orange">警告</Tag>;
      },
    },
  ];

  return (
    <div>
      <Title level={2}>导入作品数据</Title>
      
      <Paragraph>
        请上传Excel文件（.xlsx 或 .xls格式）。系统会自动识别作品编号、标题、艺术家、尺寸等信息。
        如有问题会标记为待确认，不会直接混入正常结果。
      </Paragraph>

      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Upload.Dragger
            name="file"
            accept=".xlsx,.xls"
            beforeUpload={handleUpload}
            showUploadList={false}
            disabled={uploading}
            style={{ padding: '40px' }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽Excel文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 .xlsx 和 .xls 格式。建议包含：作品编号、作品名称、艺术家、宽度、高度、单位、展墙位置等列
            </p>
          </Upload.Dragger>
        </Space>
      </Card>

      {importResult && (
        <>
          <Divider />
          
          {importResult.success ? (
            <Alert
              message="导入完成"
              description={importResult.message}
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              style={{ marginBottom: 24 }}
            />
          ) : (
            <Alert
              message="导入失败"
              description={importResult.message}
              type="error"
              showIcon
              icon={<CloseCircleOutlined />}
              style={{ marginBottom: 24 }}
            />
          )}

          {importResult.issues && importResult.issues.length > 0 && (
            <Card
              title={
                <Space>
                  <WarningOutlined style={{ color: '#faad14' }} />
                  <span>需要注意的问题（{importResult.issues.length}条）</span>
                </Space>
              }
              variant="outlined"
            >
              <Alert
                message="温馨提示"
                description="以下问题已自动标记为「待确认」状态，请前往「复核修正」页面逐一确认后再使用。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Table
                columns={issueColumns}
                dataSource={importResult.issues}
                rowKey={(record, index) => index}
                pagination={{ pageSize: 10 }}
                size="small"
              />
            </Card>
          )}

          {importResult.success && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Space>
                <Button type="primary" href="#/artworks">
                  查看作品列表
                </Button>
                <Button href="#/review">
                  前往复核修正
                </Button>
              </Space>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ImportPage;
