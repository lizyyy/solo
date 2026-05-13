import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, message, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { visitorAPI } from '../api';
import { VisitorRecord, VisitorStatus } from '../types';

const { Option } = Select;

const statusMap: Record<VisitorStatus, { text: string; color: string }> = {
  [VisitorStatus.PENDING_HOST_CONFIRM]: { text: '待被访人确认', color: 'orange' },
  [VisitorStatus.HOST_CONFIRMED]: { text: '被访人已确认', color: 'blue' },
  [VisitorStatus.HOST_REJECTED]: { text: '被访人拒绝', color: 'red' },
  [VisitorStatus.PLATE_ENTERED]: { text: '车牌已入园', color: 'green' },
  [VisitorStatus.PLATE_REJECTED]: { text: '车牌校验失败', color: 'red' },
  [VisitorStatus.QRCODE_SCANNED]: { text: '二维码已扫描', color: 'cyan' },
  [VisitorStatus.CHECKED_OUT]: { text: '已离园', color: 'purple' },
  [VisitorStatus.BLOCKED]: { text: '已拦截', color: 'red' },
  [VisitorStatus.MANUAL_REVIEW]: { text: '待人工复核', color: 'orange' },
  [VisitorStatus.COMPLETED]: { text: '已完成', color: 'green' },
};

function VisitorList() {
  const navigate = useNavigate();
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const data = await visitorAPI.getAll();
      setVisitors(data);
    } catch (error) {
      message.error('获取访客列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const handleCreateVisitor = async (values: any) => {
    try {
      await visitorAPI.create(
        {
          visitorName: values.visitorName,
          visitorPhone: values.visitorPhone,
          visitorIdCard: values.visitorIdCard,
          visitorPlate: values.visitorPlate,
          visitorCompany: values.visitorCompany,
          hostName: values.hostName,
          hostPhone: values.hostPhone,
          hostDepartment: values.hostDepartment,
          visitReason: values.visitReason,
          expectedVisitDate: values.expectedVisitDate.format('YYYY-MM-DD'),
          expectedVisitTime: values.expectedVisitTime.format('HH:mm:ss'),
        },
        'admin',
        '管理员'
      );
      message.success('创建访客预约成功');
      setIsModalVisible(false);
      form.resetFields();
      fetchVisitors();
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const columns = [
    {
      title: '访客姓名',
      dataIndex: 'visitorName',
      key: 'visitorName',
    },
    {
      title: '访客手机号',
      dataIndex: 'visitorPhone',
      key: 'visitorPhone',
    },
    {
      title: '车牌号',
      dataIndex: 'visitorPlate',
      key: 'visitorPlate',
    },
    {
      title: '被访人',
      dataIndex: 'hostName',
      key: 'hostName',
    },
    {
      title: '被访部门',
      dataIndex: 'hostDepartment',
      key: 'hostDepartment',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: VisitorStatus) => {
        const { text, color } = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '预约日期',
      dataIndex: 'expectedVisitDate',
      key: 'expectedVisitDate',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: VisitorRecord) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/visitor/${record.id}`)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>访客列表</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
          新建访客预约
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={visitors}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="新建访客预约"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateVisitor}>
          <Form.Item
            label="访客姓名"
            name="visitorName"
            rules={[{ required: true, message: '请输入访客姓名' }]}
          >
            <Input placeholder="请输入访客姓名" />
          </Form.Item>
          <Form.Item
            label="访客手机号"
            name="visitorPhone"
            rules={[{ required: true, message: '请输入访客手机号' }]}
          >
            <Input placeholder="请输入访客手机号" />
          </Form.Item>
          <Form.Item
            label="访客身份证号"
            name="visitorIdCard"
          >
            <Input placeholder="请输入访客身份证号" />
          </Form.Item>
          <Form.Item
            label="车牌号"
            name="visitorPlate"
          >
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <Form.Item
            label="访客单位"
            name="visitorCompany"
          >
            <Input placeholder="请输入访客单位" />
          </Form.Item>
          <Form.Item
            label="被访人姓名"
            name="hostName"
            rules={[{ required: true, message: '请输入被访人姓名' }]}
          >
            <Input placeholder="请输入被访人姓名" />
          </Form.Item>
          <Form.Item
            label="被访人手机号"
            name="hostPhone"
            rules={[{ required: true, message: '请输入被访人手机号' }]}
          >
            <Input placeholder="请输入被访人手机号" />
          </Form.Item>
          <Form.Item
            label="被访部门"
            name="hostDepartment"
            rules={[{ required: true, message: '请输入被访部门' }]}
          >
            <Input placeholder="请输入被访部门" />
          </Form.Item>
          <Form.Item
            label="来访事由"
            name="visitReason"
            rules={[{ required: true, message: '请输入来访事由' }]}
          >
            <Input.TextArea placeholder="请输入来访事由" rows={3} />
          </Form.Item>
          <Form.Item
            label="预约来访日期"
            name="expectedVisitDate"
            rules={[{ required: true, message: '请选择预约来访日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="预约来访时间"
            name="expectedVisitTime"
            rules={[{ required: true, message: '请选择预约来访时间' }]}
          >
            <DatePicker.TimePicker style={{ width: '100%' }} format="HH:mm:ss" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default VisitorList;
