import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  DatePicker,
  Select,
  Tag,
  Modal,
  Descriptions,
  Card,
  message,
  Row,
  Col,
  Statistic,
  Tabs,
  List
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import operationService from '../services/operationService';
import dayjs from 'dayjs';
import { RangePicker } from 'antd/es/date-picker';

const { Option } = Select;
const { TabPane } = Tabs;

function Operations() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    startDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD')
  });

  const [selectedOperation, setSelectedOperation] = useState(null);
  const [replayModalVisible, setReplayModalVisible] = useState(false);
  const [replayData, setReplayData] = useState(null);
  const [replayLoading, setReplayLoading] = useState(false);

  const navigate = useNavigate();

  const loadData = async (page = 1, pageSize = 20) => {
    if (!filters.startDate || !filters.endDate) {
      return;
    }

    setLoading(true);
    try {
      const result = await operationService.getOperations({
        startDate: filters.startDate,
        endDate: filters.endDate,
        operationType: filters.operationType,
        status: filters.status,
        page,
        limit: pageSize
      });

      if (result.success) {
        setData(result.data.rows);
        setPagination({
          current: page,
          pageSize,
          total: result.data.pagination.total
        });
      }
    } catch (error) {
      message.error('加载操作日志失败');
    } finally {
      setLoading(false);
    }
  };

  const operationTypeMap = {
    CREATE: { color: 'green', label: '创建' },
    UPDATE: { color: 'blue', label: '更新' },
    ADJUST: { color: 'orange', label: '调整' },
    TRANSFER_IN: { color: 'cyan', label: '调入' },
    TRANSFER_OUT: { color: 'purple', label: '调出' },
    PRICE_CHANGE: { color: 'magenta', label: '改价' },
    SYNC: { color: 'geekblue', label: '同步' }
  };

  const statusMap = {
    SUCCESS: { color: 'green', label: '成功', icon: <CheckCircleOutlined /> },
    FAILED: { color: 'red', label: '失败', icon: <CloseCircleOutlined /> },
    PENDING: { color: 'orange', label: '处理中' },
    ROLLED_BACK: { color: 'gold', label: '已回滚' }
  };

  const columns = [
    {
      title: '序号',
      dataIndex: 'sequence',
      key: 'sequence',
      width: 80
    },
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      width: 100,
      render: (type) => {
        const info = operationTypeMap[type] || { color: 'default', label: type };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
      filters: Object.keys(operationTypeMap).map(key => ({
        text: operationTypeMap[key].label,
        value: key
      }))
    },
    {
      title: '商品',
      key: 'product',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.Inventory?.Product?.name || '-'}</span>
          <span style={{ color: '#888', fontSize: '12px' }}>
            {record.Inventory?.Store?.name || '-'}
          </span>
        </Space>
      )
    },
    {
      title: '变更前',
      key: 'before',
      render: (_, record) => {
        const before = record.beforeState;
        return (
          <Space direction="vertical" size={0}>
            <span>数量: {before?.quantity ?? '-'}</span>
            <span style={{ color: '#888', fontSize: '12px' }}>
              价格: {before?.price !== undefined ? `¥${Number(before.price).toFixed(2)}` : '-'}
            </span>
          </Space>
        );
      }
    },
    {
      title: '变更后',
      key: 'after',
      render: (_, record) => {
        const after = record.afterState;
        return (
          <Space direction="vertical" size={0}>
            <span>数量: {after?.quantity ?? '-'}</span>
            <span style={{ color: '#888', fontSize: '12px' }}>
              价格: {after?.price !== undefined ? `¥${Number(after.price).toFixed(2)}` : '-'}
            </span>
          </Space>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const info = statusMap[status] || { color: 'default', label: status };
        return (
          <Tag color={info.color}>
            {info.icon} {info.label}
          </Tag>
        );
      }
    },
    {
      title: '操作人',
      dataIndex: ['User', 'name'],
      key: 'operator',
      width: 100
    },
    {
      title: '操作时间',
      dataIndex: 'operationAt',
      key: 'operationAt',
      width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleReplay(record)}
          >
            回放
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/operations/${record.id}`)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  const handleReplay = async (record) => {
    setSelectedOperation(record);
    setReplayModalVisible(true);
    setReplayLoading(true);
    
    try {
      const result = await operationService.replayOperation(record.id);
      if (result.success) {
        setReplayData(result.data);
      }
    } catch (error) {
      message.error('加载回放数据失败');
    } finally {
      setReplayLoading(false);
    }
  };

  const handleTableChange = (pagination) => {
    loadData(pagination.current, pagination.pageSize);
  };

  const summary = {
    total: data.length,
    success: data.filter(d => d.status === 'SUCCESS').length,
    failed: data.filter(d => d.status === 'FAILED').length,
    pending: data.filter(d => d.status === 'PENDING').length
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>操作日志</span>
          </Space>
        }
        extra={
          <Space>
            <RangePicker
              defaultValue={[
                dayjs().subtract(7, 'day'),
                dayjs()
              ]}
              onChange={(dates) => {
                if (dates) {
                  setFilters({
                    ...filters,
                    startDate: dates[0].format('YYYY-MM-DD'),
                    endDate: dates[1].format('YYYY-MM-DD')
                  });
                }
              }}
            />
            <Select
              placeholder="操作类型"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, operationType: value })}
            >
              {Object.entries(operationTypeMap).map(([key, val]) => (
                <Option key={key} value={key}>{val.label}</Option>
              ))}
            </Select>
            <Select
              placeholder="状态"
              style={{ width: 100 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              {Object.entries(statusMap).map(([key, val]) => (
                <Option key={key} value={key}>{val.label}</Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => loadData(pagination.current, pagination.pageSize)}
              loading={loading}
            >
              查询
            </Button>
          </Space>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="总操作数" value={pagination.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="成功" value={summary.success} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="失败" value={summary.failed} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="处理中" value={summary.pending} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showTotal: (total) => `共 ${total} 条记录`,
            showSizeChanger: true
          }}
          onChange={handleTableChange}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <PlayCircleOutlined />
            <span>操作回放</span>
          </Space>
        }
        open={replayModalVisible}
        onCancel={() => setReplayModalVisible(false)}
        footer={null}
        width={800}
      >
        {replayLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : replayData ? (
          <div>
            <Tabs defaultActiveKey="1">
              <TabPane tab="操作信息" key="1">
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="操作类型">
                    {operationTypeMap[replayData.replayInfo.operationType]?.label || replayData.replayInfo.operationType}
                  </Descriptions.Item>
                  <Descriptions.Item label="操作状态">
                    {statusMap[replayData.replayInfo.status]?.label || replayData.replayInfo.status}
                  </Descriptions.Item>
                  <Descriptions.Item label="操作人" span={2}>
                    {replayData.replayInfo.operator}
                  </Descriptions.Item>
                  <Descriptions.Item label="操作时间" span={2}>
                    {dayjs(replayData.replayInfo.operationTime).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="请求ID" span={2}>
                    <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                      {replayData.log.requestId}
                    </code>
                  </Descriptions.Item>
                </Descriptions>
              </TabPane>

              <TabPane tab="状态对比" key="2">
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="变更前" size="small" style={{ background: '#fff7e6' }}>
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="库存数量">
                          {replayData.beforeState?.quantity ?? '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="价格">
                          {replayData.beforeState?.price !== undefined 
                            ? `¥${Number(replayData.beforeState.price).toFixed(2)}` 
                            : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="版本号">
                          {replayData.beforeState?.version ?? '-'}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="变更后" size="small" style={{ background: '#f6ffed' }}>
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="库存数量">
                          {replayData.afterState?.quantity ?? '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="价格">
                          {replayData.afterState?.price !== undefined 
                            ? `¥${Number(replayData.afterState.price).toFixed(2)}` 
                            : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="版本号">
                          {replayData.afterState?.version ?? '-'}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                </Row>
              </TabPane>

              <TabPane tab="变更详情" key="3">
                <Card size="small">
                  <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, overflow: 'auto' }}>
                    {JSON.stringify(replayData.changeDetails, null, 2)}
                  </pre>
                </Card>
              </TabPane>
            </Tabs>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
            暂无数据
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Operations;
