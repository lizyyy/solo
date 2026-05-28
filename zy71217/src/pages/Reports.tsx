import React, { useMemo } from 'react';
import { Card, Row, Col, Statistic, Table, Tag } from 'antd';
import {
  BarChartOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '../store';
import { detectAnomalies } from '../services/validationService';
import { formatCurrency, getStatusText, getStatusColor } from '../utils/helpers';

const Reports: React.FC = () => {
  const { redemptions, batches } = useAppStore();

  const anomalyStats = useMemo(() => {
    const negativeBalance = redemptions.filter(r => r.currentBalance < 0).length;
    const duplicates = redemptions.length - new Set(redemptions.map(r => r.cardNumber)).size;
    const disputes = redemptions.filter(r => r.hasDispute).length;
    const disputeNotFrozen = redemptions.filter(r => r.hasDispute && !r.isFrozen).length;

    return { negativeBalance, duplicates, disputes, disputeNotFrozen };
  }, [redemptions]);

  const statusStats = useMemo(() => {
    const stats: Record<string, number> = {};
    redemptions.forEach(r => {
      stats[r.status] = (stats[r.status] || 0) + 1;
    });
    return stats;
  }, [redemptions]);

  const batchStats = useMemo(() => {
    return batches.map(b => {
      const batchRedemptions = redemptions.filter(r => r.batchId === b.id);
      const completedCount = batchRedemptions.filter(r => r.status === 'completed').length;
      const totalAmount = batchRedemptions.reduce((sum, r) => sum + Math.max(0, r.currentBalance), 0);
      return { ...b, completedCount, totalAmount };
    });
  }, [batches, redemptions]);

  const statusChartOption = useMemo(() => ({
    title: {
      text: '兑付状态分布',
      left: 'center',
      textStyle: { fontSize: 14, fontFamily: 'Noto Serif SC' }
    },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: 'bold' }
      },
      data: Object.entries(statusStats).map(([key, value]) => ({
        name: getStatusText(key as any),
        value,
        itemStyle: {
          color: {
            pending: '#86909C',
            processing: '#165DFF',
            completed: '#00B42A',
            frozen: '#FF7D00',
            disputed: '#F53F3F',
            cancelled: '#86909C'
          }[key]
        }
      }))
    }]
  }), [statusStats]);

  const batchChartOption = useMemo(() => ({
    title: {
      text: '批次兑付金额对比',
      left: 'center',
      textStyle: { fontSize: 14, fontFamily: 'Noto Serif SC' }
    },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: batchStats.map(b => b.batchNo),
      axisLabel: { rotate: 30 }
    },
    yAxis: { type: 'value', name: '金额(元)' },
    series: [{
      type: 'bar',
      data: batchStats.map(b => b.totalAmount),
      itemStyle: {
        color: '#165DFF',
        borderRadius: [4, 4, 0, 0]
      }
    }]
  }), [batchStats]);

  const anomalyColumns = [
    {
      title: '异常类型',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (text: string, record: any) => (
        <Tag color={record.severity === 'error' ? 'red' : 'orange'}>{text}</Tag>
      )
    },
    {
      title: '异常数量',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (val: number) => (
        <span className="font-semibold text-lg">{val}</span>
      )
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description'
    }
  ];

  const anomalyData = [
    {
      key: '1',
      type: '余额为负',
      count: anomalyStats.negativeBalance,
      severity: 'error',
      description: '兑付余额为负数，需要人工核实消费流水和初始余额'
    },
    {
      key: '2',
      type: '重复登记',
      count: anomalyStats.duplicates,
      severity: 'error',
      description: '同一会员卡存在多条登记记录，建议合并或删除'
    },
    {
      key: '3',
      type: '存在争议',
      count: anomalyStats.disputes,
      severity: 'warning',
      description: '存在争议的兑付记录，需要先处理争议'
    },
    {
      key: '4',
      type: '争议未冻结',
      count: anomalyStats.disputeNotFrozen,
      severity: 'warning',
      description: '有争议但未冻结的记录，建议先冻结再处理'
    }
  ];

  return (
    <div className="space-y-6">
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总登记数"
              value={redemptions.length}
              suffix="笔"
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={statusStats.completed || 0}
              suffix="笔"
              valueStyle={{ color: '#00B42A' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={(statusStats.pending || 0) + (statusStats.processing || 0)}
              suffix="笔"
              valueStyle={{ color: '#165DFF' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="异常总数"
              value={anomalyStats.negativeBalance + anomalyStats.duplicates + anomalyStats.disputeNotFrozen}
              suffix="笔"
              valueStyle={{ color: '#F53F3F' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card>
            <ReactECharts option={statusChartOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <ReactECharts option={batchChartOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Card title={
        <div className="flex items-center gap-2">
          <BarChartOutlined className="text-blue-500" />
          <span style={{ fontFamily: 'Noto Serif SC, serif' }}>异常检测报告</span>
        </div>
      }>
        <Table
          rowKey="key"
          columns={anomalyColumns}
          dataSource={anomalyData}
          pagination={false}
          rowClassName={(record) => record.count > 0 ? (record.severity === 'error' ? 'bg-red-50' : 'bg-orange-50') : ''}
        />
      </Card>

      <Card title={
        <div className="flex items-center gap-2">
          <BarChartOutlined className="text-blue-500" />
          <span style={{ fontFamily: 'Noto Serif SC, serif' }}>兑付金额汇总</span>
        </div>
      }>
        <Row gutter={16}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="待兑付金额"
                value={redemptions.filter(r => r.status === 'pending').reduce((sum, r) => sum + Math.max(0, r.currentBalance), 0)}
                precision={2}
                prefix="¥"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="已兑付金额"
                value={redemptions.filter(r => r.status === 'completed').reduce((sum, r) => sum + Math.max(0, r.currentBalance), 0)}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#00B42A' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="兑付总金额"
                value={redemptions.reduce((sum, r) => sum + Math.max(0, r.currentBalance), 0)}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#165DFF' }}
              />
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Reports;
