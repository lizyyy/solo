import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Spin, message } from 'antd';
import {
  UserOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  RedoOutlined
} from '@ant-design/icons';
import { statisticsApi } from '../api';
import { Statistics } from '../types';

const StatisticsDashboard: React.FC = () => {
  const [data, setData] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res: any = await statisticsApi.get();
      setData(res.data);
    } catch (error) {
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }} />;
  }

  if (!data) return null;

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>统计概览</h2>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="学员总数"
              value={data.students}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="证书总数"
              value={data.certificates.total}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已发放"
              value={data.certificates.issued}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已撤销"
              value={data.certificates.revoked}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待处理"
              value={data.certificates.pending}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已复核"
              value={data.certificates.rechecked}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="考试通过"
              value={data.examScores.passed}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="补考记录"
              value={data.retakeRecords}
              prefix={<RedoOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={12}>
          <Card title="考试统计">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="考试人次" value={data.examScores.total} />
              </Col>
              <Col span={12}>
                <Statistic title="通过率" value={data.examScores.passRate} suffix="%" />
              </Col>
            </Row>
          </Card>
        </Col>
        
        <Col xs={24} md={12}>
          <Card title="出勤统计">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="出勤" value={data.attendances.present} valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col span={8}>
                <Statistic title="缺席" value={data.attendances.absent} valueStyle={{ color: '#cf1322' }} />
              </Col>
              <Col span={8}>
                <Statistic title="迟到" value={data.attendances.late} valueStyle={{ color: '#faad14' }} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StatisticsDashboard;
