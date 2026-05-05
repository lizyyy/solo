import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  DatePicker,
  InputNumber,
  message,
  Popconfirm,
  Descriptions,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { subsidyAPI, plotAPI, reservationAPI } from '../utils/api';
import dayjs from 'dayjs';

function Subsidies() {
  const [loading, setLoading] = useState(false);
  const [subsidies, setSubsidies] = useState([]);
  const [plots, setPlots] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingSubsidy, setEditingSubsidy] = useState(null);
  const [selectedSubsidy, setSelectedSubsidy] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, plotsRes, resRes] = await Promise.all([
        subsidyAPI.getAll(),
        plotAPI.getAll(),
        reservationAPI.getAll(),
      ]);
      setSubsidies(subRes.data);
      setPlots(plotsRes.data);
      setReservations(resRes.data);
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    setEditingSubsidy(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingSubsidy(record);
    const values = { ...record };
    if (values.subsidy_date) {
      values.subsidy_date = dayjs(values.subsidy_date);
    }
    form.setFieldsValue(values);
    setModalVisible(true);
  };

  const handleView = async (record) => {
    try {
      const res = await subsidyAPI.getById(record.id);
      setSelectedSubsidy(res.data);
      setDetailVisible(true);
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await subsidyAPI.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData = { ...values };
      if (submitData.subsidy_date) {
        submitData.subsidy_date = submitData.subsidy_date.format('YYYY-MM-DD');
      }
      
      if (editingSubsidy) {
        await subsidyAPI.update(editingSubsidy.id, submitData);
        message.success('更新成功');
      } else {
        await subsidyAPI.create(submitData);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    }
  };

  const columns = [
    {
      title: '农户',
      dataIndex: 'farmer_name',
      key: 'farmer_name',
    },
    {
      title: '地块',
      dataIndex: 'plot_name',
      key: 'plot_name',
    },
    {
      title: '补贴金额(元)',
      dataIndex: 'subsidy_amount',
      key: 'subsidy_amount',
      render: (amount) => <Tag color="green">¥{amount}</Tag>,
    },
    {
      title: '油耗(L)',
      dataIndex: 'fuel_consumption',
      key: 'fuel_consumption',
      render: (fuel) => fuel || '-',
    },
    {
      title: '补贴日期',
      dataIndex: 'subsidy_date',
      key: 'subsidy_date',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'approved' ? 'green' : status === 'pending' ? 'orange' : 'red'}>
          {status === 'approved' ? '已审批' : status === 'pending' ? '待审批' : '已拒绝'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleView(record)}>
            详情
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定要删除该补贴记录吗？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="page-header">
        <h2>油料补贴管理</h2>
        <p>管理油料补贴记录，关联地块和作业预约</p>
      </div>

      <div className="action-bar">
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增补贴
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadData}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={subsidies}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={editingSubsidy ? '编辑补贴' : '新增补贴'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="plot_id"
            label="选择地块"
            rules={[{ required: true, message: '请选择地块' }]}
          >
            <Select placeholder="请选择地块" showSearch optionFilterProp="children">
              {plots.map((p) => (
                <Select.Option key={p.id} value={p.id}>
                  {p.farmer_name} - {p.plot_name} ({p.area}亩)
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="reservation_id" label="关联预约">
            <Select placeholder="请选择关联的预约（可选）" showSearch optionFilterProp="children" allowClear>
              {reservations.map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {r.plot_name} - {r.machine_name} ({dayjs(r.start_time).format('MM-DD HH:mm')})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="subsidy_amount"
            label="补贴金额(元)"
            rules={[{ required: true, message: '请输入补贴金额' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入补贴金额" />
          </Form.Item>
          <Form.Item name="fuel_consumption" label="油耗(L)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入预计油耗" />
          </Form.Item>
          <Form.Item name="subsidy_date" label="补贴日期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择补贴日期" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="pending">
            <Select>
              <Select.Option value="pending">待审批</Select.Option>
              <Select.Option value="approved">已审批</Select.Option>
              <Select.Option value="rejected">已拒绝</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="补贴详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedSubsidy && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="农户" span={2}>
              {selectedSubsidy.farmer_name}
            </Descriptions.Item>
            <Descriptions.Item label="地块">{selectedSubsidy.plot_name}</Descriptions.Item>
            <Descriptions.Item label="面积">{selectedSubsidy.plot_area} 亩</Descriptions.Item>
            <Descriptions.Item label="补贴金额">
              <Tag color="green">¥{selectedSubsidy.subsidy_amount}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="油耗">
              {selectedSubsidy.fuel_consumption ? `${selectedSubsidy.fuel_consumption} L` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="单位补贴">
              {selectedSubsidy.plot_area 
                ? `¥${(selectedSubsidy.subsidy_amount / selectedSubsidy.plot_area).toFixed(2)}/亩` 
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="补贴日期">
              {selectedSubsidy.subsidy_date 
                ? dayjs(selectedSubsidy.subsidy_date).format('YYYY-MM-DD') 
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedSubsidy.status === 'approved' ? 'green' : selectedSubsidy.status === 'pending' ? 'orange' : 'red'}>
                {selectedSubsidy.status === 'approved' ? '已审批' : selectedSubsidy.status === 'pending' ? '待审批' : '已拒绝'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {selectedSubsidy.created_at}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Spin>
  );
}

export default Subsidies;
