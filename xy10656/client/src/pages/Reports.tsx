import { useState, useEffect } from 'react';
import { Table, Card, Button, Space, DatePicker, Select, message, Tag } from 'antd';
import { ExportOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';

interface ReportRecord {
  id: string;
  studentName?: string;
  studentNo?: string;
  routeName?: string;
  stopName?: string;
  actualStopName?: string;
  attendanceDate: string;
  direction: string;
  status: string;
  parentConfirmed: number;
  operatorName?: string;
  changeTime?: string;
}

interface Route {
  id: string;
  name: string;
}

export default function Reports() {
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<string>(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [operatorFilter, setOperatorFilter] = useState<string>('');

  const loadRoutes = async () => {
    try {
      const res = await axios.get('/api/routes');
      setRoutes(res.data);
    } catch (error) {
      message.error('加载线路列表失败');
    }
  };

  useEffect(() => {
    loadRoutes();
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params: any = {
        startDate,
        endDate,
      };
      if (selectedRoute) {
        params.routeId = selectedRoute;
      }
      if (operatorFilter) {
        params.changedBy = operatorFilter;
      }
      const res = await axios.get('/api/attendance/export', { params });
      setRecords(res.data);
    } catch (error) {
      message.error('加载报表失败');
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      normal: 'green',
      absent: 'red',
      changed: 'orange',
      leave: 'blue',
    };
    return map[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      normal: '正常',
      absent: '缺勤',
      changed: '改站',
      leave: '请假',
    };
    return map[status] || status;
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'attendanceDate',
      key: 'attendanceDate',
    },
    {
      title: '学生姓名',
      dataIndex: 'studentName',
      key: 'studentName',
    },
    {
      title: '学号',
      dataIndex: 'studentNo',
      key: 'studentNo',
    },
    {
      title: '线路',
      dataIndex: 'routeName',
      key: 'routeName',
    },
    {
      title: '原定站点',
      dataIndex: 'stopName',
      key: 'stopName',
    },
    {
      title: '实际站点',
      dataIndex: 'actualStopName',
      key: 'actualStopName',
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      render: (text: string) => (text === 'morning' ? '上学' : '放学'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>,
    },
    {
      title: '家长确认',
      dataIndex: 'parentConfirmed',
      key: 'parentConfirmed',
      render: (confirmed: number) => (confirmed ? '已确认' : '未确认'),
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      key: 'operatorName',
    },
    {
      title: '变更时间',
      dataIndex: 'changeTime',
      key: 'changeTime',
    },
  ];

  return (
    <div>
      <Card
        title="报表导出"
        extra={
          <Space>
            <DatePicker
              defaultValue={dayjs(startDate)}
              onChange={(date) => date && setStartDate(date.format('YYYY-MM-DD'))}
            />
            <DatePicker
              defaultValue={dayjs(endDate)}
              onChange={(date) => date && setEndDate(date.format('YYYY-MM-DD'))}
            />
            <Select
              placeholder="选择线路"
              value={selectedRoute}
              onChange={setSelectedRoute}
              style={{ width: 150 }}
              allowClear
            >
              {routes.map((route) => (
                <Select.Option key={route.id} value={route.id}>
                  {route.name}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="操作人"
              value={operatorFilter}
              onChange={setOperatorFilter}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="操作员">操作员</Select.Option>
              <Select.Option value="管理员">管理员</Select.Option>
            </Select>
            <Button icon={<SearchOutlined />} onClick={loadReport}>
              查询
            </Button>
            <Button type="primary" icon={<ExportOutlined />} onClick={() => message.info('导出功能开发中...')}>
              导出Excel
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
}
