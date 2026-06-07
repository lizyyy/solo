import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Card,
  message,
  Statistic,
  Row,
  Col,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  HighlightOutlined,
} from '@ant-design/icons';
import { runSelfCheck, getSelfCheckResults, resolveSelfCheck } from '../api';
import { SelfCheckResult, SelfCheckType, selfCheckTypeText } from '../types';

const severityColor = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

const severityText = {
  high: '高危',
  medium: '中危',
  low: '低危',
};

function SelfCheckPage() {
  const [results, setResults] = useState<SelfCheckResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getSelfCheckResults();
      setResults(data);
    } catch (e) {
      message.error('获取自检结果失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunCheck = async () => {
    setRunning(true);
    try {
      const res = await runSelfCheck();
      message.success(`自检完成，发现 ${res.count} 个问题`);
      fetchData();
    } catch (e) {
      message.error('自检失败');
    } finally {
      setRunning(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveSelfCheck(id);
      message.success('已标记为已解决');
      fetchData();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const stats = {
    high: results.filter(r => r.severity === 'high').length,
    medium: results.filter(r => r.severity === 'medium').length,
    low: results.filter(r => r.severity === 'low').length,
  };

  const columns: ColumnsType<SelfCheckResult> = [
    {
      title: '问题类型',
      dataIndex: 'check_type',
      key: 'check_type',
      width: 140,
      render: (type: SelfCheckType) => (
        <Tag color="geekblue">{selfCheckTypeText[type]}</Tag>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (s: 'high' | 'medium' | 'low') => (
        <Tag color={severityColor[s]}>
          {severityText[s]}
        </Tag>
      ),
    },
    {
      title: '问题描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '关联记录ID',
      dataIndex: 'record_id',
      key: 'record_id',
      width: 200,
      ellipsis: true,
      render: (id) => <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{id}</code>,
    },
    {
      title: '检测时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (ts: number) => new Date(ts).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, item) => (
        <Popconfirm
          title="标记为已解决？"
          onConfirm={() => handleResolve(item.id)}
        >
          <Button type="link" size="small" icon={<CheckCircleOutlined />}>
            标记已解决
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="高危问题"
              value={stats.high}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<HighlightOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="中危问题"
              value={stats.medium}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="低危问题"
              value={stats.low}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              loading={running}
              onClick={handleRunCheck}
              block
              style={{ height: 60 }}
            >
              执行自检
            </Button>
          </Card>
        </Col>
      </Row>

      <Card
        title="自检项目说明"
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={6}>
            <Tag color="orange">重复导入</Tag>
            <span style={{ fontSize: 12 }}>检测同一会话是否存在多条导入记录</span>
          </Col>
          <Col span={6}>
            <Tag color="red">手机号漏遮</Tag>
            <span style={{ fontSize: 12 }}>检测文本中是否存在未脱敏的手机号</span>
          </Col>
          <Col span={6}>
            <Tag color="geekblue">补录待重算</Tag>
            <span style={{ fontSize: 12 }}>检测更新后的记录是否需要重新审核</span>
          </Col>
          <Col span={6}>
            <Tag color="purple">导出一致</Tag>
            <span style={{ fontSize: 12 }}>确保导出、页面、接口读取同一份数据</span>
          </Col>
        </Row>
      </Card>

      <Card
        title={`自检结果 (${results.length})`}
        extra={
          <Button onClick={fetchData} loading={loading}>
            刷新
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={results}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          locale={{ emptyText: '暂无自检问题，点击"执行自检"开始检测' }}
        />
      </Card>
    </div>
  );
}

export default SelfCheckPage;
