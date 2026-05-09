import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Spin,
  Statistic,
  Row,
  Col,
  Select,
} from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Appeal } from '../types';
import {
  getAppeals,
  handleAppeal,
  exportAppeals,
} from '../services/api';
import {
  formatMoney,
  formatDateTime,
  getAppealStatusTag,
  getAppealTypeTag,
  getReceiptStatusTag,
} from '../utils';

const { Option } = Select;
const { TextArea } = Input;

const Appeals: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Appeal[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [currentAppeal, setCurrentAppeal] = useState<Appeal | null>(null);
  const [handleLoading, setHandleLoading] = useState(false);
  const [handleForm] = Form.useForm();
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getAppeals({
        status: filterStatus,
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      if (response.success) {
        setData(response.data);
        if (response.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: response.pagination!.total,
          }));
        }
      }
    } catch (error) {
      message.error('加载申诉列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (record: Appeal) => {
    setCurrentAppeal(record);
    handleForm.setFieldsValue({
      status: 'resolved',
      approve: true,
    });
    setHandleModalVisible(true);
  };

  const handleReject = (record: Appeal) => {
    setCurrentAppeal(record);
    handleForm.setFieldsValue({
      status: 'rejected',
      approve: false,
    });
    setHandleModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      setHandleLoading(true);
      const response = await handleAppeal(currentAppeal!.id, {
        status: values.status,
        handler: '管理员',
        handle_result: values.handle_result,
        approve: values.approve,
      });
      if (response.success) {
        message.success('申诉处理完成');
        setHandleModalVisible(false);
        handleForm.resetFields();
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '处理失败');
    } finally {
      setHandleLoading(false);
    }
  };

  const handleExport = () => {
    exportAppeals({ status: filterStatus });
    message.success('正在导出Excel...');
  };

  const pendingCount = data.filter((item) => item.status === 'pending').length;
  const resolvedCount = data.filter((item) => item.status === 'resolved').length;
  const rejectedCount = data.filter((item) => item.status === 'rejected').length;

  const columns = [
    {
      title: '申诉人',
      dataIndex: 'appellant',
      key: 'appellant',
    },
    {
      title: '员工',
      dataIndex: 'employee_name',
      key: 'employee_name',
    },
    {
      title: '小票编号',
      dataIndex: 'receipt_no',
      key: 'receipt_no',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: formatMoney,
    },
    {
      title: '申诉类型',
      dataIndex: 'appeal_type',
      key: 'appeal_type',
      render: (type: string) => {
        const tag = getAppealTypeTag(type);
        return <Tag color={tag.color}>{tag.text}</Tag>;
      },
    },
    {
      title: '申诉原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const tag = getAppealStatusTag(status as any);
        return <Tag color={tag.color}>{tag.text}</Tag>;
      },
    },
    {
      title: '申诉时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDateTime,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Appeal) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/appeals/${record.id}`)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record)}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReject(record)}
              >
                驳回
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  if (loading && data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>异常申诉</h2>
        <p>处理员工对小票审核结果的申诉请求</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={8} sm={8} md={6}>
          <Card className="stats-card">
            <Statistic
              title="待处理申诉"
              value={pendingCount}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={8} sm={8} md={6}>
          <Card className="stats-card">
            <Statistic
              title="已解决"
              value={resolvedCount}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={8} sm={8} md={6}>
          <Card className="stats-card">
            <Statistic
              title="已驳回"
              value={rejectedCount}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={24} md={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Select
                placeholder="筛选状态"
                style={{ width: '100%' }}
                allowClear
                value={filterStatus}
                onChange={(value) => {
                  setFilterStatus(value);
                  setPagination((prev) => ({ ...prev, current: 1 }));
                }}
              >
                <Option value="pending">待处理</Option>
                <Option value="resolved">已解决</Option>
                <Option value="rejected">已驳回</Option>
              </Select>
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title="申诉列表"
        extra={
          <Button onClick={handleExport}>导出Excel</Button>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
          locale={{
            emptyText: '暂无申诉记录',
          }}
        />
      </Card>

      <Modal
        title="处理申诉"
        open={handleModalVisible}
        onCancel={() => setHandleModalVisible(false)}
        footer={null}
        width={600}
      >
        {currentAppeal && (
          <div style={{ marginBottom: 24 }}>
            <Card size="small" title="申诉信息">
              <p><strong>申诉人：</strong>{currentAppeal.appellant}</p>
              <p><strong>员工：</strong>{currentAppeal.employee_name}</p>
              <p><strong>小票编号：</strong>{currentAppeal.receipt_no}</p>
              <p><strong>金额：</strong>{formatMoney(currentAppeal.amount || 0)}</p>
              <p><strong>申诉类型：</strong>
                <Tag color={getAppealTypeTag(currentAppeal.appeal_type).color}>
                  {getAppealTypeTag(currentAppeal.appeal_type).text}
                </Tag>
              </p>
              <p><strong>申诉原因：</strong>{currentAppeal.reason}</p>
            </Card>
          </div>
        )}

        <Form form={handleForm} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="approve"
            label="处理方式"
            rules={[{ required: true, message: '请选择处理方式' }]}
          >
            <Select placeholder="请选择处理方式">
              <Option value={true}>通过申诉（恢复小票状态为已通过）</Option>
              <Option value={false}>驳回申诉（维持原状态）</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="handle_result"
            label="处理结果说明"
            rules={[{ required: true, message: '请输入处理结果说明' }]}
          >
            <TextArea rows={4} placeholder="请输入处理结果说明" />
          </Form.Item>
          <Form.Item name="status" hidden>
            <Input />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setHandleModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={handleLoading}>
                确认处理
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Appeals;
