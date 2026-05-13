import React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Descriptions, Timeline, Space, message, Divider, Row, Col, Modal, Form, Select, Input } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, TruckOutlined, UndoOutlined, AuditOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

const statusMap = {
  in_room: { color: 'green', text: '在房间' },
  pending_handover: { color: 'orange', text: '待交接' },
  floor_handover: { color: 'blue', text: '楼层交接中' },
  sent_to_factory: { color: 'purple', text: '已送厂' },
  in_factory: { color: 'cyan', text: '洗涤厂处理中' },
  damaged: { color: 'red', text: '发现破损' },
  compensation_pending: { color: 'orange', text: '待赔付' },
  compensation_completed: { color: 'green', text: '赔付完成' },
  returned_from_factory: { color: 'blue', text: '工厂送回' },
  restocked: { color: 'green', text: '库存回补' },
  back_to_room: { color: 'green', text: '返回房间' }
};

function LinenDetail({ linen, onBack }) {
  const [timeline, setTimeline] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [handoverModal, setHandoverModal] = useState(false);
  const [factorySendModal, setFactorySendModal] = useState(false);
  const [factoryReceiveModal, setFactoryReceiveModal] = useState(false);
  const [restockModal, setRestockModal] = useState(false);
  const [backToRoomModal, setBackToRoomModal] = useState(false);
  const [form] = Form.useForm();

  const fetchTimeline = async () => {
    try {
      const response = await axios.get(`/api/linen/${linen.tag_code}/timeline`);
      setTimeline(response.data);
    } catch (error) {
      message.error('获取时间线失败');
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`/api/linen/${linen.tag_code}/logs`);
      setLogs(response.data);
    } catch (error) {
      message.error('获取修改记录失败');
    }
  };

  useEffect(() => {
    fetchTimeline();
    fetchLogs();
  }, [linen]);

  const handleHandover = async (values) => {
    try {
      await axios.post('/api/handover', {
        ...values,
        tag_code: linen.tag_code
      });
      message.success('楼层交接成功');
      setHandoverModal(false);
      form.resetFields();
      fetchTimeline();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleFactorySend = async (values) => {
    try {
      await axios.post('/api/factory/send', {
        ...values,
        tag_code: linen.tag_code
      });
      message.success('送厂成功');
      setFactorySendModal(false);
      form.resetFields();
      fetchTimeline();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleFactoryReceive = async (values) => {
    try {
      await axios.post('/api/factory/receive', {
        ...values,
        tag_code: linen.tag_code
      });
      message.success('接收成功');
      setFactoryReceiveModal(false);
      form.resetFields();
      fetchTimeline();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleRestock = async (values) => {
    try {
      await axios.post('/api/inventory/restock', {
        ...values,
        tag_code: linen.tag_code
      });
      message.success('库存回补成功');
      setRestockModal(false);
      form.resetFields();
      fetchTimeline();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleBackToRoom = async (values) => {
    try {
      await axios.post('/api/inventory/back-to-room', {
        ...values,
        tag_code: linen.tag_code
      });
      message.success('返回房间成功');
      setBackToRoomModal(false);
      form.resetFields();
      fetchTimeline();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const statusConfig = statusMap[linen.status] || { color: 'default', text: linen.status };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
          返回列表
        </Button>
        <h2 className="page-title" style={{ margin: 0 }}>布草详情 - {linen.tag_code}</h2>
        <Tag color={statusConfig.color} style={{ fontSize: 16 }}>
          {statusConfig.text}
        </Tag>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="状态操作" className="card-content">
            <Space wrap size="middle">
              <Button 
                type="primary" 
                icon={<UndoOutlined />}
                onClick={() => setHandoverModal(true)}
              >
                楼层交接
              </Button>
              <Button 
                type="primary" 
                icon={<TruckOutlined />}
                onClick={() => setFactorySendModal(true)}
              >
                送洗涤厂
              </Button>
              <Button 
                type="primary" 
                icon={<CheckCircleOutlined />}
                onClick={() => setFactoryReceiveModal(true)}
              >
                工厂送回
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setRestockModal(true)}
              >
                库存回补
              </Button>
              <Button 
                type="primary" 
                icon={<AuditOutlined />}
                onClick={() => setBackToRoomModal(true)}
              >
                返回房间
              </Button>
            </Space>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="基本信息" className="card-content">
            <Descriptions bordered column={3}>
              <Descriptions.Item label="标签编号">{linen.tag_code}</Descriptions.Item>
              <Descriptions.Item label="布草类型">{linen.linen_type}</Descriptions.Item>
              <Descriptions.Item label="规格">{linen.size || '-'}</Descriptions.Item>
              <Descriptions.Item label="楼层">{linen.floor || '-'}</Descriptions.Item>
              <Descriptions.Item label="房间号">{linen.room_number || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(linen.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(linen.updated_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="状态时间线" className="card-content">
            <Timeline>
              {timeline.map((item, index) => (
                <Timeline.Item key={index}>
                  <p><strong>{item.status_text}</strong></p>
                  <p style={{ color: '#8c8c8c' }}>操作人: {item.operator}</p>
                  <p style={{ color: '#8c8c8c' }}>时间: {dayjs(item.operation_time).format('YYYY-MM-DD HH:mm:ss')}</p>
                  {item.remarks && <p>备注: {item.remarks}</p>}
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="修改记录" className="card-content">
            {logs.map((log, index) => (
              <div key={index} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
                <p><strong>{log.field_name}</strong></p>
                <p>
                  旧值: <span style={{ color: '#f5222d' }}>{log.old_value || '-'}</span> 
                  {' → '} 
                  新值: <span style={{ color: '#52c41a' }}>{log.new_value || '-'}</span>
                </p>
                <p style={{ color: '#8c8c8c', fontSize: 12 }}>
                  修改人: {log.changed_by || '系统'} | 时间: {dayjs(log.changed_at).format('YYYY-MM-DD HH:mm:ss')}
                </p>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Modal
        title="楼层交接"
        open={handoverModal}
        onCancel={() => setHandoverModal(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleHandover} layout="vertical">
          <Form.Item name="floor" label="楼层" rules={[{ required: true }]}>
            <Input placeholder="请输入楼层" />
          </Form.Item>
          <Form.Item name="handover_type" label="交接类型" rules={[{ required: true }]}>
            <Select placeholder="请选择交接类型">
              <Option value="收污">收污</Option>
              <Option value="发净">发净</Option>
            </Select>
          </Form.Item>
          <Form.Item name="handler" label="经办人" rules={[{ required: true }]}>
            <Input placeholder="请输入经办人" />
          </Form.Item>
          <Form.Item name="receiver" label="接收人">
            <Input placeholder="请输入接收人" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认交接
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="送洗涤厂"
        open={factorySendModal}
        onCancel={() => setFactorySendModal(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleFactorySend} layout="vertical">
          <Form.Item name="factory_name" label="洗涤厂名称" rules={[{ required: true }]}>
            <Input placeholder="请输入洗涤厂名称" />
          </Form.Item>
          <Form.Item name="sender" label="送件人" rules={[{ required: true }]}>
            <Input placeholder="请输入送件人" />
          </Form.Item>
          <Form.Item name="receiver" label="厂方接收人">
            <Input placeholder="请输入厂方接收人" />
          </Form.Item>
          <Form.Item name="vehicle_number" label="车牌号">
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认送厂
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="工厂送回"
        open={factoryReceiveModal}
        onCancel={() => setFactoryReceiveModal(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleFactoryReceive} layout="vertical">
          <Form.Item name="factory_name" label="洗涤厂名称" rules={[{ required: true }]}>
            <Input placeholder="请输入洗涤厂名称" />
          </Form.Item>
          <Form.Item name="sender" label="厂方送件人">
            <Input placeholder="请输入厂方送件人" />
          </Form.Item>
          <Form.Item name="receiver" label="接收人" rules={[{ required: true }]}>
            <Input placeholder="请输入接收人" />
          </Form.Item>
          <Form.Item name="vehicle_number" label="车牌号">
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认接收
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="库存回补"
        open={restockModal}
        onCancel={() => setRestockModal(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleRestock} layout="vertical">
          <Form.Item name="restock_type" label="回补类型" rules={[{ required: true }]}>
            <Select placeholder="请选择回补类型">
              <Option value="洗涤回库">洗涤回库</Option>
              <Option value="新购入">新购入</Option>
              <Option value="调拨">调拨</Option>
            </Select>
          </Form.Item>
          <Form.Item name="source" label="来源">
            <Input placeholder="请输入来源" />
          </Form.Item>
          <Form.Item name="handler" label="经办人" rules={[{ required: true }]}>
            <Input placeholder="请输入经办人" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认回补
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="返回房间"
        open={backToRoomModal}
        onCancel={() => setBackToRoomModal(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleBackToRoom} layout="vertical">
          <Form.Item name="floor" label="楼层" rules={[{ required: true }]}>
            <Input placeholder="请输入楼层" />
          </Form.Item>
          <Form.Item name="room_number" label="房间号" rules={[{ required: true }]}>
            <Input placeholder="请输入房间号" />
          </Form.Item>
          <Form.Item name="handler" label="经办人" rules={[{ required: true }]}>
            <Input placeholder="请输入经办人" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认返回
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default LinenDetail;