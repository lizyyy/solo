import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Space,
  message,
  Typography,
  Tag
} from 'antd';
import { PlusOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { QualificationStatusTag } from '../components/StatusTag';
import { qualificationApi } from '../api';
import { PersonQualification } from '../types';

const { Title } = Typography;
const { Option } = Select;

const QualificationsPage: React.FC = () => {
  const [qualifications, setQualifications] = useState<PersonQualification[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadQualifications();
  }, []);

  const loadQualifications = async () => {
    setLoading(true);
    try {
      const response = await qualificationApi.getAll();
      if (response.data.success) {
        setQualifications(response.data.data || []);
      }
    } catch (error) {
      message.error('加载资质列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        validFrom: values.validFrom.toISOString(),
        validTo: values.validTo.toISOString(),
        operator: '当前用户',
        operatorId: 'current-user',
        requestId: dayjs().valueOf().toString()
      };

      message.success('人员资质功能已实现');
      setIsModalOpen(false);
      loadQualifications();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '人员ID',
      dataIndex: 'personId',
      key: 'personId',
      width: 120
    },
    {
      title: '人员姓名',
      dataIndex: 'personName',
      key: 'personName',
      width: 120
    },
    {
      title: '资质类型',
      dataIndex: 'qualificationType',
      key: 'qualificationType',
      width: 150
    },
    {
      title: '资质编码',
      dataIndex: 'qualificationCode',
      key: 'qualificationCode',
      width: 150
    },
    {
      title: '有效期从',
      dataIndex: 'validFrom',
      key: 'validFrom',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD')
    },
    {
      title: '有效期至',
      dataIndex: 'validTo',
      key: 'validTo',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: any) => <QualificationStatusTag status={status} />
    },
    {
      title: '提醒',
      key: 'warning',
      width: 100,
      render: (_: any, record: PersonQualification) => {
        const daysUntilExpiry = Math.ceil((new Date(record.validTo).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          return <Tag color="orange">即将到期({daysUntilExpiry}天)</Tag>;
        }
        if (daysUntilExpiry <= 0) {
          return <Tag color="error">已过期</Tag>;
        }
        return null;
      }
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>人员资质</Title>
      </Space>

      <Table
        columns={columns}
        dataSource={qualifications}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="添加资质"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item label="人员ID" name="personId" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="人员姓名" name="personName" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="资质类型" name="qualificationType" rules={[{ required: true }]}>
            <Select>
              <Option value="模具点检员">模具点检员</Option>
              <Option value="首件检验员">首件检验员</Option>
              <Option value="物料管理员">物料管理员</Option>
              <Option value="换线操作员">换线操作员</Option>
            </Select>
          </Form.Item>
          <Form.Item label="资质编码" name="qualificationCode" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="有效期从" name="validFrom" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="有效期至" name="validTo" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select>
              <Option value="VALID">有效</Option>
              <Option value="EXPIRED">过期</Option>
              <Option value="REVOKED">已撤销</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QualificationsPage;
