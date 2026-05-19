import React, { useState } from 'react';
import {
  Card,
  Upload,
  Button,
  Table,
  message,
  Space,
  Input,
  Select,
  Form,
  Modal,
  Divider,
  Tag,
  Statistic,
  Row,
  Col
} from 'antd';
import {
  UploadOutlined,
  PlusOutlined,
  InboxOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Dragger } = Upload;
const { TextArea } = Input;
const { Option } = Select;

function ImportPage() {
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [previewData, setPreviewData] = useState([]);

  const contentTypes = [
    { label: '帖子', value: 'post' },
    { label: '评论', value: 'comment' },
    { label: '图片', value: 'image' },
    { label: '视频', value: 'video' }
  ];

  const handleManualSubmit = async (values) => {
    try {
      const contentResponse = await axios.post('/api/contents', {
        contentType: values.contentType,
        contentText: values.contentText,
        authorId: 'imported',
        authorName: values.authorName,
        blockTime: new Date().toISOString(),
        contentStatus: 'blocked'
      });

      if (contentResponse.data.success) {
        const contentId = contentResponse.data.data.id;
        
        await axios.post(`/api/contents/${contentId}/sync-audit`, {
          tags: [{ code: 'IMPORTED', name: '导入内容', confidence: 1.0 }],
          modelReasons: [{
            modelVersion: 'v1.0',
            code: 'MANUAL_REVIEW',
            detail: '人工导入待审核内容',
            riskLevel: 'medium',
            evidence: []
          }]
        });

        await axios.post('/api/appeals', {
          contentId,
          submitterId: 'system',
          submitterName: values.submitterName,
          submitterContact: values.submitterContact,
          appealReason: values.appealReason,
          evidenceMaterials: values.evidenceMaterials
        });

        message.success('导入成功');
        setManualModalVisible(false);
        form.resetFields();
      }
    } catch (error) {
      message.error(error.response?.data?.error || '导入失败');
    }
  };

  const handleBatchImport = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('operatorId', 'admin');
      formData.append('operatorName', '系统管理员');

      const response = await axios.post('/api/import/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const result = response.data.data;
        setImportResult(result);
        setResultModalVisible(true);
        
        if (result.failedCount > 0) {
          message.warning(`导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`);
        } else {
          message.success(`导入成功：共 ${result.successCount} 条`);
        }
        onSuccess();
      } else {
        onError(new Error(response.data.error));
      }
    } catch (error) {
      message.error('导入失败：' + (error.response?.data?.error || error.message));
      onError(error);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    window.open('/api/import/template', '_blank');
  };

  const resultColumns = [
    { title: '行号', dataIndex: 'row', key: 'row', width: 80 },
    { title: '内容ID', dataIndex: 'contentId', key: 'contentId', ellipsis: true },
    { title: '申诉ID', dataIndex: 'appealId', key: 'appealId', ellipsis: true }
  ];

  const failedColumns = [
    { title: '行号', dataIndex: 'row', key: 'row', width: 80 },
    { title: '错误信息', dataIndex: 'error', key: 'error' }
  ];

  return (
    <div>
      <Card title="批量导入申诉" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <h4>单个导入</h4>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setManualModalVisible(true)}
            >
              手动添加申诉
            </Button>
          </div>

          <Divider />

          <div>
            <h4>CSV批量导入</h4>
            <Space style={{ marginBottom: 16 }}>
              <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
                下载导入模板
              </Button>
            </Space>
            <Dragger
              name="file"
              accept=".csv"
              customRequest={handleBatchImport}
              showUploadList={false}
              style={{ padding: 40 }}
              disabled={uploading}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">
                {uploading ? '正在导入...' : '点击或拖拽CSV文件到此区域上传'}
              </p>
              <p className="ant-upload-hint">
                支持CSV格式，包含字段：内容类型、内容摘要、作者、申诉人、申诉理由等
              </p>
            </Dragger>
          </div>

          <Divider />

          <div>
            <h4>导入说明</h4>
            <ul>
              <li>单个导入：适用于少量申诉的快速录入</li>
              <li>CSV批量导入：适用于大量申诉的批量处理</li>
              <li>导入后申诉状态默认为"待处理"</li>
              <li>系统会自动创建对应的内容记录和审核标签</li>
              <li>请先下载模板，按格式填写后上传</li>
            </ul>
          </div>
        </Space>
      </Card>

      <Modal
        title="手动添加申诉"
        open={manualModalVisible}
        onCancel={() => setManualModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleManualSubmit}
        >
          <Form.Item
            label="内容类型"
            name="contentType"
            rules={[{ required: true, message: '请选择内容类型' }]}
          >
            <Select>
              {contentTypes.map(ct => (
                <Option key={ct.value} value={ct.value}>{ct.label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="内容摘要"
            name="contentText"
            rules={[{ required: true, message: '请输入内容摘要' }]}
          >
            <TextArea rows={3} placeholder="请输入被拦截的内容摘要" />
          </Form.Item>

          <Form.Item
            label="作者名称"
            name="authorName"
            rules={[{ required: true, message: '请输入作者名称' }]}
          >
            <Input placeholder="请输入内容作者名称" />
          </Form.Item>

          <Form.Item
            label="申诉人名称"
            name="submitterName"
            rules={[{ required: true, message: '请输入申诉人名称' }]}
          >
            <Input placeholder="请输入申诉人名称" />
          </Form.Item>

          <Form.Item
            label="申诉人联系方式"
            name="submitterContact"
          >
            <Input placeholder="请输入联系方式（选填）" />
          </Form.Item>

          <Form.Item
            label="申诉理由"
            name="appealReason"
            rules={[{ required: true, message: '请输入申诉理由' }]}
          >
            <TextArea rows={4} placeholder="请详细描述申诉理由" />
          </Form.Item>

          <Form.Item
            label="证据材料"
            name="evidenceMaterials"
          >
            <TextArea rows={2} placeholder="相关证据材料说明（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量导入结果"
        open={resultModalVisible}
        onCancel={() => setResultModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setResultModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {importResult && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="总记录数"
                    value={importResult.total}
                    prefix={<Tag>CSV</Tag>}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="成功"
                    value={importResult.successCount}
                    valueStyle={{ color: '#3f8600' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="失败"
                    value={importResult.failedCount}
                    valueStyle={{ color: '#cf1322' }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {importResult.success.length > 0 && (
              <div>
                <h4>成功导入记录</h4>
                <Table
                  dataSource={importResult.success}
                  columns={resultColumns}
                  rowKey="appealId"
                  size="small"
                  pagination={{ pageSize: 5 }}
                />
              </div>
            )}

            {importResult.failed.length > 0 && (
              <div>
                <h4>导入失败记录</h4>
                <Table
                  dataSource={importResult.failed}
                  columns={failedColumns}
                  rowKey="row"
                  size="small"
                  pagination={{ pageSize: 5 }}
                />
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}

export default ImportPage;
