import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Button, Space, message } from 'antd';
import { 
  FileTextOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  InboxOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import axios from 'axios';

function Dashboard() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/contracts/dashboard/stats');
      setStats(res.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const generateExceptions = async () => {
    try {
      const res = await axios.post('/api/exceptions/generate');
      message.success(res.data.message);
      loadStats();
    } catch (error) {
      message.error('生成异常失败');
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ReloadOutlined />} onClick={loadStats} loading={loading}>刷新</Button>
        <Button type="primary" onClick={generateExceptions}>扫描异常</Button>
      </Space>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="合同总数"
              value={stats.total || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="生效合同"
              value={stats.active || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待签合同"
              value={stats.pending_sign || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未归档纸质合同"
              value={stats.not_archived || 0}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="负责人统计" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          {(stats.by_responsible || []).map((item, index) => (
            <Col span={8} key={index}>
              <Card size="small" type="inner">
                <Statistic title={item.responsible_person} value={item.count} suffix="份" />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}

export default Dashboard;
