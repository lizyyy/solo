import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Card, Statistic, Row, Col } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

function ExceptionBoard() {
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/exceptions');
      setExceptions(res.data);
    } catch (error) {
      message.error('加载异常数据失败');
    } finally {
      setLoading(false);
    }
  };

  const resolveException = async (id) => {
    try {
      await axios.put(`/api/exceptions/${id}/resolve`, { resolved_by: '当前用户' });
      message.success('已标记为已处理');
      loadExceptions();
    } catch (error) {
      message.error('操作失败');
    }
  };

  useEffect(() => {
    loadExceptions();
  }, []);

  const unresolved = exceptions.filter(e => !e.resolved);
  const highSeverity = exceptions.filter(e => e.severity === 'high' && !e.resolved);
  const mediumSeverity = exceptions.filter(e => e.severity === 'medium' && !e.resolved);
  const lowSeverity = exceptions.filter(e => e.severity === 'low' && !e.resolved);

  const columns = [
    {
      title: '合同编号',
      dataIndex: 'contract_no',
      key: 'contract_no',
      width: 140
    },
    {
      title: '合同名称',
      dataIndex: 'contract_name',
      key: 'contract_name',
      ellipsis: true
    },
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      key: 'exception_type',
      width: 140,
      render: (val) => {
        const typeMap = {
          'contract_expiring': '合同即将到期',
          'pending_signature': '电子签待签署',
          'paper_not_archived': '纸质合同未归档'
        };
        return typeMap[val] || val;
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (val) => {
        const colorMap = { high: 'red', medium: 'orange', low: 'blue' };
        return <Tag color={colorMap[val]}>{val === 'high' ? '高' : val === 'medium' ? '中' : '低'}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'resolved',
      key: 'resolved',
      width: 100,
      render: (val) => val ? <Tag color="green">已处理</Tag> : <Tag color="red">未处理</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        !record.resolved && (
          <Button type="link" size="small" onClick={() => resolveException(record.id)}>
            标记处理
          </Button>
        )
      )
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button type="primary" onClick={loadExceptions} loading={loading}>刷新</Button>
      </Space>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待处理异常" value={unresolved.length} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="高优先级" value={highSeverity.length} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="中优先级" value={mediumSeverity.length} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="低优先级" value={lowSeverity.length} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
      </Row>

      <Card title="异常列表">
        <Table
          columns={columns}
          dataSource={exceptions}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>
    </div>
  );
}

export default ExceptionBoard;
