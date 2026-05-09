import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Upload,
  Button,
  Select,
  Form,
  Table,
  Tag,
  Space,
  message,
  Typography,
  Progress,
  Row,
  Col,
  DatePicker,
  Modal,
  Descriptions
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
  HistoryOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { importExportApi, activityApi, registrationApi } from '../services/api';
import {
  IMPORT_STATUS,
  getImportStatusLabel,
  REGISTRATION_STATUS
} from '../utils/constants';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const ImportExport = () => {
  const [activities, setActivities] = useState([]);
  const [importHistory, setImportHistory] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [importForm] = Form.useForm();
  const [exportForm] = Form.useForm();

  useEffect(() => {
    loadActivities();
    loadImportHistory();
  }, []);

  const loadActivities = async () => {
    try {
      const res = await activityApi.list({ limit: 100 });
      setActivities(res.data.data);
    } catch (error) {
      console.error('加载活动失败:', error);
    }
  };

  const loadImportHistory = async () => {
    try {
      const res = await importExportApi.getImportHistory();
      setImportHistory(res.data.data);
    } catch (error) {
      console.error('加载导入历史失败:', error);
    }
  };

  const handleImport = async (options) => {
    const { file } = options;
    const activityId = importForm.getFieldValue('activityId');

    if (!activityId) {
      message.warning('请先选择活动');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const res = await importExportApi.import(
        file,
        activityId,
        (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        }
      );

      setImportResult(res.data.data);
      message.success(res.data.message);
      loadImportHistory();
    } catch (error) {
      console.error('导入失败:', error);
      message.error('导入失败');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleExport = async () => {
    try {
      const values = await exportForm.validateFields();
      const params = { ...values };

      if (values.timeRange) {
        params.startDate = values.timeRange[0].toISOString();
        params.endDate = values.timeRange[1].toISOString();
        delete params.timeRange;
      }

      const response = await importExportApi.export(params);
      const blob = new Blob([response.data], {
        type: 'text/csv;charset=utf-8;'
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `registrations_${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  const handleRetry = async (batchId) => {
    setRetrying(true);
    try {
      const res = await importExportApi.retryImport(batchId);
      message.success(res.data.message);
      loadImportHistory();
    } catch (error) {
      console.error('重试失败:', error);
    } finally {
      setRetrying(false);
    }
  };

  const handleViewDetail = (record) => {
    setSelectedHistory(record);
    setDetailVisible(true);
  };

  const importColumns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      width: 250
    },
    {
      title: '总记录数',
      dataIndex: 'totalRecords',
      key: 'totalRecords',
      width: 100
    },
    {
      title: '成功',
      dataIndex: 'successCount',
      key: 'successCount',
      width: 80,
      render: (text) => <Tag color="green">{text}</Tag>
    },
    {
      title: '失败',
      dataIndex: 'failureCount',
      key: 'failureCount',
      width: 80,
      render: (text) => <Tag color={text > 0 ? 'red' : 'default'}>{text}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={IMPORT_STATUS[status]?.color || 'default'}>
          {getImportStatusLabel(status)}
        </Tag>
      )
    },
    {
      title: '导入时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<InfoCircleOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {(record.status === 'failed' || record.status === 'partial') && (
            <Button
              type="link"
              icon={<ReloadOutlined />}
              onClick={() => handleRetry(record.id)}
              loading={retrying}
            >
              重试
            </Button>
          )}
        </Space>
      )
    }
  ];

  const uploadProps = {
    name: 'file',
    accept: '.csv',
    showUploadList: false,
    customRequest: handleImport,
    beforeUpload: (file) => {
      const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
      if (!isCSV) {
        message.error('只能上传CSV文件');
        return false;
      }
      return true;
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>导入导出</Title>

      <Tabs defaultActiveKey="import">
        <TabPane tab="导入数据" key="import">
          <Row gutter={16}>
            <Col span={12}>
              <Card title="导入设置">
                <Form form={importForm} layout="vertical">
                  <Form.Item
                    name="activityId"
                    label="目标活动"
                    rules={[{ required: true, message: '请选择活动' }]}
                  >
                    <Select placeholder="请选择要导入到哪个活动">
                      {activities.map((a) => (
                        <Option key={a.id} value={a.id}>
                          {a.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item>
                    <Upload {...uploadProps}>
                      <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        loading={uploading}
                        block
                      >
                        {uploading ? '导入中...' : '选择CSV文件导入'}
                      </Button>
                    </Upload>
                  </Form.Item>

                  {uploading && (
                    <Progress
                      percent={uploadProgress}
                      className="import-progress"
                    />
                  )}
                </Form>
              </Card>

              {importResult && (
                <Card title="导入结果" style={{ marginTop: 16 }}>
                  <Descriptions column={1}>
                    <Descriptions.Item label="总记录数">
                      {importResult.total}
                    </Descriptions.Item>
                    <Descriptions.Item label="成功">
                      <Tag color="green">{importResult.success}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="失败">
                      <Tag color={importResult.failed > 0 ? 'red' : 'default'}>
                        {importResult.failed}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="跳过重复">
                      {importResult.duplicateSkips}
                    </Descriptions.Item>
                  </Descriptions>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <Title level={5}>错误详情</Title>
                      <Table
                        dataSource={importResult.errors}
                        columns={[
                          { title: '行号', dataIndex: 'row', key: 'row' },
                          { title: '错误信息', dataIndex: 'error', key: 'error' }
                        ]}
                        size="small"
                        pagination={false}
                      />
                    </div>
                  )}
                </Card>
              )}

              <Card title="导入说明" style={{ marginTop: 16 }}>
                <ul>
                  <li>CSV文件必须包含以下列：name, email</li>
                  <li>可选列：phone, company, notes</li>
                  <li>重复邮箱会自动跳过</li>
                  <li>示例格式：</li>
                </ul>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4
                  }}
                >
                  name,email,phone,company,notes{'\n'}
                  张三,zhangsan@example.com,13800138000,科技公司,重要客户{'\n'}
                  李四,lisi@example.com,13900139000,,
                </pre>
              </Card>
            </Col>

            <Col span={12}>
              <Card title="导入历史" icon={<HistoryOutlined />}>
                <Table
                  columns={importColumns}
                  dataSource={importHistory}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 5 }}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="导出数据" key="export">
          <Card title="导出设置">
            <Form form={exportForm} layout="vertical">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="activityId" label="活动">
                    <Select placeholder="全部活动" allowClear>
                      {activities.map((a) => (
                        <Option key={a.id} value={a.id}>
                          {a.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="status" label="状态">
                    <Select placeholder="全部状态" allowClear>
                      {Object.values(REGISTRATION_STATUS).map((s) => (
                        <Option key={s.value} value={s.value}>
                          {s.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="timeRange" label="时间范围">
                    <RangePicker showTime format="YYYY-MM-DD HH:mm" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
                  导出CSV
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title="导入批次详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedHistory && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="文件名">
                {selectedHistory.fileName}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={IMPORT_STATUS[selectedHistory.status]?.color || 'default'}>
                  {getImportStatusLabel(selectedHistory.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="总记录数">
                {selectedHistory.totalRecords}
              </Descriptions.Item>
              <Descriptions.Item label="成功">
                {selectedHistory.successCount}
              </Descriptions.Item>
              <Descriptions.Item label="失败">
                {selectedHistory.failureCount}
              </Descriptions.Item>
              <Descriptions.Item label="导入时间">
                {dayjs(selectedHistory.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            {selectedHistory.errorLog && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>错误记录</Title>
                <pre
                  style={{
                    background: '#fff1f0',
                    padding: 12,
                    borderRadius: 4,
                    maxHeight: 300,
                    overflow: 'auto'
                  }}
                >
                  {selectedHistory.errorLog}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ImportExport;
