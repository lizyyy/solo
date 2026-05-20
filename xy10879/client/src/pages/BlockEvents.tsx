import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Descriptions,
  message,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import {
  EyeOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { riskApi } from '../services/api';
import { BlockEvent, EventStatus, RiskLevel } from '../types';
import moment from 'moment';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const BlockEvents: React.FC = () => {
  const [events, setEvents] = useState<BlockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<BlockEvent | null>(null);

  const [allowModalVisible, setAllowModalVisible] = useState(false);
  const [compensateModalVisible, setCompensateModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchEvents();
  }, [page, pageSize, statusFilter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await riskApi.getBlockEvents({ page, pageSize, status: statusFilter });
      if (response.data.success) {
        setEvents(response.data.data!.items);
        setTotal(response.data.data!.total);
      }
    } catch (err: any) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.CRITICAL:
      case RiskLevel.HIGH:
        return 'red';
      case RiskLevel.MEDIUM:
        return 'orange';
      default:
        return 'green';
    }
  };

  const getStatusTag = (status: EventStatus) => {
    const statusMap: Record<EventStatus, { color: string; text: string }> = {
      [EventStatus.BLOCKED]: { color: 'red', text: '已拦截' },
      [EventStatus.MANUAL_ALLOWED]: { color: 'green', text: '人工放行' },
      [EventStatus.COMPENSATED]: { color: 'blue', text: '已补偿' },
      [EventStatus.ALLOWED]: { color: 'green', text: '已放行' },
      [EventStatus.PENDING]: { color: 'orange', text: '待处理' },
    };
    const info = statusMap[status] || statusMap[EventStatus.PENDING];
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const handleViewDetail = (event: BlockEvent) => {
    setSelectedEvent(event);
    setDetailModalVisible(true);
  };

  const handleManualAllow = (event: BlockEvent) => {
    setSelectedEvent(event);
    form.setFieldsValue({ note: '' });
    setAllowModalVisible(true);
  };

  const handleCompensate = (event: BlockEvent) => {
    setSelectedEvent(event);
    form.setFieldsValue({ note: '' });
    setCompensateModalVisible(true);
  };

  const submitManualAllow = async () => {
    if (!selectedEvent) return;
    try {
      setActionLoading(true);
      const values = await form.validateFields();
      const response = await riskApi.manualAllow(selectedEvent.id, {
        approvedBy: 'admin',
        note: values.note,
      });
      if (response.data.success) {
        message.success('人工放行成功');
        setAllowModalVisible(false);
        fetchEvents();
      }
    } catch (err: any) {
      message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const submitCompensate = async () => {
    if (!selectedEvent) return;
    try {
      setActionLoading(true);
      const values = await form.validateFields();
      const response = await riskApi.compensate(selectedEvent.id, {
        compensatedBy: 'admin',
        note: values.note,
      });
      if (response.data.success) {
        message.success('补偿成功');
        setCompensateModalVisible(false);
        fetchEvents();
      }
    } catch (err: any) {
      message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await riskApi.exportBlockEvents();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `block-events-${moment().format('YYYYMMDDHHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('导出成功');
    } catch (err: any) {
      message.error('导出失败');
    }
  };

  const columns: TableProps<BlockEvent>['columns'] = [
    {
      title: '优惠码',
      dataIndex: 'promo_code',
      key: 'promo_code',
      width: 120,
      render: (code: string) => <code style={{ background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>{code}</code>,
    },
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
    },
    {
      title: '风险评分',
      dataIndex: 'risk_score',
      key: 'risk_score',
      width: 100,
      sorter: (a, b) => a.risk_score - b.risk_score,
      render: (score: number) => (
        <span style={{ color: score >= 60 ? '#ff4d4f' : score >= 30 ? '#fa8c16' : '#52c41a', fontWeight: 'bold' }}>
          {score}
        </span>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (level: RiskLevel) => <Tag color={getRiskLevelColor(level)}>{level.toUpperCase()}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '已拦截', value: EventStatus.BLOCKED },
        { text: '人工放行', value: EventStatus.MANUAL_ALLOWED },
        { text: '已补偿', value: EventStatus.COMPENSATED },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: EventStatus) => getStatusTag(status),
    },
    {
      title: '拦截原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (time: string) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            size="small"
          >
            详情
          </Button>
          {record.status === EventStatus.BLOCKED && (
            <>
              <Button
                type="link"
                icon={<CheckCircleOutlined />}
                onClick={() => handleManualAllow(record)}
                size="small"
                style={{ color: '#52c41a' }}
              >
                放行
              </Button>
              <Button
                type="link"
                icon={<PlusOutlined />}
                onClick={() => handleCompensate(record)}
                size="small"
                style={{ color: '#1890ff' }}
              >
                补偿
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>拦截事件管理</Title>
        <Space>
          <Select
            style={{ width: 120 }}
            placeholder="筛选状态"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Option value={EventStatus.BLOCKED}>已拦截</Option>
            <Option value={EventStatus.MANUAL_ALLOWED}>人工放行</Option>
            <Option value={EventStatus.COMPENSATED}>已补偿</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchEvents}>刷新</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出数据
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={events}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
        }}
        scroll={{ x: 1400 }}
      />

      <Modal
        title="拦截事件详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>,
        ]}
        width={700}
      >
        {selectedEvent && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="事件ID">{selectedEvent.id}</Descriptions.Item>
            <Descriptions.Item label="优惠码">
              <code style={{ background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>
                {selectedEvent.promo_code}
              </code>
            </Descriptions.Item>
            <Descriptions.Item label="设备ID">{selectedEvent.device_id}</Descriptions.Item>
            <Descriptions.Item label="用户ID">{selectedEvent.user_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="IP地址">{selectedEvent.ip_address}</Descriptions.Item>
            <Descriptions.Item label="风险评分">
              <span style={{
                color: selectedEvent.risk_score >= 60 ? '#ff4d4f' : selectedEvent.risk_score >= 30 ? '#fa8c16' : '#52c41a',
                fontWeight: 'bold',
              }}>
                {selectedEvent.risk_score}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="风险等级">
              <Tag color={getRiskLevelColor(selectedEvent.risk_level)}>
                {selectedEvent.risk_level.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="触发规则">
              {selectedEvent.triggeredRules?.map((rule, idx) => (
                <Tag key={idx} color="blue">{rule}</Tag>
              ))}
            </Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(selectedEvent.status)}</Descriptions.Item>
            <Descriptions.Item label="拦截原因">{selectedEvent.reason}</Descriptions.Item>
            {selectedEvent.compensated_note && (
              <Descriptions.Item label="处理备注">{selectedEvent.compensated_note}</Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">
              {moment(selectedEvent.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            {selectedEvent.compensated_at && (
              <Descriptions.Item label="处理时间">
                {moment(selectedEvent.compensated_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      <Modal
        title="人工放行"
        open={allowModalVisible}
        onCancel={() => setAllowModalVisible(false)}
        onOk={submitManualAllow}
        confirmLoading={actionLoading}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="note"
            label="放行备注"
            rules={[{ required: true, message: '请输入放行备注' }]}
          >
            <TextArea rows={4} placeholder="请输入放行原因，用于记录" />
          </Form.Item>
        </Form>
        <div style={{ color: '#666', fontSize: 12 }}>
          注意：人工放行后，该优惠码将被标记为放行状态，系统会记录操作人。
        </div>
      </Modal>

      <Modal
        title="补偿处理"
        open={compensateModalVisible}
        onCancel={() => setCompensateModalVisible(false)}
        onOk={submitCompensate}
        confirmLoading={actionLoading}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="note"
            label="补偿备注"
            rules={[{ required: true, message: '请输入补偿备注' }]}
          >
            <TextArea rows={4} placeholder="请输入补偿原因和处理方式" />
          </Form.Item>
        </Form>
        <div style={{ color: '#666', fontSize: 12 }}>
          注意：补偿后，该事件将被标记为已补偿状态，用于后续统计和审计。
        </div>
      </Modal>
    </div>
  );
};

export default BlockEvents;
