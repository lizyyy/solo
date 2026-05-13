import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag, message, Timeline, Card, Progress } from 'antd';
import { PlusOutlined, CheckOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

function CostVarianceList() {
  const [data, setData] = useState([]);
  const [skuList, setSkuList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [logs, setLogs] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
    fetchSkuList();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/cost-variance');
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSkuList = async () => {
    try {
      const response = await api.get('/sku');
      setSkuList(response.data);
    } catch (error) {
      console.error('获取SKU列表失败:', error);
    }
  };

  const handleReview = async (record) => {
    Modal.confirm({
      title: '复核成本差异',
      content: (
        <div>
          <p>SKU: {record.sku_code}</p>
          <p>期间: {record.period}</p>
          <p>差异金额: ¥{record.variance}</p>
        </div>
      ),
      onOk: async () => {
        try {
          await api.post(`/cost-variance/${record.id}/review`, {
            analysis: '已复核，差异在正常范围内',
            reviewer_id: 'current_user',
            reviewer_name: '当前用户'
          });
          message.success('复核完成');
          fetchData();
        } catch (error) {
          message.error('操作失败');
        }
      }
    });
  };

  const handleView = async (record) => {
    setCurrentItem(record);
    try {
      const response = await api.get(`/logs/cost_variance/${record.id}`);
      setLogs(response.data);
    } catch (error) {
      console.error('获取操作日志失败:', error);
    }
    setDetailVisible(true);
  };

  const handleCalculate = async (values) => {
    try {
      const selectedSku = skuList.find(s => s.id === values.sku_id);
      await api.post('/cost-variance/calculate', {
        ...values,
        sku_code: selectedSku?.sku_code
      });
      message.success('计算成功');
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getVarianceColor = (variance) => {
    if (variance > 0) return 'red';
    if (variance < 0) return 'green';
    return 'blue';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      reviewed: 'green'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: '待复核',
      reviewed: '已复核'
    };
    return texts[status] || status;
  };

  const columns = [
    { title: 'SKU编码', dataIndex: 'sku_code', key: 'sku_code' },
    { title: '期间', dataIndex: 'period', key: 'period' },
    { title: '预期成本', dataIndex: 'expected_cost', key: 'expected_cost', render: v => `¥${v}` },
    { title: '实际成本', dataIndex: 'actual_cost', key: 'actual_cost', render: v => `¥${v}` },
    { 
      title: '差异金额', 
      dataIndex: 'variance', 
      key: 'variance',
      render: v => <span style={{ color: getVarianceColor(v), fontWeight: 'bold' }}>¥{v}</span>
    },
    { 
      title: '差异率', 
      dataIndex: 'variance_rate', 
      key: 'variance_rate',
      render: (v, record) => {
        const absRate = Math.abs(v);
        return (
          <Space>
            <Progress 
              percent={Math.min(absRate, 100)} 
              size="small" 
              status={absRate > 20 ? 'exception' : 'normal'}
              style={{ width: 80 }}
            />
            <span>{v.toFixed(2)}%</span>
          </Space>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
          {record.status === 'pending' && (
            <Button type="primary" icon={<CheckOutlined />} onClick={() => handleReview(record)}>
              复核
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          计算成本差异
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title="计算成本差异"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCalculate}>
          <Form.Item name="sku_id" label="SKU" rules={[{ required: true }]}>
            <Select>
              {skuList.map(sku => (
                <Option key={sku.id} value={sku.id}>{sku.sku_code} - {sku.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="period" label="期间" rules={[{ required: true }]}>
            <Input placeholder="例如：2024-01" />
          </Form.Item>
          <Form.Item name="expected_cost" label="预期成本" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="actual_cost" label="实际成本" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="成本差异详情 - 操作时间线"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={700}
      >
        {currentItem && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <p><strong>SKU编码：</strong>{currentItem.sku_code}</p>
            <p><strong>期间：</strong>{currentItem.period}</p>
            <p><strong>预期成本：</strong>¥{currentItem.expected_cost}</p>
            <p><strong>实际成本：</strong>¥{currentItem.actual_cost}</p>
            <p><strong>差异金额：</strong><span style={{ color: getVarianceColor(currentItem.variance), fontWeight: 'bold' }}>¥{currentItem.variance}</span></p>
            <p><strong>状态：</strong><Tag color={getStatusColor(currentItem.status)}>{getStatusText(currentItem.status)}</Tag></p>
            {currentItem.analysis && <p><strong>分析：</strong>{currentItem.analysis}</p>}
          </Card>
        )}
        <h4>操作记录时间线</h4>
        <Timeline>
          {logs.map((log, index) => (
            <Timeline.Item key={index}>
              <p><strong>{log.operator_name}</strong> - {log.operation_type}</p>
              {log.field_name && (
                <p>
                  {log.field_name}: {log.old_value || '-'} → {log.new_value || '-'}
                </p>
              )}
              <p style={{ color: '#999', fontSize: '12px' }}>{log.operation_time}</p>
              <p style={{ fontSize: '12px' }}>{log.notes}</p>
            </Timeline.Item>
          ))}
        </Timeline>
      </Modal>
    </div>
  );
}

export default CostVarianceList;