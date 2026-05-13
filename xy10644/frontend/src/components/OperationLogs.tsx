import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Typography, Descriptions, Collapse, Select, Space, Input } from 'antd';
import { HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { logApi, boxApi } from '../services/api';
import moment from 'moment';

const { Title, Text } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

interface OperationLog {
  id: string;
  operationType: string;
  entityType: string;
  entityId: string;
  operatorId: string;
  operatorName: string;
  operateTime: string;
  beforeValue?: any;
  afterValue?: any;
  remarks?: string;
}

const OperationLogs: React.FC = () => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [boxes, setBoxes] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<OperationLog[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, filterType, searchText]);

  const loadData = async () => {
    try {
      const [logsRes, boxesRes] = await Promise.all([
        logApi.getAll(),
        boxApi.getAll()
      ]);
      setLogs(logsRes.data);
      setBoxes(boxesRes.data);
    } catch (error) {
      console.error('加载日志失败', error);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];
    
    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.entityType === filterType);
    }
    
    if (searchText) {
      filtered = filtered.filter(log => 
        log.operatorName.includes(searchText) ||
        log.remarks?.includes(searchText) ||
        log.operationType.includes(searchText)
      );
    }
    
    setFilteredLogs(filtered);
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      temperature_box: '温度箱',
      rider_handover: '骑手交接',
      gps_node: 'GPS节点',
      sign_off_person: '签收人',
      delay_exchange: '延误换箱',
      risk_assessment: '风险评估',
      sign_off_record: '签收记录',
      report: '报告',
      timeline: '时间线'
    };
    return <Tag color="blue">{labels[type] || type}</Tag>;
  };

  const getOperationTypeLabel = (type: string) => {
    const colors: Record<string, string> = {
      create: 'green',
      update: 'orange',
      confirm: 'blue',
      assess: 'purple',
      export: 'cyan',
      signoff: 'geekblue',
      review_approve: 'success',
      review_reject: 'red'
    };
    const labels: Record<string, string> = {
      create: '创建',
      update: '更新',
      confirm: '确认',
      assess: '评估',
      export: '导出',
      signoff: '签收',
      review_approve: '审核通过',
      review_reject: '审核拒绝'
    };
    return <Tag color={colors[type] || 'default'}>{labels[type] || type}</Tag>;
  };

  const renderValueDiff = (before: any, after: any) => {
    if (!before && !after) return <Text type="secondary">无变化</Text>;
    
    return (
      <Collapse ghost>
        {before && (
          <Panel header="修改前" key="before">
            <pre style={{ background: '#fff1f0', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
              {JSON.stringify(before, null, 2)}
            </pre>
          </Panel>
        )}
        {after && (
          <Panel header="修改后" key="after">
            <pre style={{ background: '#f6ffed', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
              {JSON.stringify(after, null, 2)}
            </pre>
          </Panel>
        )}
      </Collapse>
    );
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'operateTime',
      key: 'operateTime',
      render: (time: string) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a: OperationLog, b: OperationLog) => 
        new Date(a.operateTime).getTime() - new Date(b.operateTime).getTime(),
      width: 180
    },
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      render: (type: string) => getOperationTypeLabel(type),
      width: 100
    },
    {
      title: '实体类型',
      dataIndex: 'entityType',
      key: 'entityType',
      render: (type: string) => getEntityTypeLabel(type),
      width: 120
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 120
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true
    },
    {
      title: '变更详情',
      key: 'diff',
      render: (_: any, record: OperationLog) => 
        renderValueDiff(record.beforeValue, record.afterValue)
    }
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Title level={4}>
          <HistoryOutlined /> 操作日志
        </Title>
        <Space style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 150 }}
            value={filterType}
            onChange={setFilterType}
            placeholder="筛选实体类型"
          >
            <Option value="all">全部</Option>
            <Option value="temperature_box">温度箱</Option>
            <Option value="rider_handover">骑手交接</Option>
            <Option value="gps_node">GPS节点</Option>
            <Option value="delay_exchange">延误换箱</Option>
            <Option value="sign_off_record">签收记录</Option>
          </Select>
          <Input
            placeholder="搜索操作人或备注"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
        </Space>
        <Table
          columns={columns}
          dataSource={filteredLogs}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="实体ID">{record.entityId}</Descriptions.Item>
                <Descriptions.Item label="操作人ID">{record.operatorId}</Descriptions.Item>
              </Descriptions>
            )
          }}
        />
      </Card>
    </Space>
  );
};

export default OperationLogs;
