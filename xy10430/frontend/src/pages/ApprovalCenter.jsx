import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Card, Modal, Form, Input, InputNumber, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { claimApi } from '../services/api';
import moment from 'moment';

const { TextArea } = Input;

function ApprovalCenter() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await claimApi.list({ page: 1, pageSize: 100, status: 'pending_review' });
      if (res.success) {
        setData(res.data);
      }
    } catch (error) {
      console.error('加载待审批索赔失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (values) => {
    try {
      const res = await claimApi.approve(selectedClaim.id, values);
      if (res.success) {
        message.success('索赔已批准');
        setApproveModalVisible(false);
        loadData();
      }
    } catch (error) {
      message.error('批准失败');
    }
  };

  const handleReject = async (values) => {
    try {
      const res = await claimApi.reject(selectedClaim.id, values);
      if (res.success) {
        message.success('索赔已驳回');
        setRejectModalVisible(false);
        loadData();
      }
    } catch (error) {
      message.error('驳回失败');
    }
  };

  const getWarningFlags = (record) => {
    const flags = [];
    if (record.isDuplicate) flags.push(<Tag key="dup" color="red">重复索赔</Tag>);
    if (record.isExemptClaim) flags.push(<Tag key="exempt" color="orange">签收免责</Tag>);
    if (record.exceedsLimit) flags.push(<Tag key="limit" color="purple">金额超限</Tag>);
    return flags.length > 0 ? <Space size={[4, 4]}>{flags}</Space> : '-';
  };

  const columns = [
    {
      title: '索赔单号',
      dataIndex: 'claimNo',
      key: 'claimNo',
      render: (text, record) => (
        <a onClick={() => navigate(`/claims/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '运单号',
      dataIndex: ['shipment', 'shipmentNo'],
      key: 'shipmentNo'
    },
    {
      title: '客户',
      dataIndex: ['shipment', 'customerName'],
      key: 'customerName'
    },
    {
      title: '货物类型',
      dataIndex: ['shipment', 'cargoType', 'name'],
      key: 'cargoType'
    },
    {
      title: '索赔金额',
      dataIndex: 'claimAmount',
      key: 'claimAmount',
      render: (val) => `¥${val?.toLocaleString() || 0}`
    },
    {
      title: '责任方',
      dataIndex: 'responsibleParty',
      key: 'responsibleParty'
    },
    {
      title: '风险标记',
      key: 'flags',
      render: (_, record) => getWarningFlags(record)
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val) => moment(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            size="small"
            onClick={() => {
              setSelectedClaim(record);
              form.setFieldsValue({ approvedAmount: record.claimAmount });
              setApproveModalVisible(true);
            }}
          >
            批准
          </Button>
          <Button 
            danger
            size="small"
            onClick={() => {
              setSelectedClaim(record);
              setRejectModalVisible(true);
            }}
          >
            驳回
          </Button>
          <Button 
            size="small"
            onClick={() => navigate(`/claims/${record.id}`)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card title="待审批索赔">
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          暂无待审批的索赔
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      )}

      <Modal
        title="批准索赔"
        open={approveModalVisible}
        onCancel={() => setApproveModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleApprove}
        >
          <Form.Item
            name="approvedAmount"
            label="批准金额(元)"
            rules={[{ required: true, message: '请输入批准金额' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item
            name="approverName"
            label="审批人"
            rules={[{ required: true, message: '请输入审批人姓名' }]}
          >
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          <Form.Item
            name="remarks"
            label="审批意见"
          >
            <TextArea rows={3} placeholder="请输入审批意见" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setApproveModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认批准</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="驳回索赔"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleReject}
        >
          <Form.Item
            name="approverName"
            label="审批人"
            rules={[{ required: true, message: '请输入审批人姓名' }]}
          >
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          <Form.Item
            name="remarks"
            label="驳回原因"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <TextArea rows={4} placeholder="请详细说明驳回原因" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setRejectModalVisible(false)}>取消</Button>
              <Button type="primary" danger htmlType="submit">确认驳回</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default ApprovalCenter;
