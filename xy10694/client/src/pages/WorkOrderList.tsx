import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Card, Form, Input, Select, Modal, message } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { workOrderAPI, masterDataAPI } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

const statusMap: { [key: string]: { text: string; color: string } } = {
  pending: { text: '待处理', color: 'default' },
  assigned: { text: '已分派', color: 'blue' },
  processing: { text: '处理中', color: 'orange' },
  reviewing: { text: '复核中', color: 'purple' },
  completed: { text: '已完成', color: 'green' },
  rejected: { text: '已拒绝', color: 'red' },
  blocked: { text: '已拦截', color: 'red' }
};

const sceneMap: { [key: string]: { text: string; color: string } } = {
  normal: { text: '正常流程', color: 'green' },
  blocked: { text: '规则拦截', color: 'red' },
  review: { text: '人工复核', color: 'orange' },
  duplicate: { text: '重复提交', color: 'purple' }
};

const WorkOrderList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [problemTypes, setProblemTypes] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
    fetchProblemTypes();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await workOrderAPI.list();
      setData(res.data.list || []);
    } catch (error) {
      message.error('获取工单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchProblemTypes = async () => {
    try {
      const res = await masterDataAPI.getProblemTypes();
      setProblemTypes(res.data);
    } catch (error) {
      console.error('获取问题类型失败', error);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      const res = await workOrderAPI.create({
        ...values,
        operatorId: 'user-001',
        operatorName: '当前用户'
      });

      if (res.data.success) {
        message.success(`工单创建成功！场景: ${sceneMap[res.data.scene]?.text || res.data.scene}`);
        setModalVisible(false);
        form.resetFields();
        fetchData();
      } else {
        message.error(`创建失败: ${res.data.reason || '未知错误'}`);
      }
    } catch (error: any) {
      message.error('创建工单失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const columns = [
    { title: '工单编号', dataIndex: 'orderNo', key: 'orderNo', width: 140 },
    { title: '问题类型', dataIndex: 'problemTypeId', key: 'problemTypeId', width: 120,
      render: (id: string) => problemTypes.find(t => t.id === id)?.name || id
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => {
        const info = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    { title: '场景', dataIndex: 'scene', key: 'scene', width: 100,
      render: (scene: string) => {
        const info = sceneMap[scene] || { text: scene, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    },
    { title: '操作', key: 'actions', width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/order/${record.id}`)}>
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card title="工单列表" extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新建工单
        </Button>
      }>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="新建报事工单"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="residentName" label="居民姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入居民姓名" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话" rules={[{ required: true }]}>
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="province" label="省份" rules={[{ required: true }]}>
            <Input placeholder="请输入省份" />
          </Form.Item>
          <Form.Item name="city" label="城市" rules={[{ required: true }]}>
            <Input placeholder="请输入城市" />
          </Form.Item>
          <Form.Item name="district" label="区县" rules={[{ required: true }]}>
            <Input placeholder="请输入区县" />
          </Form.Item>
          <Form.Item name="street" label="街道" rules={[{ required: true }]}>
            <Input placeholder="请输入街道" />
          </Form.Item>
          <Form.Item name="community" label="社区" rules={[{ required: true }]}>
            <Input placeholder="请输入社区" />
          </Form.Item>
          <Form.Item name="building" label="楼号">
            <Input placeholder="请输入楼号" />
          </Form.Item>
          <Form.Item name="unit" label="单元号">
            <Input placeholder="请输入单元号" />
          </Form.Item>
          <Form.Item name="room" label="房间号">
            <Input placeholder="请输入房间号" />
          </Form.Item>
          <Form.Item name="gridCode" label="网格编码" rules={[{ required: true }]}>
            <Input placeholder="请输入网格编码，如: GRID-001" />
          </Form.Item>
          <Form.Item name="problemTypeId" label="问题类型" rules={[{ required: true }]}>
            <Select placeholder="请选择问题类型">
              {problemTypes.map(type => (
                <Option key={type.id} value={type.id}>{type.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="问题描述" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="请详细描述问题" />
          </Form.Item>
          <Form.Item name="isUrgent" label="是否紧急">
            <Select>
              <Option value={false}>否</Option>
              <Option value={true}>是</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              提交报事
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkOrderList;
