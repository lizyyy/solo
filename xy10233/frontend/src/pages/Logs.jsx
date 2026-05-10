import React, { useEffect, useState } from 'react';
import {
  Table, Tag, Space, Card, Row, Col, Statistic, Button, message
} from 'antd';
import { RefreshOutlined } from '@ant-design/icons';
import { logApi } from '../services/api';
import dayjs from 'dayjs';

function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await logApi.getAll({ limit: 500 });
      setLogs(res.data.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getTypeTag = (type) => {
    const colors = {
      tank_create: 'green',
      tank_update: 'blue',
      tank_delete: 'red',
      batch_create: 'cyan',
      batch_update: 'geekblue',
      batch_bind: 'purple',
      batch_delete: 'red',
      water_quality_import: 'orange',
      alert_acknowledge: 'gold',
      alert_resolve: 'green',
      death_loss_create: 'red',
      death_loss_attribute: 'purple',
      system: 'default'
    };
    return <Tag color={colors[type] || 'default'}>{type}</Tag>;
  };

  const stats = {
    total: logs.length,
    water: logs.filter(l => l.operation_type === 'water_quality_import').length,
    alert: logs.filter(l => l.operation_type.includes('alert')).length,
    death: logs.filter(l => l.operation_type.includes('death_loss')).length
  };

  const columns = [
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      key: 'type',
      render: (type) => getTypeTag(type),
      width: 180
    },
    {
      title: '目标类型',
      dataIndex: 'target_type',
      key: 'target',
      render: (v) => v || '-',
      width: 100
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'time',
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
      width: 180
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>操作日志</h2>
        <Button icon={<RefreshOutlined />} onClick={fetchLogs}>刷新</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总操作数" value={stats.total} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="水质导入" value={stats.water} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="报警处理" value={stats.alert} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="死耗相关" value={stats.death} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

export default Logs;
