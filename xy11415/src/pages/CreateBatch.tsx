import React, { useState } from 'react';
import { Form, Input, Button, Upload, Card, message, Alert, Spin } from 'antd';
import { UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { apiClient } from '../utils/api';
import { CreateBatchResponse } from '../../shared/types.js';

const { TextArea } = Input;

const CreateBatch: React.FC = () => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [failedRecords, setFailedRecords] = useState<any[]>([]);
  const navigate = useNavigate();

  const uploadProps: UploadProps = {
    fileList,
    beforeUpload: (file) => {
      const isSupported = 
        file.type.startsWith('image/') ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.pdf');
      
      if (!isSupported) {
        message.error('只支持图片、Excel和PDF文件');
        return Upload.LIST_IGNORE;
      }
      
      setFileList([...fileList, file]);
      return false;
    },
    onRemove: (file) => {
      setFileList(fileList.filter(f => f.uid !== file.uid));
    },
    multiple: true
  };

  const onFinish = async (values: { title: string; remark: string }) => {
    if (fileList.length === 0) {
      message.warning('请至少上传一个文件');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('remark', values.remark || '');
      
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('files', file.originFileObj);
        }
      });

      const result = await apiClient.postFormData<CreateBatchResponse>('/batches', formData);
      
      if (result.failedRecords && result.failedRecords.length > 0) {
        setFailedRecords(result.failedRecords);
      }

      message.success(`批次创建成功！批次号: ${result.batchNo}`);
      
      setTimeout(() => {
        navigate('/batches');
      }, 1500);
    } catch (error) {
      console.error('创建失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/batches')}
          style={{ paddingLeft: 0 }}
        >
          返回列表
        </Button>
      </div>

      <Card title="创建异常批次" style={{ maxWidth: 800, margin: '0 auto' }}>
        {failedRecords.length > 0 && (
          <Alert
            message={`部分数据解析失败 (${failedRecords.length} 条)`}
            description={
              <div>
                {failedRecords.slice(0, 5).map((record, index) => (
                  <div key={index} style={{ fontSize: 12 }}>
                    行 {record.rowNumber}: {record.reason} - {record.originalValue}
                  </div>
                ))}
                {failedRecords.length > 5 && (
                  <div>... 还有 {failedRecords.length - 5} 条</div>
                )}
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            name="title"
            label="批次标题"
            rules={[{ required: true, message: '请输入批次标题' }]}
          >
            <Input placeholder="例如：2024年5月第一周维修异常" size="large" />
          </Form.Item>

          <Form.Item
            name="remark"
            label="客服备注"
          >
            <TextArea
              rows={4}
              placeholder="请填写相关备注信息..."
            />
          </Form.Item>

          <Form.Item
            label="上传文件"
            required
            extra="支持上传报修截图、维修回执、材料领用表等图片、Excel或PDF文件"
          >
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} size="large">
                选择文件
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item style={{ marginTop: 32 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              style={{ background: '#1e3a5f', borderColor: '#1e3a5f', height: 44 }}
            >
              {loading ? <Spin size="small" /> : '创建批次'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CreateBatch;
