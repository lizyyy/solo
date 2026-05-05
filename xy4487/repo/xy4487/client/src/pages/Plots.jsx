import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Card,
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
import { plotAPI } from '../utils/api';

function Plots() {
  const [loading, setLoading] = useState(false);
  const [plots, setPlots] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingPlot, setEditingPlot] = useState(null);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [form] = Form.useForm();

  const loadPlots = async () => {
    setLoading(true);
    try {
      const response = await plotAPI.getAll();
      setPlots(response.data);
    } catch (error) {
      message.error('加载地块数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlots();
  }, []);

  const handleAdd = () => {
    setEditingPlot(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingPlot(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleView = (record) => {
    setSelectedPlot(record);
    setDetailVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await plotAPI.delete(id);
      message.success('删除成功');
      loadPlots();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingPlot) {
        await plotAPI.update(editingPlot.id, values);
        message.success('更新成功');
      } else {
        await plotAPI.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadPlots();
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    }
  };

  const columns = [
    {
      title: '农户姓名',
      dataIndex: 'farmer_name',
      key: 'farmer_name',
    },
    {
      title: '地块名称',
      dataIndex: 'plot_name',
      key: 'plot_name',
    },
    {
      title: '面积(亩)',
      dataIndex: 'area',
      key: 'area',
      render: (area) => <Tag color="blue">{area}</Tag>,
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: '作物类型',
      dataIndex: 'crop_type',
      key: 'crop_type',
      render: (type) => type ? <Tag>{type}</Tag> : '-',
    },
    {
      title: '预约数',
      dataIndex: 'reservation_count',
      key: 'reservation_count',
      render: (count) => count || 0,
    },
    {
      title: '总补贴(元)',
      dataIndex: 'total_subsidy',
      key: 'total_subsidy',
      render: (amount) => amount ? `¥${amount}` : '-',
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
          <Popconfirm title="确定要删除该地块吗？" onConfirm={() => handleDelete(record.id)}>
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
        <h2>地块管理</h2>
        <p>管理农户地块信息，包括面积、位置和作物类型</p>
      </div>

      <div className="action-bar">
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增地块
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadPlots}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={plots}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={editingPlot ? '编辑地块' : '新增地块'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="farmer_name"
            label="农户姓名"
            rules={[{ required: true, message: '请输入农户姓名' }]}
          >
            <Input placeholder="请输入农户姓名" />
          </Form.Item>
          <Form.Item
            name="plot_name"
            label="地块名称"
            rules={[{ required: true, message: '请输入地块名称' }]}
          >
            <Input placeholder="请输入地块名称" />
          </Form.Item>
          <Form.Item
            name="area"
            label="面积(亩)"
            rules={[{ required: true, message: '请输入地块面积' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入地块面积" />
          </Form.Item>
          <Form.Item name="location" label="位置">
            <Input placeholder="请输入地块位置" />
          </Form.Item>
          <Form.Item name="crop_type" label="作物类型">
            <Input placeholder="如：小麦、玉米、水稻等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="地块详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedPlot && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="农户姓名" span={2}>
              {selectedPlot.farmer_name}
            </Descriptions.Item>
            <Descriptions.Item label="地块名称">{selectedPlot.plot_name}</Descriptions.Item>
            <Descriptions.Item label="面积(亩)">{selectedPlot.area}</Descriptions.Item>
            <Descriptions.Item label="位置">{selectedPlot.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="作物类型">{selectedPlot.crop_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="预约次数">{selectedPlot.reservation_count || 0}</Descriptions.Item>
            <Descriptions.Item label="总补贴(元)">
              {selectedPlot.total_subsidy ? `¥${selectedPlot.total_subsidy}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {selectedPlot.created_at}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Spin>
  );
}

export default Plots;
