import React, { useState, useEffect } from 'react';
import {
  Table,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Button,
  Row,
  Col
} from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { AuditLog, OperationType } from '../../shared/types';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

const operationTypeLabels: Record<string, string> = {
  [OperationType.CREATE]: '创建',
  [OperationType.UPDATE]: '更新',
  [OperationType.STATUS_CHANGE]: '状态变更',
  [OperationType.DELETE]: '删除',
  [OperationType.IMPORT]: '导入',
  [OperationType.EXPORT]: '导出',
  [OperationType.RETRY]: '重试',
  [OperationType.LOGIN]: '登录',
  [OperationType.LOGOUT]: '退出'
};

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({
    operationType: undefined as OperationType | undefined,
    dateRange: null as [Dayjs, Dayjs] | null
  });

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        pageSize
      };

      if (filters.operationType) {
        params.operationType = filters.operationType;
      }
      if (filters.dateRange) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const result = await window.electronAPI.log.list(params);
      if (result.success) {
        setLogs(result.data.data);
        setTotal(result.data.total);
      }
    } catch (error) {
      console.error('加载日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, pageSize, filters]);

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      width: 100,
      render: (type: OperationType) => operationTypeLabels[type] || type
    },
    {
      title: '操作人',
      dataIndex: 'userName',
      key: 'userName',
      width: 120
    },
    {
      title: '目标类型',
      dataIndex: 'targetType',
      key: 'targetType',
      width: 100,
      render: (type: string) => {
        const labels: Record<string, string> = {
          order: '订单',
          user: '用户',
          log: '日志',
          failed_operation: '失败操作'
        };
        return labels[type] || type;
      }
    },
    {
      title: '目标ID',
      dataIndex: 'targetId',
      key: 'targetId',
      width: 180,
      render: (id: string | null) => id || '-'
    },
    {
      title: '操作详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 80,
      render: (success: boolean) => (
        <Tag color={success ? 'green' : 'red'}>
          {success ? '成功' : '失败'}
        </Tag>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2>操作日志</h2>
        <Button icon={<ReloadOutlined />} onClick={loadLogs}>
          刷新
        </Button>
      </div>

      <div className="filter-section">
        <Row gutter={16}>
          <Col span={8}>
            <Select
              placeholder="操作类型"
              allowClear
              style={{ width: '100%' }}
              onChange={(value) => setFilters({ ...filters, operationType: value })}
            >
              {Object.entries(operationTypeLabels).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Col>
          <Col span={16}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates as any })}
            />
          </Col>
        </Row>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={logs}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          }
        }}
      />
    </div>
  );
};

export default AuditLogPage;
