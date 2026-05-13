import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Modal, Form, Tag, Space, message, Row, Col, DatePicker, Descriptions } from 'antd';
import { EyeOutlined, CheckOutlined, SwapOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const Exceptions = () => {
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', handler: '', start_date: '', end_date: '' });
  const [detailModal, setDetailModal] = useState(false);
  const [handleModal, setHandleModal] = useState(false);
  const [handoverModal, setHandoverModal] = useState(false);
  const [selectedException, setSelectedException] = useState(null);
  const [form] = Form.useForm();
  const [handoverForm] = Form.useForm();

  useEffect(() => {
    loadExceptions();
  }, [filters]);

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/pickup-exceptions', { params: filters });
      setExceptions(res.data);
    } catch (error) {
      message.error('加载失败');
    }
    setLoading(false);
  };

  const viewDetail = (record) => {
    setSelectedException(record);
    setDetailModal(true);
  };

  const handleException = (record) => {
    setSelectedException(record);
    setHandleModal(true);
  };

  const handoverException = (record) => {
    setSelectedException(record);
    setHandoverModal(true);
  };

  const handleHandleSubmit = async (values) => {
    try {
      await axios.put(`/api/pickup-exceptions/${selectedException.id}`, {
        ...values,
        handler: values.handler || '管理员'
      });
      message.success('处理成功');
      setHandleModal(false);
      form.resetFields();
      loadExceptions();
    } catch (error) {
      message.error('处理失败');
    }
  };

  const handleHandoverSubmit = async (values) => {
    try {
      await axios.post('/api/exception-handover', {
        exception_id: selectedException.id,
        from_handler: '当前处理人',
        ...values
      });
      message.success('交接成功');
      setHandoverModal(false);
      handoverForm.resetFields();
      loadExceptions();
    } catch (error) {
      message.error('交接失败');
    }
  };

  const exportExceptions = () => {
    const params = new URLSearchParams(filters).toString();
    window.open(`/api/export/exceptions?${params}`, '_blank');
  };

  const getStatusTag = (status) => {
    const statusMap = {
      'pending': { color: 'orange', text: '待处理' },
      'processing': { color: 'blue', text: '处理中' },
      'resolved': { color: 'green', text: '已解决' }
    };
    const s = statusMap[status] || statusMap['pending'];
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const columns = [
    {
      title: '儿童姓名',
      dataIndex: 'child_name',
      key: 'child_name',
    },
    {
      title: '班级',
      dataIndex: 'class_name',
      key: 'class_name',
    },
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      key: 'exception_type',
      render: (type) => {
        const typeMap = {
          'late_pickup': '迟接',
          'unauthorized': '未授权',
          'missing': '未签到'
        };
        return typeMap[type] || type;
      }
    },
    {
      title: '异常级别',
      dataIndex: 'exception_level',
      key: 'exception_level',
      render: (level) => {
        const colorMap = {
          'warning': 'orange',
          'danger': 'red',
          'info': 'blue'
        };
        return <Tag color={colorMap[level]}>{level === 'warning' ? '警告' : level === 'danger' ? '严重' : '提示'}</Tag>;
      }
    },
    {
      title: '接送日期',
      dataIndex: 'pickup_date',
      key: 'pickup_date',
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '迟接分钟',
      dataIndex: 'late_minutes',
      key: 'late_minutes',
      render: (minutes) => minutes ? `${minutes}分钟` : '-'
    },
    {
      title: '迟接费用',
      dataIndex: 'late_fee',
      key: 'late_fee',
      render: (fee) => fee ? `¥${fee}` : '-'
    },
    {
      title: '责任人',
      dataIndex: 'handler',
      key: 'handler',
      render: (handler) => handler || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => viewDetail(record)}>
            详情
          </Button>
          {record.status !== 'resolved' && (
            <Button type="link" icon={<CheckOutlined />} onClick={() => handleException(record)}>
              处理
            </Button>
          )}
          {record.status === 'processing' && (
            <Button type="link" icon={<SwapOutlined />} onClick={() => handoverException(record)}>
              交接
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-title">异常记录管理</div>

      <Row className="filter-bar" gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            onChange={(v) => setFilters({ ...filters, status: v })}
          >
            <Option value="pending">待处理</Option>
            <Option value="processing">处理中</Option>
            <Option value="resolved">已解决</Option>
          </Select>
        </Col>
        <Col>
          <Input
            placeholder="责任人"
            style={{ width: 120 }}
            allowClear
            onChange={(e) => setFilters({ ...filters, handler: e.target.value })}
          />
        </Col>
        <Col>
          <DatePicker.RangePicker
            style={{ width: 280 }}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setFilters({
                  ...filters,
                  start_date: dates[0].format('YYYY-MM-DD'),
                  end_date: dates[1].format('YYYY-MM-DD')
                });
              } else {
                setFilters({ ...filters, start_date: '', end_date: '' });
              }
            }}
          />
        </Col>
        <Col>
          <Button icon={<DownloadOutlined />} onClick={exportExceptions}>
            导出报告
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={exceptions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="异常详情"
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        width={600}
        footer={[
          <Button key="close" onClick={() => setDetailModal(false)}>
            关闭
          </Button>
        ]}
      >
        {selectedException && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="儿童姓名">{selectedException.child_name}</Descriptions.Item>
              <Descriptions.Item label="班级">{selectedException.class_name}</Descriptions.Item>
              <Descriptions.Item label="异常类型">
                {selectedException.exception_type === 'late_pickup' ? '迟接' : selectedException.exception_type}
              </Descriptions.Item>
              <Descriptions.Item label="异常级别">
                {selectedException.exception_level === 'warning' ? '警告' : selectedException.exception_level}
              </Descriptions.Item>
              <Descriptions.Item label="接送日期" span={2}>
                {dayjs(selectedException.pickup_date).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{selectedException.description}</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                {getStatusTag(selectedException.status)}
              </Descriptions.Item>
              {selectedException.handler && (
                <Descriptions.Item label="责任人" span={2}>{selectedException.handler}</Descriptions.Item>
              )}
              {selectedException.handle_time && (
                <Descriptions.Item label="处理时间" span={2}>
                  {dayjs(selectedException.handle_time).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              )}
              {selectedException.handle_result && (
                <Descriptions.Item label="处理结果" span={2}>{selectedException.handle_result}</Descriptions.Item>
              )}
              {selectedException.handle_notes && (
                <Descriptions.Item label="处理备注" span={2}>{selectedException.handle_notes}</Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>

      <Modal
        title="处理异常"
        open={handleModal}
        onCancel={() => setHandleModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleHandleSubmit}>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select>
              <Option value="processing">处理中</Option>
              <Option value="resolved">已解决</Option>
            </Select>
          </Form.Item>
          <Form.Item name="handler" label="责任人">
            <Input placeholder="请输入处理人姓名" />
          </Form.Item>
          <Form.Item name="handle_result" label="处理结果">
            <Select>
              <Option value="已联系家长">已联系家长</Option>
              <Option value="费用已确认">费用已确认</Option>
              <Option value="已交接处理">已交接处理</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="handle_notes" label="处理备注">
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="异常交接"
        open={handoverModal}
        onCancel={() => setHandoverModal(false)}
        onOk={() => handoverForm.submit()}
      >
        <Form form={handoverForm} layout="vertical" onFinish={handleHandoverSubmit}>
          <Form.Item name="to_handler" label="交接给" rules={[{ required: true }]}>
            <Input placeholder="请输入接收人姓名" />
          </Form.Item>
          <Form.Item name="handover_notes" label="交接备注">
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Exceptions;
