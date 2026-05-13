import React, { useEffect, useState } from 'react';
import { Button, Space, Select, DatePicker, message, Card, Table, Tag, Row, Col } from 'antd';
import { DownloadOutlined, BarChartOutlined } from '@ant-design/icons';
import { statisticsAPI } from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = Select;

const Report: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [handler, setHandler] = useState<string>('');

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await statisticsAPI.getReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        handler: handler || undefined,
      });
      setReportData(res.data.data);
    } catch (error) {
      message.error('加载报表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await statisticsAPI.exportReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        handler: handler || undefined,
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `消毒灭菌报表_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const recoveryColumns = [
    { title: '回收编号', dataIndex: 'recovery_no', key: 'recovery_no' },
    { title: '器械包', dataIndex: 'package_name', key: 'package_name' },
    { title: '科室', dataIndex: 'department', key: 'department' },
    { title: '回收时间', dataIndex: 'recovery_time', key: 'recovery_time' },
    { title: '处理人', dataIndex: 'receiver', key: 'receiver' },
  ];

  const cleaningColumns = [
    { title: '清洗编号', dataIndex: 'cleaning_no', key: 'cleaning_no' },
    { title: '器械包', dataIndex: 'package_name', key: 'package_name' },
    { title: '清洗员', dataIndex: 'cleaner', key: 'cleaner' },
    { title: '清洗方式', dataIndex: 'cleaning_method', key: 'cleaning_method' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time' },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (result: string) => {
        const colorMap: Record<string, string> = {
          passed: 'green',
          failed: 'red',
          pending: 'orange',
        };
        return <Tag color={colorMap[result] || 'default'}>{result}</Tag>;
      },
    },
  ];

  const distributionColumns = [
    { title: '发放编号', dataIndex: 'distribution_no', key: 'distribution_no' },
    { title: '器械包', dataIndex: 'package_name', key: 'package_name' },
    { title: '科室', dataIndex: 'department', key: 'department' },
    { title: '发放人', dataIndex: 'distributor', key: 'distributor' },
    { title: '发放时间', dataIndex: 'distribution_time', key: 'distribution_time' },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={8}>
              <div style={{ marginBottom: 8 }}>日期范围</div>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setStartDate(dates[0].format('YYYY-MM-DD'));
                    setEndDate(dates[1].format('YYYY-MM-DD'));
                  } else {
                    setStartDate('');
                    setEndDate('');
                  }
                }}
              />
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 8 }}>处理人</div>
              <Select
                placeholder="选择处理人"
                allowClear
                style={{ width: '100%' }}
                value={handler || undefined}
                onChange={setHandler}
              >
                <Select.Option value="张三">张三</Select.Option>
                <Select.Option value="李四">李四</Select.Option>
                <Select.Option value="王五">王五</Select.Option>
                <Select.Option value="赵六">赵六</Select.Option>
                <Select.Option value="钱七">钱七</Select.Option>
              </Select>
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 8 }}>操作</div>
              <Space>
                <Button
                  type="primary"
                  icon={<BarChartOutlined />}
                  onClick={loadReport}
                  loading={loading}
                >
                  查询报表
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                >
                  导出Excel
                </Button>
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {reportData && (
        <>
          <Card title="回收记录" style={{ marginBottom: 16 }}>
            <Table
              columns={recoveryColumns}
              dataSource={reportData.recoveryRecords || []}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
            />
          </Card>

          <Card title="清洗记录" style={{ marginBottom: 16 }}>
            <Table
              columns={cleaningColumns}
              dataSource={reportData.cleaningRecords || []}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
            />
          </Card>

          <Card title="发放记录">
            <Table
              columns={distributionColumns}
              dataSource={reportData.distributionRecords || []}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default Report;
