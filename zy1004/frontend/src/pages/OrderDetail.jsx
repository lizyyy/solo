import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Divider,
  List,
  Modal,
  Form,
  Select,
  Input,
  InputNumber,
  message,
  Table,
  Timeline,
  Row,
  Col,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  ToolOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { repairOrderAPI, sparePartAPI } from '../services/api';
import { STATUS_COLOR, getNextStatuses } from '../utils/status';

const { TextArea } = Input;

function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [spareParts, setSpareParts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [consumeModalVisible, setConsumeModalVisible] = useState(false);
  const [costModalVisible, setCostModalVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);

  const [statusForm] = Form.useForm();
  const [consumeForm] = Form.useForm();
  const [costForm] = Form.useForm();
  const [logForm] = Form.useForm();

  const [selectedParts, setSelectedParts] = useState([{ spare_part_id: null, quantity: 1 }]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [orderRes, partsRes] = await Promise.all([
        repairOrderAPI.getById(id),
        sparePartAPI.getAll(),
      ]);
      setOrder(orderRes.data);
      setSpareParts(partsRes.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (values) => {
    try {
      await repairOrderAPI.updateStatus(id, {
        status: values.status,
        reason: values.reason,
      });
      message.success('状态更新成功');
      setStatusModalVisible(false);
      statusForm.resetFields();
      loadData();
    } catch (error) {
      message.error(error.message || '更新失败');
    }
  };

  const handleConsumeParts = async () => {
    try {
      const items = selectedParts
        .filter((p) => p.spare_part_id && p.quantity > 0)
        .map((p) => ({
          spare_part_id: p.spare_part_id,
          quantity: p.quantity,
        }));

      if (items.length === 0) {
        message.warning('请选择要消耗的备件');
        return;
      }

      await repairOrderAPI.consumeParts(id, items);
      message.success('备件消耗成功');
      setConsumeModalVisible(false);
      setSelectedParts([{ spare_part_id: null, quantity: 1 }]);
      loadData();
    } catch (error) {
      message.error(error.message || '消耗失败');
    }
  };

  const handleCostAdjust = async (values) => {
    try {
      await repairOrderAPI.adjustCost(id, values);
      message.success('费用调整成功');
      setCostModalVisible(false);
      costForm.resetFields();
      loadData();
    } catch (error) {
      message.error(error.message || '调整失败');
    }
  };

  const handleAddLog = async (values) => {
    try {
      await repairOrderAPI.addCommunicationLog(id, values);
      message.success('添加沟通记录成功');
      setLogModalVisible(false);
      logForm.resetFields();
      loadData();
    } catch (error) {
      message.error(error.message || '添加失败');
    }
  };

  const handleMarkPaid = async () => {
    try {
      await repairOrderAPI.markPaid(id);
      message.success('标记收款成功');
      loadData();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const addPartRow = () => {
    setSelectedParts([...selectedParts, { spare_part_id: null, quantity: 1 }]);
  };

  const removePartRow = (index) => {
    if (selectedParts.length > 1) {
      const newParts = [...selectedParts];
      newParts.splice(index, 1);
      setSelectedParts(newParts);
    }
  };

  const updatePartRow = (index, field, value) => {
    const newParts = [...selectedParts];
    newParts[index] = { ...newParts[index], [field]: value };
    setSelectedParts(newParts);
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!order) {
    return <div>维修单不存在</div>;
  }

  const nextStatuses = getNextStatuses(order.status);
  const canConsumeParts = ['维修中', '待取件'].includes(order.status);
  const canMarkPaid = order.status === '已完成' && !order.is_paid;
  const finalAmount = order.final_cost || order.estimated_cost || 0;
  const actualAmount = finalAmount - (order.discount || 0);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
          返回列表
        </Button>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <span>维修单详情</span>
                <Tag color={STATUS_COLOR[order.status]}>{order.status}</Tag>
                {order.is_paid && <Tag color="success">已收款</Tag>}
              </Space>
            }
            extra={
              <Space>
                {nextStatuses.length > 0 && (
                  <Button type="primary" onClick={() => setStatusModalVisible(true)}>
                    更改状态
                  </Button>
                )}
                {canConsumeParts && (
                  <Button icon={<ToolOutlined />} onClick={() => setConsumeModalVisible(true)}>
                    消耗备件
                  </Button>
                )}
                <Button icon={<EditOutlined />} onClick={() => setCostModalVisible(true)}>
                  调整费用
                </Button>
                {canMarkPaid && (
                  <Popconfirm
                    title="确认标记为已收款？"
                    onConfirm={handleMarkPaid}
                    okText="确认"
                    cancelText="取消"
                  >
                    <Button type="primary" icon={<CheckCircleOutlined />}>
                      标记收款
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            }
          >
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="订单编号">{order.order_no}</Descriptions.Item>
              <Descriptions.Item label="维修方式">{order.appointment_type}</Descriptions.Item>

              <Descriptions.Item label="客户姓名">{order.customer_name}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{order.customer_phone}</Descriptions.Item>

              {order.customer_address && (
                <Descriptions.Item label="地址" span={2}>
                  {order.customer_address}
                </Descriptions.Item>
              )}

              <Descriptions.Item label="设备类型">{order.device_type}</Descriptions.Item>
              <Descriptions.Item label="品牌/型号">
                {order.device_brand || '-'} {order.device_model ? `/ ${order.device_model}` : ''}
              </Descriptions.Item>

              <Descriptions.Item label="故障描述" span={2}>
                {order.fault_description}
              </Descriptions.Item>

              <Descriptions.Item label="预约时间">
                {order.appointment_time ? dayjs(order.appointment_time).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="指派技师">
                {order.technician?.name || '未指派'}
              </Descriptions.Item>

              <Descriptions.Item label="预计费用">¥{order.estimated_cost?.toFixed(2) || '0.00'}</Descriptions.Item>
              <Descriptions.Item label="最终费用">¥{finalAmount.toFixed(2)}</Descriptions.Item>

              <Descriptions.Item label="优惠金额">¥{(order.discount || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="应收金额">
                <strong style={{ fontSize: 16, color: '#fa8c16' }}>
                  ¥{actualAmount.toFixed(2)}
                </strong>
              </Descriptions.Item>

              <Descriptions.Item label="创建时间">
                {dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {order.complete_time ? dayjs(order.complete_time).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>

              {order.notes && (
                <Descriptions.Item label="备注" span={2}>
                  {order.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card title="已消耗备件" style={{ marginTop: 16 }}>
            {order.inventory_transactions?.length > 0 ? (
              <Table
                dataSource={order.inventory_transactions}
                rowKey="id"
                pagination={false}
                size="small"
              >
                <Table.Column
                  title="备件名称"
                  dataIndex="spare_part"
                  render={(_, record) => {
                    const part = spareParts.find((p) => p.id === record.spare_part_id);
                    return part?.name || '-';
                  }}
                />
                <Table.Column title="数量" dataIndex="quantity" />
                <Table.Column
                  title="单价"
                  dataIndex="unit_price"
                  render={(v) => `¥${v?.toFixed(2) || '0.00'}`}
                />
                <Table.Column
                  title="小计"
                  render={(_, record) => `¥${(record.quantity * record.unit_price).toFixed(2)}`}
                />
                <Table.Column
                  title="操作时间"
                  dataIndex="created_at"
                  render={(v) => dayjs(v).format('YYYY-MM-DD HH:mm')}
                />
              </Table>
            ) : (
              <div className="empty-state">暂无消耗记录</div>
            )}
          </Card>

          <Card
            title={
              <Space>
                <MessageOutlined /> 沟通记录
                <Button type="link" size="small" onClick={() => setLogModalVisible(true)}>
                  添加记录
                </Button>
              </Space>
            }
            style={{ marginTop: 16 }}
          >
            {order.communication_logs?.length > 0 ? (
              <List
                dataSource={order.communication_logs}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      description={dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                    />
                    <div style={{ width: '100%', marginTop: 4 }}>{item.content}</div>
                  </List.Item>
                )}
              />
            ) : (
              <div className="empty-state">暂无沟通记录</div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<Space><HistoryOutlined /> 状态变更历史</Space>}>
            {order.status_histories?.length > 0 ? (
              <Timeline>
                {order.status_histories
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((item, index) => (
                    <Timeline.Item
                      key={item.id}
                      color={index === 0 ? 'blue' : 'gray'}
                    >
                      <div>
                        <Space>
                          <Tag color={STATUS_COLOR[item.to_status]}>{item.to_status}</Tag>
                          {item.from_status && (
                            <span style={{ color: '#999', fontSize: 12 }}>
                              ← {item.from_status}
                            </span>
                          )}
                        </Space>
                        {item.reason && <div style={{ color: '#666', marginTop: 4 }}>{item.reason}</div>}
                        <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                          {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    </Timeline.Item>
                  ))}
              </Timeline>
            ) : (
              <div className="empty-state">暂无状态变更记录</div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="更改状态"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        footer={null}
      >
        <Form form={statusForm} layout="vertical" onFinish={handleStatusChange}>
          <Form.Item
            name="status"
            label="目标状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择要更改的状态">
              {nextStatuses.map((s) => (
                <Select.Option key={s} value={s}>
                  {s}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="变更原因">
            <TextArea rows={3} placeholder="请输入变更原因（可选）" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
              <Button onClick={() => setStatusModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="消耗备件"
        open={consumeModalVisible}
        onCancel={() => setConsumeModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          {selectedParts.map((part, index) => (
            <Row gutter={8} key={index} style={{ marginBottom: 8 }}>
              <Col span={14}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择备件"
                  value={part.spare_part_id || undefined}
                  onChange={(value) => updatePartRow(index, 'spare_part_id', value)}
                  showSearch
                  optionFilterProp="children"
                >
                  {spareParts.map((p) => (
                    <Select.Option key={p.id} value={p.id}>
                      {p.name} (库存: {p.stock_quantity} {p.unit}, ¥{p.unit_price})
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col span={6}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  value={part.quantity}
                  onChange={(value) => updatePartRow(index, 'quantity', value || 1)}
                  placeholder="数量"
                />
              </Col>
              <Col span={4}>
                {selectedParts.length > 1 && (
                  <Button danger onClick={() => removePartRow(index)}>
                    删除
                  </Button>
                )}
              </Col>
            </Row>
          ))}
          <Button type="dashed" onClick={addPartRow} style={{ width: '100%' }}>
            + 添加备件
          </Button>
        </div>
        <Space>
          <Button type="primary" onClick={handleConsumeParts}>
            确认消耗
          </Button>
          <Button onClick={() => setConsumeModalVisible(false)}>取消</Button>
        </Space>
      </Modal>

      <Modal
        title="调整费用"
        open={costModalVisible}
        onCancel={() => setCostModalVisible(false)}
        footer={null}
      >
        <Form
          form={costForm}
          layout="vertical"
          onFinish={handleCostAdjust}
          initialValues={{
            final_cost: order.final_cost || order.estimated_cost || 0,
            discount: order.discount || 0,
          }}
        >
          <Form.Item name="final_cost" label="最终费用 (元)">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="discount" label="优惠金额 (元)">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="reason" label="调整原因">
            <TextArea rows={2} placeholder="请输入调整原因（可选）" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
              <Button onClick={() => setCostModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加沟通记录"
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={null}
      >
        <Form form={logForm} layout="vertical" onFinish={handleAddLog}>
          <Form.Item
            name="content"
            label="记录内容"
            rules={[{ required: true, message: '请输入记录内容' }]}
          >
            <TextArea rows={4} placeholder="请输入沟通记录内容" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
              <Button onClick={() => setLogModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default OrderDetail;
