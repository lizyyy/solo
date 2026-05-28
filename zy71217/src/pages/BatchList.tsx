import React from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Progress,
  Statistic,
  Row,
  Col
} from 'antd';
import {
  EyeOutlined,
  ExportOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { getBatchStatusColor, getBatchStatusText, formatCurrency } from '../utils/helpers';
import { exportBatchReport } from '../services/exportService';
import { Batch, BatchStatus } from '../types';

const BatchList: React.FC = () => {
  const navigate = useNavigate();
  const { batches, redemptions } = useAppStore();

  const columns = [
    {
      title: '批次号',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 180,
      render: (text: string) => <span className="font-mono">{text}</span>
    },
    {
      title: '批次名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: BatchStatus) => (
        <Tag color={getBatchStatusColor(status)}>
          {getBatchStatusText(status)}
        </Tag>
      )
    },
    {
      title: '兑付笔数',
      dataIndex: 'totalCount',
      key: 'totalCount',
      width: 100,
      align: 'right' as const,
      render: (val: number) => `${val} 笔`
    },
    {
      title: '兑付总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 140,
      align: 'right' as const,
      render: (val: number) => (
        <span className="font-mono text-green-600 font-semibold">
          ¥{formatCurrency(val)}
        </span>
      )
    },
    {
      title: '执行进度',
      key: 'progress',
      width: 200,
      render: (_: unknown, record: Batch) => {
        const completedCount = redemptions.filter(
          r => r.batchId === record.id && r.status === 'completed'
        ).length;
        const percent = record.totalCount > 0
          ? Math.round((completedCount / record.totalCount) * 100)
          : 0;
        return (
          <Progress
            percent={percent}
            size="small"
            status={record.status === 'completed' ? 'success' : 'active'}
          />
        );
      }
    },
    {
      title: '审核人',
      dataIndex: 'auditor',
      key: 'auditor',
      width: 120,
      render: (val: string) => val || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: Batch) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/batches/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ExportOutlined />}
            onClick={() => {
              const batchRedemptions = redemptions.filter(r => r.batchId === record.id);
              exportBatchReport(record, batchRedemptions, record.name);
            }}
          >
            导出
          </Button>
        </Space>
      )
    }
  ];

  const stats = {
    totalBatches: batches.length,
    totalAmount: batches.reduce((sum, b) => sum + b.totalAmount, 0),
    executingCount: batches.filter(b => b.status === 'executing').length,
    completedCount: batches.filter(b => b.status === 'completed').length
  };

  return (
    <div className="space-y-6">
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="总批次" value={stats.totalBatches} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="兑付总金额"
              value={stats.totalAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#00B42A' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中"
              value={stats.executingCount}
              suffix="个"
              valueStyle={{ color: '#165DFF' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completedCount}
              suffix="个"
              valueStyle={{ color: '#00B42A' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title={
        <div className="flex items-center gap-2">
          <UnorderedListOutlined className="text-blue-500" />
          <span style={{ fontFamily: 'Noto Serif SC, serif' }}>批次列表</span>
        </div>
      }>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={batches}
          pagination={{
            pageSize: 10,
            showTotal: total => `共 ${total} 个批次`
          }}
        />
      </Card>
    </div>
  );
};

export default BatchList;
