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
  DatePicker,
  Select,
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
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { machineAPI } from '../utils/api';
import dayjs from 'dayjs';

function Machines() {
  const [loading, setLoading] = useState(false);
  const [machines, setMachines] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [form] = Form.useForm();

  const loadMachines = async () => {
    setLoading(true);
    try {
      const response = await machineAPI.getAll();
      setMachines(response.data);
    } catch (error) {
      message.error('加载机具数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  const handleAdd = () => {
    setEditingMachine(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingMachine(record);
    const values = { ...record };
    if (values.last_maintenance) {
      values.last_maintenance = dayjs(values.last_maintenance);
    }
    form.setFieldsValue(values);
    setModalVisible(true);
  };

  const handleView = (record) => {
    setSelectedMachine(record);
    setDetailVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await machineAPI.delete(id);
      message.success('删除成功');
      loadMachines();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData = { ...values };
      if (submitData.last_maintenance) {
        submitData.last_maintenance = submitData.last_maintenance.format('YYYY-MM-DD');
      }
      
      if (editingMachine) {
        await machineAPI.update(editingMachine.id, submitData);
        message.success('更新成功');
      } else {
        await machineAPI.create(submitData);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadMachines();
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    }
  };

  const getStatusTag = (record) => {
    if (record.maintenance_overdue) {
      return <Tag icon={<ExclamationCircleOutlined />} color="red">保养逾期</Tag>;
    } else if (record.maintenance_warning) {
      return <Tag icon={<WarningOutlined />} color="orange">保养即将逾期</Tag>;
    }
    return <Tag icon={<CheckCircleOutlined />} color="green">正常</Tag>;
  };

  const columns = [
    {
      title: '机具名称',
      dataIndex: 'machine_name',
      key: 'machine_name',
    },
    {
      title: '机具类型',
      dataIndex: 'machine_type',
      key: 'machine_type',
      render: (type) => type || '-',
    },
    {
      title: '车牌号',
      dataIndex: 'license_plate',
      key: 'license_plate',
      render: (plate) => plate || '-',
    },
    {
      title: '上次保养',
      dataIndex: 'last_maintenance',
      key: 'last_maintenance',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '保养间隔(天)',
      dataIndex: 'maintenance_interval_days',
      key: 'maintenance_interval_days',
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => getStatusTag(record),
    },
    {
      title: '预约数',
      dataIndex: 'reservation_count',
      key: 'reservation_count',
      render: (count) => count || 0,
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
          <Popconfirm title="确定要删除该机具吗？" onConfirm={() => handleDelete(record.id)}>
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
        <h2>机具管理</h2>
        <p>管理农机信息，包括保养记录和状态监控</p>
      </div>

      <div className="action-bar">
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增机具
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadMachines}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={machines}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={editingMachine ? '编辑机具' : '新增机具'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="machine_name"
            label="机具名称"
            rules={[{ required: true, message: '请输入机具名称' }]}
          >
            <Input placeholder="如：东方红-1、久保田-1 等" />
          </Form.Item>
          <Form.Item name="machine_type" label="机具类型">
            <Select placeholder="请选择机具类型" allowClear>
              <Select.Option value="拖拉机">拖拉机</Select.Option>
              <Select.Option value="收割机">收割机</Select.Option>
              <Select.Option value="播种机">播种机</Select.Option>
              <Select.Option value="插秧机">插秧机</Select.Option>
              <Select.Option value="无人机">无人机</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="license_plate" label="车牌号">
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <Form.Item name="last_maintenance" label="上次保养日期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择上次保养日期" />
          </Form.Item>
          <Form.Item name="maintenance_interval_days" label="保养间隔(天)" initialValue={90}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="默认90天" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select>
              <Select.Option value="active">正常使用</Select.Option>
              <Select.Option value="maintenance">保养中</Select.Option>
              <Select.Option value="repair">维修中</Select.Option>
              <Select.Option value="inactive">停用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="机具详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedMachine && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="机具名称" span={2}>
              {selectedMachine.machine_name}
            </Descriptions.Item>
            <Descriptions.Item label="机具类型">
              {selectedMachine.machine_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="车牌号">
              {selectedMachine.license_plate || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="上次保养日期">
              {selectedMachine.last_maintenance 
                ? dayjs(selectedMachine.last_maintenance).format('YYYY-MM-DD') 
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="保养间隔">
              {selectedMachine.maintenance_interval_days} 天
            </Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>
              {getStatusTag(selectedMachine)}
            </Descriptions.Item>
            <Descriptions.Item label="预约次数">
              {selectedMachine.reservation_count || 0}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {selectedMachine.created_at}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Spin>
  );
}

export default Machines;
