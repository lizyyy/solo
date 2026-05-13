import { useState, useEffect } from 'react';
import { Table, Tag, Card, Space, DatePicker, Select, Input, Button, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { logAPI } from '../api';
import { OperationLog, OperationType, ExportFilter } from '../types';

const { RangePicker } = DatePicker;
const { Option } = Select;

const operationTypeMap: Record<OperationType, { text: string; color: string }> = {
  [OperationType.CREATE]: { text: '创建', color: 'blue' },
  [OperationType.UPDATE]: { text: '更新', color: 'orange' },
  [OperationType.DELETE]: { text: '删除', color: 'red' },
  [OperationType.CONFIRM]: { text: '确认', color: 'green' },
  [OperationType.REJECT]: { text: '拒绝', color: 'red' },
  [OperationType.CHECK_IN]: { text: '入园', color: 'cyan' },
  [OperationType.CHECK_OUT]: { text: '离园', color: 'purple' },
  [OperationType.MANUAL_REVIEW]: { text: '人工复核', color: 'orange' },
  [OperationType.BLACKLIST_ADD]: { text: '添加黑名单', color: 'red' },
  [OperationType.BLACKLIST_REMOVE]: { text: '移除黑名单', color: 'green' },
};

function OperationLogs() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [operators, setOperators] = useState<string[]>([]);
  const [filter, setFilter] = useState<ExportFilter>({});

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await logAPI.getAll(filter);
      setLogs(data);
    } catch (error) {
      message.error('获取操作日志失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchOperators = async () => {
    try {
      const data = await logAPI.getOperators();
      setOperators(data);
    } catch (error) {
      console.error('获取操作人列表失败', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchOperators();
  }, [filter]);

  const handleDateChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setFilter(prev => ({
        ...prev,
        startTime: dates[0].toISOString(),
        endTime: dates[1].toISOString(),
      }));
    } else {
      setFilter(prev => ({
        ...prev,
        startTime: undefined,
        endTime: undefined,
      }));
    }
  };

  const handleOperatorChange = (value: string) => {
    setFilter(prev => ({
      ...prev,
      operator: value || undefined,
    }));
  };

  const handleVisitorIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(prev => ({
      ...prev,
      visitorId: e.target.value || undefined,
    }));
  };

  const handleOperationTypeChange = (value: OperationType) => {
    setFilter(prev => ({
      ...prev,
      operationType: value || undefined,
    }));
  };

  const handleReset = () => {
    setFilter({});
  };

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 120,
    },
    {
      title: '操作人角色',
      dataIndex: 'operatorRole',
      key: 'operatorRole',
      width: 120,
    },
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      width: 120,
      render: (type: OperationType) => {
        const { text, color } = operationTypeMap[type] || { text: type, color: 'default' };
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '访客ID',
      dataIndex: 'visitorId',
      key: 'visitorId',
      width: 200,
      render: (id: string) => id || '-',
    },
    {
      title: '操作描述',
      dataIndex: 'description',
      key: 'description',
    },
  ];

  return (
    <div>
      <Card
        title="筛选条件"
        style={{ marginBottom: 16 }}
      >
        <Space wrap>
          <RangePicker
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            placeholder={['开始时间', '结束时间']}
            onChange={handleDateChange}
            style={{ width: 350 }}
          />
          <Select
            placeholder="选择操作人"
            style={{ width: 150 }}
            allowClear
            onChange={handleOperatorChange}
          >
            {operators.map(op => (
              <Option key={op} value={op}>{op}</Option>
            ))}
          </Select>
          <Select
            placeholder="选择操作类型"
            style={{ width: 150 }}
            allowClear
            onChange={handleOperationTypeChange}
          >
            {Object.entries(operationTypeMap).map(([key, value]) => (
              <Option key={key} value={key}>{value.text}</Option>
            ))}
          </Select>
          <Input
            placeholder="输入访客ID"
            style={{ width: 200 }}
            onChange={handleVisitorIdChange}
            prefix={<SearchOutlined />}
          />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Table
        title={() => <h3 style={{ margin: 0 }}>操作日志</h3>}
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
      />
    </div>
  );
}

export default OperationLogs;
