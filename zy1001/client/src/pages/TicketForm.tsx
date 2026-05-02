import React, { useState, useEffect, useCallback } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Space,
  Row,
  Col,
  message,
  Alert,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TicketPriority,
  PRIORITY_LABELS,
  CreateTicketRequest,
  UpdateTicketRequest,
  Ticket,
  TicketStatus,
} from '../types';
import { ticketApi } from '../services/api';

const { TextArea } = Input;
const { Item } = Form;

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
  value: value as TicketPriority,
  label,
}));

const TicketForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const ticketId = id ? parseInt(id, 10) : 0;
  const isEdit = ticketId > 0;
  const isClosed = ticket?.status === TicketStatus.CLOSED;

  const fetchTicket = useCallback(async () => {
    if (!isEdit) return;

    setInitialLoading(true);
    try {
      const data = await ticketApi.getTicket(ticketId);
      setTicket(data);
      form.setFieldsValue({
        title: data.title,
        customerName: data.customerName,
        customerContact: data.customerContact,
        priority: data.priority,
        assignee: data.assignee,
        tags: data.tags,
        description: data.description,
      });
    } catch (error) {
      message.error('获取工单信息失败');
      console.error(error);
    } finally {
      setInitialLoading(false);
    }
  }, [isEdit, ticketId, form]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (isEdit) {
        const updateData: UpdateTicketRequest = {};

        if (!isClosed) {
          updateData.title = values.title;
          updateData.customerName = values.customerName;
          updateData.customerContact = values.customerContact;
          updateData.description = values.description;
        }

        updateData.priority = values.priority;
        updateData.assignee = values.assignee;
        updateData.tags = values.tags;

        await ticketApi.updateTicket(ticketId, updateData);
        message.success('工单更新成功');
      } else {
        const createData: CreateTicketRequest = {
          title: values.title,
          customerName: values.customerName,
          customerContact: values.customerContact,
          priority: values.priority || TicketPriority.MEDIUM,
          assignee: values.assignee || '',
          tags: values.tags || '',
          description: values.description,
        };

        await ticketApi.createTicket(createData);
        message.success('工单创建成功');
      }
      navigate('/');
    } catch (error: any) {
      message.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <Card loading={true}>加载中...</Card>;
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回列表
          </Button>
        </Space>
      </Card>

      <Card title={isEdit ? '编辑工单' : '新建工单'}>
        {isClosed && (
          <Alert
            message="工单已关闭，只能修改优先级、负责人和标签，其他字段不可编辑"
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            priority: TicketPriority.MEDIUM,
          }}
        >
          <Row gutter={16}>
            <Col span={16}>
              <Item
                name="title"
                label="标题"
                rules={[
                  { required: true, message: '请输入标题' },
                  { max: 200, message: '标题不能超过200个字符' },
                ]}
              >
                <Input
                  placeholder="请输入工单标题"
                  disabled={isClosed}
                />
              </Item>
            </Col>
            <Col span={8}>
              <Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Select options={PRIORITY_OPTIONS} placeholder="请选择优先级" />
              </Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Item
                name="customerName"
                label="客户名称"
                rules={[
                  { required: true, message: '请输入客户名称' },
                  { max: 100, message: '客户名称不能超过100个字符' },
                ]}
              >
                <Input
                  placeholder="请输入客户名称"
                  disabled={isClosed}
                />
              </Item>
            </Col>
            <Col span={12}>
              <Item
                name="customerContact"
                label="客户联系方式"
                rules={[
                  { required: true, message: '请输入客户联系方式' },
                  { max: 100, message: '客户联系方式不能超过100个字符' },
                ]}
              >
                <Input
                  placeholder="请输入客户联系方式（电话/微信/邮箱等）"
                  disabled={isClosed}
                />
              </Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Item
                name="assignee"
                label="负责人"
                rules={[{ max: 50, message: '负责人不能超过50个字符' }]}
              >
                <Input placeholder="请输入负责人（可选）" />
              </Item>
            </Col>
            <Col span={12}>
              <Item
                name="tags"
                label="标签"
                rules={[{ max: 200, message: '标签不能超过200个字符' }]}
              >
                <Input placeholder="请输入标签，多个标签用逗号分隔（可选）" />
              </Item>
            </Col>
          </Row>

          <Item
            name="description"
            label="问题描述"
            rules={[
              { required: true, message: '请输入问题描述' },
              { max: 5000, message: '问题描述不能超过5000个字符' },
            ]}
          >
            <TextArea
              rows={8}
              placeholder="请详细描述问题..."
              disabled={isClosed}
            />
          </Item>

          <Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={loading}
              >
                {isEdit ? '保存' : '创建工单'}
              </Button>
              <Button onClick={() => navigate('/')}>
                取消
              </Button>
            </Space>
          </Item>
        </Form>
      </Card>
    </div>
  );
};

export default TicketForm;
