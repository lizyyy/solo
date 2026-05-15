import React, { useState } from 'react';
import {
  Upload,
  Button,
  Card,
  message,
  Table,
  Space,
  Typography,
  Alert,
} from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import apiService from '../services/api';

const { Title, Paragraph, Text } = Typography;

const BulkImport: React.FC = () => {
  const [importResult, setImportResult] = useState<{
    successCount: number;
    errorCount: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.csv',
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const response = await apiService.bulkImport(file as File);
        if (response.data.success) {
          setImportResult(response.data.data);
          message.success(`导入完成：成功 ${response.data.data.successCount} 条，失败 ${response.data.data.errorCount} 条`);
          onSuccess?.(response.data);
        }
      } catch (error: any) {
        message.error(error.response?.data?.details || '导入失败');
        onError?.(error as Error);
      }
    },
    showUploadList: false,
  };

  const columns = [
    {
      title: '行号',
      dataIndex: 'row',
      key: 'row',
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
    },
  ];

  const downloadTemplate = () => {
    const template = 'name,description,endpoint,method,status,permission_level,version\n获取商品信息,根据ID获取商品详情,/api/v1/products/:id,GET,active,internal,1.0.0\n创建订单,创建新订单,/api/v1/orders,POST,draft,confidential,2.0.0';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'api_import_template.csv';
    link.click();
  };

  return (
    <div>
      <Card title="批量导入 API" style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>导入说明</Title>
            <Paragraph>
              请使用 CSV 格式文件批量导入 API 条目。CSV 文件需要包含以下列：
            </Paragraph>
            <ul>
              <li><Text code>name</Text> - API 名称（必填）</li>
              <li><Text code>description</Text> - API 描述</li>
              <li><Text code>endpoint</Text> - 端点路径（必填）</li>
              <li><Text code>method</Text> - HTTP 方法（GET、POST、PUT、DELETE、PATCH）（必填）</li>
              <li><Text code>status</Text> - 状态（draft、reviewing、active、deprecated、archived）</li>
              <li><Text code>permission_level</Text> - 权限等级（public、internal、confidential、restricted）</li>
              <li><Text code>version</Text> - 版本号（如 1.0.0）</li>
            </ul>
          </div>

          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
            下载模板文件
          </Button>

          <Upload {...uploadProps}>
            <Button type="primary" icon={<UploadOutlined />} size="large">
              选择 CSV 文件导入
            </Button>
          </Upload>
        </Space>
      </Card>

      {importResult && (
        <>
          <Alert
            message="导入结果"
            description={`成功导入 ${importResult.successCount} 条，失败 ${importResult.errorCount} 条`}
            type={importResult.errorCount === 0 ? 'success' : 'warning'}
            showIcon
            style={{ marginBottom: 24 }}
          />

          {importResult.errors.length > 0 && (
            <Card title="导入错误详情">
              <Table
                columns={columns}
                dataSource={importResult.errors.map((e, i) => ({ ...e, key: i }))}
                pagination={false}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default BulkImport;
