import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { workOrderAPI } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

const operationTypeMap: { [key: string]: { text: string; color: string } } = {
  create: { text: '创建工单', color: 'green' },
  update: { text: '更新工单', color: 'blue' },
  assign: { text: '分派工单', color: 'blue' },
  process: { text: '开始处理', color: 'orange' },
  complete: { text: '完成处理', color: 'green' },
  review: { text: '审核工单', color: 'purple' },
  block: { text: '拦截工单', color: 'red' },
  follow_up: { text: '回访记录', color: 'cyan' },
  export: { text: '数据导出', color: 'blue' }
};

const OperationLogsPage: React.FC = () => {
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>();

  useEffect(() => {
    fetchAllLogs();
  }, []);

  useEffect(() => {
    let filtered = [...allLogs];
    
    if (searchText) {
      filtered = filtered.filter(log => 
        log.description?.includes(searchText) ||
        log.operatorName?.includes(searchText) ||
        log.orderNo?.includes(searchText)
      );
    }
    
    if (filterType) {
      filtered = filtered.filter(log => log.operationType === filterType);
    }
    
    setFilteredLogs(filtered);
  }, [allLogs, searchText, filterType]);

  const fetchAllLogs = async () => {
    setLoading(true);
    try {
      const res = await workOrderAPI.list();
      const orders = res.data.list || [];
      
      const allLogsData: any[] = [];
      for (const order of orders) {
        try {
          const logsRes = await workOrderAPI.getLogs(order.id);
          logsRes.data.forEach((log: any) => {
            allLogsData.push({
              ...log,
              orderNo: order.orderNo
            });
          });
        } catch (e) {
          console.error('获取工单日志失败', order.id, e);
        }
      }
      
      allLogsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllLogs(allLogsData);
      setFilteredLogs(allLogsData);
    } catch (error) {
      console.error('获取操作日志失败', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '操作时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    },
    { title: '操作类型', dataIndex: 'operationType', key: 'operationType', width: 120,
      render: (type: string) => {
        const info = operationTypeMap[type] || { text: type, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
      filters: Object.entries(operationTypeMap).map(([key, value]) => ({
        text: value.text,
        value: key
      })),
      onFilter: (value: string | number | boolean, record: any) => record.operationType === value
    },
    { title: '工单编号', dataIndex: 'orderNo', key: 'orderNo', width: 140 },
    { title: '操作人', dataIndex: 'operatorName', key: 'operatorName', width: 120 },
    { title: '操作描述', dataIndex: 'description', key: 'description', ellipsis: true }
  ];

  return (
    <div>
      <Card 
        title="操作日志" 
        extra={
          <div style={{ display: 'flex', gap: 16 }}>
            <Input
              placeholder="搜索描述、操作人、工单号"
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Select
              placeholder="操作类型"
              style={{ width: 150 }}
              value={filterType}
              onChange={setFilterType}
              allowClear
            >
              {Object.entries(operationTypeMap).map(([key, value]) => (
                <Option key={key} value={key}>{value.text}</Option>
              ))}
            </Select>
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredLogs}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>
    </div>
  );
};

export default OperationLogsPage;
