import React, { useState, useEffect } from 'react';
import { Card, Button, DatePicker, Select, Space, Table, Statistic, Row, Col, message } from 'antd';
import { DownloadOutlined, BarChartOutlined } from '@ant-design/icons';
import { syncAPI, suppliersAPI } from '../api';
import dayjs from 'dayjs';

const Reports: React.FC = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(dayjs().subtract(30, 'day'));
  const [endDate, setEndDate] = useState(dayjs());
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await suppliersAPI.list();
        setSuppliers(response.data);
      } catch (error) {
        message.error('获取供应商列表失败');
      }
    };
    fetchSuppliers();
  }, []);

  const generateReport = async () => {
    setLoading(true);
    try {
      const response = await syncAPI.generateReport({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        supplier_id: selectedSupplier,
        include_conflicts: true,
        include_pending: true,
      });
      setReportData(response.data);
    } catch (error) {
      message.error('生成报告失败');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    try {
      const response = await syncAPI.exportReport({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        supplier_id: selectedSupplier,
        include_conflicts: true,
        include_pending: true,
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `supplier_mapping_report_${dayjs().format('YYYYMMDD')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const batchColumns = [
    { title: '批次ID', dataIndex: 'batch_id', key: 'batch_id' },
    { title: '状态', dataIndex: 'status', key: 'status' },
    { title: '总数', dataIndex: 'total_items', key: 'total_items' },
    { title: '成功', dataIndex: 'success_items', key: 'success_items' },
    { title: '失败', dataIndex: 'failed_items', key: 'failed_items' },
    { title: '冲突', dataIndex: 'conflict_items', key: 'conflict_items' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Space>
            <span>日期范围:</span>
            <DatePicker value={startDate} onChange={setStartDate} />
            <span>至</span>
            <DatePicker value={endDate} onChange={setEndDate} />
          </Space>
          <Space>
            <span>供应商:</span>
            <Select
              style={{ width: 200 }}
              value={selectedSupplier}
              onChange={setSelectedSupplier}
              allowClear
              placeholder="全部供应商"
            >
              {suppliers.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.supplier_name}</Select.Option>
              ))}
            </Select>
          </Space>
          <Space>
            <Button type="primary" icon={<BarChartOutlined />} onClick={generateReport} loading={loading}>
              生成报告
            </Button>
            {reportData && (
              <Button icon={<DownloadOutlined />} onClick={exportReport}>
                导出Excel
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      {reportData && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic title="同步批次总数" value={reportData.summary.total_batches} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="商品总数" value={reportData.summary.total_items} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="成功数量" value={reportData.summary.success_items} valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="冲突数量" value={reportData.summary.conflict_items} valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
          </Row>

          <Card title="同步批次详情">
            <Table columns={batchColumns} dataSource={reportData.batches} rowKey="batch_id" />
          </Card>
        </>
      )}
    </div>
  );
};

export default Reports;
