import React, { useState } from 'react';
import {
  Card,
  Select,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Alert,
  Button,
  Drawer,
  Descriptions,
} from 'antd';
import { ArrowLeftOutlined, EyeOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useCalculationStore } from '../store/calculationStore';
import { STATUS_LABELS } from '../constants/businessRules';
import { formatCurrency } from '../services/businessLogic';
import type { MarginCalculation } from '../types';

const ChartView: React.FC = () => {
  const { calculations, transactions, splitInfos, emailSupplements } = useCalculationStore();
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [detailData, setDetailData] = useState<MarginCalculation | null>(null);

  const getBusinessTransactions = (businessNumber: string) => {
    return transactions.filter(t => t.businessNumber === businessNumber);
  };

  const getBusinessSplitInfo = (businessNumber: string) => {
    return splitInfos.find(s => s.businessNumber === businessNumber);
  };

  const getBusinessEmails = (businessNumber: string) => {
    return emailSupplements.filter(e => e.businessNumber === businessNumber);
  };

  const barChartOption = {
    title: {
      text: '保证金压力试算对比',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: any) => {
        const data = params[0];
        const calc = calculations.find(c => c.businessNumber === data.name);
        if (calc) {
          return `
            <strong>${data.name}</strong><br/>
            基础保证金: ${formatCurrency(calc.baseMargin)}<br/>
            压力保证金: ${formatCurrency(calc.stressMargin)}<br/>
            状态: ${STATUS_LABELS[calc.status].label}
          `;
        }
        return '';
      },
    },
    legend: {
      data: ['基础保证金', '压力保证金'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: calculations.map(c => c.businessNumber),
      axisLabel: {
        rotate: 30,
        interval: 0,
      },
    },
    yAxis: {
      type: 'value',
      name: '金额 (元)',
      axisLabel: {
        formatter: (value: number) => (value / 10000).toFixed(0) + '万',
      },
    },
    series: [
      {
        name: '基础保证金',
        type: 'bar',
        data: calculations.map(c => c.baseMargin),
        itemStyle: { color: '#1890ff' },
      },
      {
        name: '压力保证金',
        type: 'bar',
        data: calculations.map(c => c.stressMargin),
        itemStyle: { color: '#fa8c16' },
      },
    ],
  };

  const pieChartOption = {
    title: {
      text: '试算状态分布',
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle',
    },
    series: [
      {
        name: '状态分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: false,
        },
        data: [
          { value: calculations.filter(c => c.status === 'NORMAL').length, name: '正常', itemStyle: { color: '#52c41a' } },
          { value: calculations.filter(c => c.status === 'PENDING_REVIEW').length, name: '待复核', itemStyle: { color: '#faad14' } },
          { value: calculations.filter(c => c.status === 'SPLIT_PENDING').length, name: '拆分待复核', itemStyle: { color: '#fa8c16' } },
          { value: calculations.filter(c => c.status === 'DISPUTED').length, name: '有争议', itemStyle: { color: '#ff4d4f' } },
          { value: calculations.filter(c => c.status === 'ROLLBACKED').length, name: '已回滚', itemStyle: { color: '#8c8c8c' } },
        ].filter(d => d.value > 0),
      },
    ],
  };

  const lineChartOption = {
    title: {
      text: '保证金比例趋势',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['保证金比例'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: calculations.map(c => c.businessNumber),
      axisLabel: {
        rotate: 30,
        interval: 0,
      },
    },
    yAxis: {
      type: 'value',
      name: '比例 (%)',
      axisLabel: {
        formatter: '{value}%',
      },
    },
    series: [
      {
        name: '保证金比例',
        type: 'line',
        data: calculations.map(c => (c.marginRatio * 100).toFixed(1)),
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.5)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.1)' },
            ],
          },
        },
      },
    ],
  };

  const threeDBarOption = {
    ...barChartOption,
    title: {
      text: '3D 保证金压力试算对比',
      left: 'center',
    },
    series: barChartOption.series.map((s: any) => ({
      ...s,
      barGap: '10%',
      itemStyle: {
        ...s.itemStyle,
        opacity: 0.8,
      },
      emphasis: {
        itemStyle: {
          opacity: 1,
        },
      },
    })),
  };

  const handleRowClick = (record: MarginCalculation) => {
    setDetailData(record);
    setSelectedBusiness(record.businessNumber);
    setIsDrawerOpen(true);
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title">图表展示</h2>
        <Space>
          <Select
            value={viewMode}
            onChange={setViewMode}
            style={{ width: 120 }}
            options={[
              { label: '2D 图表', value: '2d' },
              { label: '3D 效果', value: '3d' },
            ]}
          />
        </Space>
      </div>

      <Alert
        message="服务复核提示"
        description="点击图表中的业务号或下方表格中的记录，可以回溯查看原始柜台流水和客户经理补充邮件，确保图表数据可追溯。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16}>
        <Col span={12}>
          <Card size="small">
            <div className="chart-container">
              <ReactECharts 
                option={viewMode === '3d' ? threeDBarOption : barChartOption} 
                style={{ height: '100%' }}
                onEvents={{
                  click: (params: any) => {
                    const calc = calculations.find(c => c.businessNumber === params.name);
                    if (calc) handleRowClick(calc);
                  },
                }}
              />
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <div className="chart-container">
              <ReactECharts option={pieChartOption} style={{ height: '100%' }} />
            </div>
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginTop: 16 }}>
        <div className="chart-container">
          <ReactECharts option={lineChartOption} style={{ height: '100%' }} />
        </div>
      </Card>

      <Card 
        title="数据明细（点击可回溯）" 
        size="small" 
        style={{ marginTop: 16 }}
      >
        <Table
          dataSource={calculations}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5 }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: '业务号',
              dataIndex: 'businessNumber',
              key: 'businessNumber',
              render: (text) => <a>{text}</a>,
            },
            { title: '试算场景', dataIndex: 'scenario', key: 'scenario' },
            {
              title: '基础保证金',
              dataIndex: 'baseMargin',
              key: 'baseMargin',
              render: (val) => formatCurrency(val),
            },
            {
              title: '压力保证金',
              dataIndex: 'stressMargin',
              key: 'stressMargin',
              render: (val) => formatCurrency(val),
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (status) => {
                const info = STATUS_LABELS[status];
                return <Tag color={info.color}>{info.label}</Tag>;
              },
            },
            {
              title: '操作',
              key: 'action',
              render: (_: any, record) => (
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRowClick(record);
                  }}
                >
                  溯源
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setIsDrawerOpen(false)}
            />
            数据溯源 - {selectedBusiness}
          </Space>
        }
        placement="right"
        width={700}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      >
        {detailData && (
          <div>
            <Descriptions title="试算信息" bordered size="small" column={1}>
              <Descriptions.Item label="业务号">
                {detailData.businessNumber}
              </Descriptions.Item>
              <Descriptions.Item label="试算场景">
                {detailData.scenario}
              </Descriptions.Item>
              <Descriptions.Item label="基础保证金">
                {formatCurrency(detailData.baseMargin)}
              </Descriptions.Item>
              <Descriptions.Item label="压力保证金">
                {formatCurrency(detailData.stressMargin)}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_LABELS[detailData.status].color}>
                  {STATUS_LABELS[detailData.status].label}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Card 
              title="关联柜台流水" 
              size="small" 
              style={{ marginTop: 16 }}
              type="inner"
            >
              <Table
                dataSource={getBusinessTransactions(detailData.businessNumber)}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: '流水尾号', dataIndex: 'tailNumber', key: 'tailNumber' },
                  { title: '类型', dataIndex: 'transactionType', key: 'type',
                    render: (t) => t === 'FEE' ? '手续费' : t === 'PRINCIPAL' ? '本金' : '合计'
                  },
                  { title: '金额', dataIndex: 'amount', key: 'amount',
                    render: (v) => formatCurrency(v)
                  },
                  { title: '交易日期', dataIndex: 'transactionDate', key: 'date',
                    render: (d) => dayjs(d).format('YYYY-MM-DD')
                  },
                  { title: '备注', dataIndex: 'remark', key: 'remark' },
                ]}
              />
            </Card>

            {getBusinessSplitInfo(detailData.businessNumber) && (
              <Alert
                message="拆分记录"
                description={
                  <div>
                    <p><strong>本金:</strong> {formatCurrency(getBusinessSplitInfo(detailData.businessNumber)!.principalAmount)}</p>
                    <p><strong>手续费:</strong> {formatCurrency(getBusinessSplitInfo(detailData.businessNumber)!.feeAmount)}</p>
                    <p><strong>合计:</strong> {formatCurrency(getBusinessSplitInfo(detailData.businessNumber)!.totalAmount)}</p>
                    <p><strong>状态:</strong> {getBusinessSplitInfo(detailData.businessNumber)!.status}</p>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}

            {getBusinessEmails(detailData.businessNumber).length > 0 && (
              <Card 
                title="关联客户经理补充邮件" 
                size="small" 
                style={{ marginTop: 16 }}
                type="inner"
              >
                {getBusinessEmails(detailData.businessNumber).map((email, idx) => (
                  <div key={email.id} style={{ marginBottom: idx > 0 ? 16 : 0 }}>
                    <Descriptions size="small" column={2}>
                      <Descriptions.Item label="主题">{email.subject}</Descriptions.Item>
                      <Descriptions.Item label="发件人">{email.sender}</Descriptions.Item>
                      <Descriptions.Item label="发送时间">
                        {dayjs(email.sentAt).format('YYYY-MM-DD HH:mm')}
                      </Descriptions.Item>
                      <Descriptions.Item label="导入时间">
                        {dayjs(email.importedAt).format('YYYY-MM-DD HH:mm')}
                      </Descriptions.Item>
                      <Descriptions.Item label="内容" span={2}>
                        <div style={{ maxHeight: 100, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                          {email.supplementContent}
                        </div>
                      </Descriptions.Item>
                    </Descriptions>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ChartView;
