import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, Descriptions, Tag, Button, Space, Select, Input, 
  message, Spin, Modal, List, Divider, Table, Empty 
} from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { workOrderApi, sparePartApi } from '../api';
import dayjs from 'dayjs';

const { TextArea } = Input;

const statusMap = {
  pending: { label: '待接单', color: 'orange' },
  in_progress: { label: '维修中', color: 'blue' },
  waiting_parts: { label: '等待备件', color: 'red' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' }
};

const usageStatusMap = {
  occupied: { label: '占用中', color: 'orange' },
  released: { label: '已释放', color: 'default' },
  deducted: { label: '已扣减', color: 'green' }
};

const WorkOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrder, setWorkOrder] = useState(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [statusNote, setStatusNote] = useState('');
  const [spareParts, setSpareParts] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);
  const [partQuantities, setPartQuantities] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [commModalVisible, setCommModalVisible] = useState(false);
  const [commContent, setCommContent] = useState('');
  const [commOperator, setCommOperator] = useState('');

  useEffect(() => {
    loadWorkOrder();
    loadSpareParts();
  }, [id]);

  const loadWorkOrder = async () => {
    try {
      setLoading(true);
      const response = await workOrderApi.getById(id);
      setWorkOrder(response.data.data);
    } catch (error) {
      console.error('加载工单详情失败:', error);
      message.error('加载工单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSpareParts = async () => {
    try {
      const response = await sparePartApi.getAll();
      setSpareParts(response.data.data || []);
    } catch (error) {
      console.error('加载备件列表失败:', error);
    }
  };

  const getAvailableStatuses = () => {
    if (!workOrder) return [];
    
    const currentStatus = workOrder.status;
    const options = [];

    if (currentStatus === 'pending') {
      options.push({ value: 'in_progress', label: '开始维修（维修中）' });
    }
    
    if (currentStatus === 'in_progress' || currentStatus === 'waiting_parts') {
      options.push({ value: 'in_progress', label: '维修中' });
      options.push({ value: 'waiting_parts', label: '等待备件' });
    }

    if (currentStatus !== 'completed' && currentStatus !== 'cancelled') {
      options.push({ value: 'completed', label: '完成工单' });
      options.push({ value: 'cancelled', label: '取消工单' });
    }

    return options;
  };

  const handleStatusChange = async () => {
    if (!selectedStatus) {
      message.warning('请选择状态');
      return;
    }

    try {
      setSubmitting(true);
      
      const partsToUse = selectedParts.map(partId => ({
        id: partId,
        quantity: partQuantities[partId] || 1
      })).filter(p => p.quantity > 0);

      const response = await workOrderApi.updateStatus(id, {
        status: selectedStatus,
        note: statusNote,
        operator: '操作员',
        spare_parts: partsToUse.length > 0 ? partsToUse : undefined
      });

      message.success('状态更新成功');
      setStatusModalVisible(false);
      setSelectedStatus(null);
      setStatusNote('');
      setSelectedParts([]);
      setPartQuantities({});
      loadWorkOrder();
    } catch (error) {
      console.error('更新状态失败:', error);
      message.error(error.response?.data?.error || '更新状态失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCommunication = async () => {
    if (!commContent.trim()) {
      message.warning('请输入沟通内容');
      return;
    }

    try {
      setSubmitting(true);
      await workOrderApi.addCommunication(id, {
        operator: commOperator || '匿名',
        content: commContent
      });

      message.success('沟通记录添加成功');
      setCommModalVisible(false);
      setCommContent('');
      setCommOperator('');
      loadWorkOrder();
    } catch (error) {
      console.error('添加沟通记录失败:', error);
      message.error('添加沟通记录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePartSelect = (partId) => {
    setSelectedParts(prev => 
      prev.includes(partId) 
        ? prev.filter(id => id !== partId)
        : [...prev, partId]
    );
  };

  const handleQuantityChange = (partId, quantity) => {
    setPartQuantities(prev => ({
      ...prev,
      [partId]: quantity
    }));
  };

  const usageColumns = [
    {
      title: '备件名称',
      dataIndex: 'spare_part_name',
      key: 'spare_part_name'
    },
    {
      title: '型号',
      dataIndex: 'spare_part_model',
      key: 'spare_part_model'
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (q, record) => `${q} ${record.spare_part_unit}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const info = usageStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      }
    },
    {
      title: '占用时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>加载中...</p>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Empty description="工单不存在" />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/work-orders')}>
          返回工单列表
        </Button>
      </div>
    );
  }

  const statusInfo = statusMap[workOrder.status] || { label: workOrder.status, color: 'default' };
  const isFinished = workOrder.status === 'completed' || workOrder.status === 'cancelled';

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/work-orders')}>
            返回
          </Button>
          <h1 style={{ margin: 0 }}>工单详情</h1>
        </Space>
        {!isFinished && (
          <Space>
            <Button onClick={() => setCommModalVisible(true)}>
              添加沟通记录
            </Button>
            <Button type="primary" onClick={() => setStatusModalVisible(true)}>
              推进状态
            </Button>
          </Space>
        )}
      </div>

      <Card title="基本信息" style={{ marginBottom: 24 }}>
        <Descriptions column={3}>
          <Descriptions.Item label="工单号">
            <span style={{ fontWeight: 'bold' }}>{workOrder.order_no}</span>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(workOrder.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="客户姓名">{workOrder.customer_name}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{workOrder.customer_phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(workOrder.updated_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="设备类型">{workOrder.device_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="设备型号">{workOrder.device_model || '-'}</Descriptions.Item>
          <Descriptions.Item label=" "></Descriptions.Item>
          <Descriptions.Item label="故障描述" span={3}>
            {workOrder.fault_description || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="备件占用记录" style={{ marginBottom: 24 }}>
        {workOrder.usages && workOrder.usages.length > 0 ? (
          <Table
            columns={usageColumns}
            dataSource={workOrder.usages}
            rowKey="id"
            pagination={false}
          />
        ) : (
          <Empty description="暂无备件占用记录" />
        )}
      </Card>

      <Card title="沟通记录">
        {workOrder.communications && workOrder.communications.length > 0 ? (
          <List
            dataSource={workOrder.communications}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontWeight: 'bold' }}>{item.operator || '匿名'}</span>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                      </span>
                    </Space>
                  }
                  description={item.content}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无沟通记录" />
        )}
      </Card>

      <Modal
        title="推进工单状态"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        onOk={handleStatusChange}
        confirmLoading={submitting}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            选择新状态
          </label>
          <Select
            style={{ width: '100%' }}
            placeholder="请选择状态"
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={getAvailableStatuses()}
          />
        </div>

        {selectedStatus && selectedStatus !== 'cancelled' && selectedStatus !== 'completed' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
              占用备件（可选）
            </label>
            <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 4, padding: 8 }}>
              {spareParts.map(part => (
                <div 
                  key={part.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    marginBottom: 4,
                    backgroundColor: selectedParts.includes(part.id) ? '#e6f7ff' : '#fff',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: selectedParts.includes(part.id) ? '1px solid #1890ff' : '1px solid #f0f0f0'
                  }}
                  onClick={() => handlePartSelect(part.id)}
                >
                  <div>
                    <div style={{ fontWeight: part.stock <= part.safe_stock ? 'bold' : 'normal' }}>
                      {part.name} {part.model ? `(${part.model})` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: part.stock <= part.safe_stock ? '#ff4d4f' : '#666' }}>
                      库存: {part.stock} {part.unit}
                      {part.stock <= part.safe_stock && ' (库存不足)'}
                    </div>
                  </div>
                  {selectedParts.includes(part.id) && (
                    <Select
                      style={{ width: 80 }}
                      value={partQuantities[part.id] || 1}
                      onChange={(val) => handleQuantityChange(part.id, val)}
                      onClick={(e) => e.stopPropagation()}
                      options={Array.from({ length: Math.min(part.stock, 10) }, (_, i) => ({
                        value: i + 1,
                        label: `${i + 1} ${part.unit}`
                      }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            备注说明
          </label>
          <TextArea
            rows={3}
            placeholder="请输入状态变更说明..."
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
          />
        </div>

        {selectedStatus === 'cancelled' && (
          <div style={{ color: '#fa8c16', padding: 12, backgroundColor: '#fffbe6', borderRadius: 4 }}>
            <CloseCircleOutlined style={{ marginRight: 8 }} />
            取消工单将释放所有已占用的备件
          </div>
        )}

        {selectedStatus === 'completed' && (
          <div style={{ color: '#52c41a', padding: 12, backgroundColor: '#f6ffed', borderRadius: 4 }}>
            <CheckCircleOutlined style={{ marginRight: 8 }} />
            完成工单将扣减所有已占用的备件
          </div>
        )}
      </Modal>

      <Modal
        title="添加沟通记录"
        open={commModalVisible}
        onCancel={() => setCommModalVisible(false)}
        onOk={handleAddCommunication}
        confirmLoading={submitting}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            操作人
          </label>
          <Input
            placeholder="请输入操作人姓名（可选）"
            value={commOperator}
            onChange={(e) => setCommOperator(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            沟通内容
          </label>
          <TextArea
            rows={4}
            placeholder="请输入沟通内容..."
            value={commContent}
            onChange={(e) => setCommContent(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default WorkOrderDetail;
