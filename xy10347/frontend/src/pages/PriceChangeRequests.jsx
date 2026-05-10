import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Card,
  Tag,
  Space,
  Alert,
  Descriptions
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { TextArea } = Input;

function PriceChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approveResult, setApproveResult] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      setLoading(true);
      const [requestsRes, ordersRes] = await Promise.all([
        axios.get('/api/price-change-requests', { params: { status: filterStatus } }),
        axios.get('/api/orders')
      ]);
      setRequests(requestsRes.data);
      setOrders(ordersRes.data.filter(o => 
        o.status === 'paid' && o.is_settled === 0
      ));
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '订单号',
      dataIndex: 'order_id',
      key: 'order_id',
      ellipsis: true,
      width: 200
    },
    {
      title: '学员',
      dataIndex: 'student_name',
      key: 'student_name'
    },
    {
      title: '课程',
      dataIndex: 'course_name',
      key: 'course_name'
    },
    {
      title: '团长',
      dataIndex: 'team_leader_name',
      key: 'team_leader_name'
    },
    {
      title: '原价',
      dataIndex: 'original_price',
      key: 'original_price',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '申请价',
      dataIndex: 'requested_price',
      key: 'requested_price',
      render: (v, record) => {
        const diff = v - record.original_price;
        return (
          <div>
            <span>¥{v.toFixed(2)}</span>
            {diff !== 0 && (
              <span style={{ marginLeft: 8, color: diff > 0 ? '#52c41a' : '#ff4d4f' }}>
                ({diff > 0 ? '+' : ''}¥{diff.toFixed(2)})
              </span>
            )}
          </div>
        );
      }
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const statusMap = {
          'pending': { color: 'orange', text: '待审批' },
          'approved': { color: 'green', text: '已通过' },
          'rejected': { color: 'red', text: '已驳回' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        if (record.status !== 'pending') return null;
        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => showApproveModal(record, true)}
            >
              通过
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => showApproveModal(record, false)}
            >
              驳回
            </Button>
          </Space>
        );
      }
    }
  ];

  const showApproveModal = (request, approved) => {
    setSelectedRequest({ ...request, approveAction: approved });
    setApproveResult(null);
    setApproveModalVisible(true);
  };

  const handleCreate = async (values) => {
    try {
      await axios.post('/api/price-change-requests', values);
      message.success('创建改价申请成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error('创建失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleApprove = async () => {
    try {
      const res = await axios.post(
        `/api/price-change-requests/${selectedRequest.id}/approve`,
        {
          approved: selectedRequest.approveAction,
          approved_by: '管理员'
        }
      );
      setApproveResult(res.data);
      message.success(
        selectedRequest.approveAction ? '审批通过' : '已驳回'
      );
      loadData();
    } catch (error) {
      message.error('操作失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div>
      <Card>
        <div className="operation-buttons">
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setCreateModalVisible(true)}
          >
            新建改价申请
          </Button>
          <Space>
            <Select
              placeholder="筛选状态"
              style={{ width: 150 }}
              allowClear
              value={filterStatus}
              onChange={setFilterStatus}
            >
              <Option value="pending">待审批</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已驳回</Option>
            </Select>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </div>

        <Alert
          message="改价审批说明"
          description={
            <div>
              <p>• 改价申请用于调整已付款但未结算订单的价格</p>
              <p>• 改价后佣金会自动重新计算</p>
              <p>• 已结算订单不允许改价</p>
              <p>• 审批通过后立即生效</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Space style={{ marginBottom: 16 }}>
          <Tag color="orange">待审批: {pendingCount}</Tag>
          <Tag color="green">已通过: {approvedCount}</Tag>
          <Tag color="red">已驳回: {rejectedCount}</Tag>
        </Space>

        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="新建改价申请"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="order_id"
            label="选择订单"
            rules={[{ required: true, message: '请选择订单' }]}
          >
            <Select placeholder="选择要改价的订单（仅显示未结算的已付款订单）">
              {orders.map(order => (
                <Option key={order.id} value={order.id}>
                  {order.student_name} - {order.course_name} (¥{order.final_price.toFixed(2)})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="requested_price"
            label="申请价格"
            rules={[{ required: true, message: '请输入申请价格' }]}
          >
            <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="改价原因"
            rules={[{ required: true, message: '请输入改价原因' }]}
          >
            <TextArea rows={3} placeholder="请说明改价原因" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">提交申请</Button>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedRequest?.approveAction ? '审批通过' : '审批驳回'}
        open={approveModalVisible}
        onCancel={() => setApproveModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedRequest && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="订单号">
                  {selectedRequest.order_id}
                </Descriptions.Item>
                <Descriptions.Item label="学员">
                  {selectedRequest.student_name}
                </Descriptions.Item>
                <Descriptions.Item label="课程">
                  {selectedRequest.course_name}
                </Descriptions.Item>
                <Descriptions.Item label="当前价格">
                  ¥{selectedRequest.original_price.toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="申请价格">
                  ¥{selectedRequest.requested_price.toFixed(2)}
                  <span style={{ 
                    marginLeft: 8, 
                    color: selectedRequest.requested_price > selectedRequest.original_price ? '#52c41a' : '#ff4d4f' 
                  }}>
                    ({selectedRequest.requested_price > selectedRequest.original_price ? '+' : ''}
                    ¥{(selectedRequest.requested_price - selectedRequest.original_price).toFixed(2)})
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="改价原因">
                  {selectedRequest.reason}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {!approveResult ? (
              <div>
                {selectedRequest.approveAction ? (
                  <Alert
                    message="确认通过该改价申请？"
                    description="通过后订单价格和佣金将立即更新"
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                ) : (
                  <Alert
                    message="确认驳回该改价申请？"
                    description="驳回后申请将无法恢复"
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}
                <Space>
                  <Button 
                    type={selectedRequest.approveAction ? 'primary' : 'danger'} 
                    onClick={handleApprove}
                  >
                    {selectedRequest.approveAction ? '确认通过' : '确认驳回'}
                  </Button>
                  <Button onClick={() => setApproveModalVisible(false)}>
                    取消
                  </Button>
                </Space>
              </div>
            ) : (
              <div className="processing-result">
                <h4 style={{ marginBottom: 12 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  处理结果
                </h4>
                {approveResult.approved ? (
                  <>
                    <div className="result-item">
                      <span className="result-label">审批结果</span>
                      <span className="result-value positive">已通过</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">价格变化</span>
                      <span className="result-value">
                        ¥{approveResult.old_price.toFixed(2)} → ¥{approveResult.new_price.toFixed(2)}
                        <span style={{ 
                          marginLeft: 8, 
                          color: approveResult.price_change > 0 ? '#52c41a' : '#ff4d4f' 
                        }}>
                          ({approveResult.price_change > 0 ? '+' : ''}¥{approveResult.price_change.toFixed(2)})
                        </span>
                      </span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">佣金变化</span>
                      <span className="result-value">
                        ¥{approveResult.old_commission.toFixed(2)} → ¥{approveResult.new_commission.toFixed(2)}
                        <span style={{ 
                          marginLeft: 8, 
                          color: approveResult.commission_change > 0 ? '#52c41a' : '#ff4d4f' 
                        }}>
                          ({approveResult.commission_change > 0 ? '+' : ''}¥{approveResult.commission_change.toFixed(2)})
                        </span>
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="result-item">
                    <span className="result-label">审批结果</span>
                    <span className="result-value negative">已驳回</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PriceChangeRequests;
