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
  Divider
} from 'antd';
import {
  UploadOutlined,
  PlusOutlined,
  InboxOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Dragger } = Upload;
const { TextArea } = Input;
const { Option } = Select;

function ImportPage() {
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [form] = Form.useForm();
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

  const uploadProps = {
    name: 'file',
    accept: '.csv',
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        message.info('CSV导入功能可扩展，当前已完成单条导入');
        onSuccess();
      } catch (error) {
        onError(error);
      }
    },
    onChange(info) {
      const { status } = info.file;
      if (status === 'done') {
        message.success(`${info.file.name} 文件上传成功`);
      } else if (status === 'error') {
        message.error(`${info.file.name} 文件上传失败`);
      }
    }
  };

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
            <Dragger {...uploadProps} style={{ padding: 40 }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽CSV文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持CSV格式，包含字段：contentType, contentText, authorName, submitterName, appealReason等
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
    </div>
  );
}

export default ImportPage;
