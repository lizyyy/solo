import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Timeline, Table, Button, Modal, Form, Input, Select, message, Tag, Space, Row, Col, Statistic } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

function RecallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState([]);
  const [risks, setRisks] = useState([]);
  const [acceptances, setAcceptances] = useState([]);
  const [recallInfo, setRecallInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTimeline();
    fetchRisks();
    fetchAcceptances();
  }, [id]);

  const fetchTimeline = async () => {
    try {
      const res = await axios.get(`/api/recalls/${id}/timeline`);
      if (res.data.success) {
        setTimeline(res.data.data);
        const recallEvent = res.data.data.find(e => e.type === 'recall_created');
        if (recallEvent) {
          setRecallInfo(recallEvent.data);
        }
      }
    } catch (error) {
      message.error('获取时间线失败');
    }
  };

  const fetchRisks = async () => {
    try {
      const res = await axios.get(`/api/recalls/${id}/risks`);
      if (res.data.success) {
        setRisks(res.data.data);
      }
    } catch (error) {
      message.error('获取风险科室失败');
    }
  };

  const fetchAcceptances = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/recalls/${id}/acceptances`);
      if (res.data.success) {
        setAcceptances(res.data.data);
      }
    } catch (error) {
      message.error('获取退回验收失败');
    } finally {
      setLoading(false);
    }
  };

  const getTimelineIcon = (type) => {
    switch (type) {
      case 'recall_created':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'recall_reviewed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'return_accepted':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'risk_calculated':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      default:
        return <ExclamationCircleOutlined />;
    }
  };

  const getRiskTag = (level) => {
    const colorMap = { high: 'red', medium: 'orange', low: 'blue' };
    return <Tag color={colorMap[level]}>{level === 'high' ? '高' : level === 'medium' ? '中' : '低'}</Tag>;
  };

  const handleEditAcceptance = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      returned_quantity: record.returned_quantity,
      status: record.status,
      modified_reason: ''
    });
    setModalVisible(true);
  };

  const handleSaveAcceptance = async (values) => {
    try {
      await axios.put(`/api/return-acceptances/${editingItem.id}`, {
        ...values,
        operator: 'admin'
      });
      message.success('保存成功');
      setModalVisible(false);
      fetchAcceptances();
      fetchTimeline();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const riskColumns = [
    { title: '科室名称', dataIndex: 'department_name', key: 'department_name' },
    { title: '风险等级', dataIndex: 'risk_level', key: 'risk_level', render: getRiskTag },
    { title: '影响患者数', dataIndex: 'affected_patients', key: 'affected_patients' },
    { title: '使用数量', dataIndex: 'usage_quantity', key: 'usage_quantity' }
  ];

  const acceptanceColumns = [
    { title: '科室名称', dataIndex: 'department_name', key: 'department_name' },
    { title: '应退回数量', dataIndex: 'expected_quantity', key: 'expected_quantity' },
    { title: '已退回数量', dataIndex: 'returned_quantity', key: 'returned_quantity' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s) => s === 'accepted' ? <Tag color="green">已验收</Tag> : <Tag color="orange">待验收</Tag> },
    { title: '验收人', dataIndex: 'accepted_by', key: 'accepted_by' },
    { title: '修改原因', dataIndex: 'modified_reason', key: 'modified_reason' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button size="small" onClick={() => handleEditAcceptance(record)}>
          {record.status === 'accepted' ? '修改' : '验收'}
        </Button>
      )
    }
  ];

  const totalPatients = risks.reduce((sum, r) => sum + (r.affected_patients || 0), 0);
  const highRiskCount = risks.filter(r => r.risk_level === 'high').length;
  const completedReturns = acceptances.filter(a => a.status === 'accepted').length;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        返回列表
      </Button>

      {recallInfo && (
        <Card title={`召回详情 - ${recallInfo.batch_no || ''}`} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="召回级别" value={recallInfo.recall_level} />
            </Col>
            <Col span={6}>
              <Statistic title="发起人" value={recallInfo.initiator} />
            </Col>
            <Col span={6}>
              <Statistic title="风险科室" value={risks.length} suffix={`个，其中${highRiskCount}个高风险`} />
            </Col>
            <Col span={6}>
              <Statistic title="退回进度" value={completedReturns} suffix={`/${acceptances.length}`} />
            </Col>
          </Row>
          <div style={{ marginTop: 16 }}>
            <strong>召回原因：</strong>{recallInfo.recall_reason}
          </div>
        </Card>
      )}

      <Card title="处理时间线" style={{ marginBottom: 16 }}>
        <Timeline>
          {timeline.map((item, index) => (
            <Timeline.Item key={index} dot={getTimelineIcon(item.type)}>
              <p><strong>{item.title}</strong></p>
              <p>{item.content}</p>
              <p style={{ color: '#999', fontSize: '12px' }}>{item.time}</p>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="风险科室统计">
            <Table
              columns={riskColumns}
              dataSource={risks}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="退回验收记录">
            <Table
              columns={acceptanceColumns}
              dataSource={acceptances}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingItem?.status === 'accepted' ? '修改退回记录' : '退回验收'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveAcceptance}>
          <Form.Item name="returned_quantity" label="退回数量" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select>
              <Option value="accepted">已验收</Option>
              <Option value="pending">待验收</Option>
              <Option value="partial">部分退回</Option>
            </Select>
          </Form.Item>
          <Form.Item name="modified_reason" label="修改原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="请填写修改原因，用于追溯" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RecallDetail;
