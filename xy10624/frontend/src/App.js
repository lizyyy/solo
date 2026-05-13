import React, { useState } from 'react';
import { Layout, Menu, Typography, DatePicker, Input, Select, Button, Space, Card, Table, Tag, Timeline, Descriptions, Modal, message } from 'antd';
import { DownloadOutlined, FileTextOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const App = () => {
  const [activeKey, setActiveKey] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [timelineData, setTimelineData] = useState([]);
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    operator: '',
    module: ''
  });

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate.format('YYYY-MM-DD');
      if (filters.endDate) params.endDate = filters.endDate.format('YYYY-MM-DD');
      if (filters.operator) params.operator = filters.operator;
      if (filters.module) params.module = filters.module;

      const res = await axios.get('/api/operation-logs', { params });
      if (res.data.success) {
        setLogs(res.data.list);
      }
    } catch (error) {
      message.error('加载日志失败');
    } finally {
      setLogsLoading(false);
    }
  };

  const showTimeline = async (module, recordId) => {
    setTimelineLoading(true);
    setTimelineVisible(true);
    try {
      const res = await axios.get(`/api/timeline/${module}/${recordId}`);
      if (res.data.success) {
        setTimelineData(res.data.data);
      }
    } catch (error) {
      message.error('加载时间线失败');
    } finally {
      setTimelineLoading(false);
    }
  };

  const exportDamageSeizures = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate.format('YYYY-MM-DD'));
    if (filters.endDate) params.append('endDate', filters.endDate.format('YYYY-MM-DD'));
    if (filters.operator) params.append('handled_by', filters.operator);
    
    window.open(`/api/export/damage-seizures?${params.toString()}`);
    message.success('导出破损扣押记录导出中...');
  };

  const exportBalances = () => {
    window.open('/api/export/balances');
    message.success('导出欠桶余额导出中...');
  };

  const exportLogs = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate.format('YYYY-MM-DD'));
    if (filters.endDate) params.append('endDate', filters.endDate.format('YYYY-MM-DD'));
    if (filters.operator) params.append('operator', filters.operator);
    
    window.open(`/api/export/operation-logs?${params.toString()}`);
    message.success('导出操作日志导出中...');
  };

  const logColumns = [
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      key: 'operation_type',
      width: 100,
      render: (type) => {
        const colorMap = {
          'CREATE': 'green',
          'UPDATE': 'blue',
          'REVIEW': 'purple',
          'DELETE': 'red'
        };
        const textMap = {
          'CREATE': '创建',
          'UPDATE': '更新',
          'REVIEW': '审核',
          'DELETE': '删除'
        };
        return <Tag color={colorMap[type]}>{textMap[type] || type}</Tag>;
      }
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 120,
      render: (module) => {
        const moduleMap = {
          'customer_addresses': '客户地址',
          'delivery_signoffs': '配送签收',
          'bucket_returns': '退桶验收',
          'damage_seizures': '破损扣押',
          'bucket_balances': '欠桶余额'
        };
        return moduleMap[module] || module;
      }
    },
    {
      title: '记录编号',
      dataIndex: 'record_no',
      key: 'record_no',
      width: 150,
      render: (text, record) => text || record.record_id
    },
    {
      title: '操作人',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 120
    },
    {
      title: '备注',
      dataIndex: 'operation_remark',
      key: 'operation_remark',
      ellipsis: true
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" onClick={() => showTimeline(record.module, record.record_id)}>
          查看详情
        </Button>
      )
    }
  ];

  const menuItems = [
    {
      key: 'export',
      icon: <DownloadOutlined />,
      label: '数据导出'
    },
    {
      key: 'logs',
      icon: <FileTextOutlined />,
      label: '操作日志'
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', margin: 0, lineHeight: '64px' }}>
          桶装水押桶月结系统
        </Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            onSelect={({ key }) => setActiveKey(key)}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
            {activeKey === 'export' && (
              <div>
                <Title level={4}>数据导出</Title>
                <Card title="筛选条件" style={{ marginBottom: 24 }}>
                  <Space wrap size="large">
                    <RangePicker
                        style={{ width: 300 }}
                        value={[filters.startDate, filters.endDate]}
                        onChange={(dates) => setFilters({
                          ...filters,
                          startDate: dates?.[0],
                          endDate: dates?.[1]
                        })}
                      />
                      <Input
                        placeholder="操作人ID"
                        style={{ width: 200 }}
                        value={filters.operator}
                        onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
                      />
                      <Select
                        placeholder="选择模块"
                        style={{ width: 150 }}
                        value={filters.module}
                        onChange={(value) => setFilters({ ...filters, module: value })}
                        allowClear
                      >
                        <Option value="customer_addresses">客户地址</Option>
                        <Option value="delivery_signoffs">配送签收</Option>
                        <Option value="bucket_returns">退桶验收</Option>
                        <Option value="damage_seizures">破损扣押</Option>
                        <Option value="bucket_balances">欠桶余额</Option>
                      </Select>
                    </Space>
                  </Card>

                  <Card title="导出功能">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button type="primary" icon={<DownloadOutlined />} onClick={exportDamageSeizures}>
                        导出破损扣押记录
                      </Button>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        包含：扣押编号、桶编号、客户信息、破损类型、赔偿金额、处理人、修改记录等完整信息，
                        可按责任人和时间范围筛选
                      </div>
                      
                      <Button type="primary" icon={<DownloadOutlined />} onClick={exportBalances}>
                        导出欠桶余额报表
                      </Button>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        包含：客户ID、客户名称、总借桶数、总还桶数、破损数、扣押数、欠桶数、欠桶余额等
                      </div>
                      
                      <Button type="primary" icon={<DownloadOutlined />} onClick={exportLogs}>
                        导出操作日志
                      </Button>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        包含：操作类型、模块、记录编号、修改前后值、操作人、操作时间、备注等完整审计记录
                      </div>
                    </Space>
                  </Card>
                </div>
              )}

              {activeKey === 'logs' && (
                <div>
                  <Title level={4}>操作日志</Title>
                  <Card>
                    <Space wrap style={{ marginBottom: 16 }}>
                      <RangePicker
                        style={{ width: 300 }}
                        value={[filters.startDate, filters.endDate]}
                        onChange={(dates) => setFilters({
                          ...filters,
                          startDate: dates?.[0],
                          endDate: dates?.[1]
                        })}
                      />
                      <Input
                        placeholder="操作人ID"
                        style={{ width: 200 }}
                        value={filters.operator}
                        onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
                      />
                      <Select
                        placeholder="选择模块"
                        style={{ width: 150 }}
                        value={filters.module}
                        onChange={(value) => setFilters({ ...filters, module: value })}
                        allowClear
                      >
                        <Option value="customer_addresses">客户地址</Option>
                        <Option value="delivery_signoffs">配送签收</Option>
                        <Option value="bucket_returns">退桶验收</Option>
                        <Option value="damage_seizures">破损扣押</Option>
                        <Option value="bucket_balances">欠桶余额</Option>
                      </Select>
                      <Button type="primary" icon={<ReloadOutlined />} onClick={loadLogs}>
                        查询
                      </Button>
                    </Space>
                    
                    <Table
                      columns={logColumns}
                      dataSource={logs}
                      loading={logsLoading}
                      rowKey="id"
                      pagination={{ pageSize: 20 }}
                    />
                  </Card>
                </div>
              )}
            </Content>
          </Layout>
        </Layout>

        <Modal
          title="详情时间线"
          open={timelineVisible}
          onCancel={() => setTimelineVisible(false)}
          footer={null}
          width={800}
        >
          {timelineLoading ? (
            <div>加载中...</div>
          ) : (
            <Timeline>
              {timelineData.map((item, index) => (
                <Timeline.Item key={index}>
                  <div style={{ marginBottom: 8 }}>
                    <Tag color="blue">{item.operator_name}</Tag>
                    <span style={{ marginLeft: 8, color: '#999' }}>
                      {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </span>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>操作：</strong>{item.operation_remark || item.operation_type}
                  </div>
                  {item.before_values && (
                    <Descriptions title="修改前" size="small" bordered column={1}>
                      {Object.entries(JSON.parse(item.before_values)).map(([key, value]) => (
                      <Descriptions.Item key={key} label={key}>
                        {String(value)}
                      </Descriptions.Item>
                    ))}
                    </Descriptions>
                  )}
                  {item.after_values && (
                    <Descriptions title="修改后" size="small" bordered column={1} style={{ marginTop: 8 }}>
                      {Object.entries(JSON.parse(item.after_values)).map(([key, value]) => (
                      <Descriptions.Item key={key} label={key}>
                        {String(value)}
                      </Descriptions.Item>
                    ))}
                    </Descriptions>
                  )}
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </Modal>
      </Layout>
    );
  };

  export default App;
