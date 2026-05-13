import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, List, Tag, message } from 'antd';
import { CheckCircleOutlined, WarningOutlined, FileTextOutlined, BarChartOutlined } from '@ant-design/icons';
import axios from 'axios';

function StatisticsPage() {
  const [statistics, setStatistics] = useState(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const response = await axios.get('/api/report/statistics');
        setStatistics(response.data);
      } catch (error) {
        message.error('获取统计数据失败');
      }
    };
    fetchStatistics();
  }, []);

  if (!statistics) {
    return <div>加载中...</div>;
  }

  const statusCounts = statistics.status_counts || [];
  const compensationSummary = statistics.compensation_summary || {};
  const damageByType = statistics.damage_by_type || [];

  return (
    <div>
      <h2 className="page-title">统计概览</h2>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="布草总数量" 
              value={statusCounts.reduce((sum, item) => sum + item.count, 0)}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="赔付总金额" 
              value={compensationSummary.total_amount || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="已赔付金额" 
              value={compensationSummary.deducted_amount || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="破损记录数" 
              value={compensationSummary.total_records || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="状态分布" className="card-content">
            <List
              dataSource={statusCounts}
              renderItem={(item) => {
                const statusMap = {
                  in_room: { text: '在房间', color: '#52c41a' },
                  pending_handover: { text: '待交接', color: '#faad14' },
                  floor_handover: { text: '楼层交接中', color: '#1890ff' },
                  sent_to_factory: { text: '已送厂', color: '#722ed1' },
                  in_factory: { text: '洗涤厂处理中', color: '#13c2c2' },
                  damaged: { text: '发现破损', color: '#f5222d' },
                  compensation_pending: { text: '待赔付', color: '#fa8c16' },
                  compensation_completed: { text: '赔付完成', color: '#52c41a' },
                  returned_from_factory: { text: '工厂送回', color: '#1890ff' },
                  restocked: { text: '库存回补', color: '#52c41a' },
                  back_to_room: { text: '返回房间', color: '#52c41a' }
                };
                const config = statusMap[item.status] || { text: item.status, color: '#8c8c8c' };
                const total = statusCounts.reduce((sum, i) => sum + i.count, 0);
                const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
                
                return (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Tag color={config.color}>{config.text}</Tag>
                        <span>{item.count} 件 ({percent}%)</span>
                      </div>
                      <Progress percent={percent} strokeColor={config.color} showInfo={false} />
                    </div>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
        
        <Col span={12}>
          <Card title="破损类型统计" className="card-content">
            <List
              dataSource={damageByType}
              renderItem={(item) => {
                const colorMap = { '轻微': '#52c41a', '中度': '#faad14', '严重': '#f5222d' };
                return (
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>
                        <Tag color={colorMap[item.damage_level]}>{item.damage_level}</Tag>
                        {item.damage_type}
                      </span>
                      <span style={{ fontWeight: 'bold' }}>{item.count} 件</span>
                    </div>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="赔付进度" className="card-content">
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Statistic 
              title="待扣减金额" 
              value={(compensationSummary.total_amount || 0) - (compensationSummary.deducted_amount || 0)}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
          <Col span={12}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: 8 }}>扣减进度</div>
              <Progress 
                percent={
                  compensationSummary.total_amount > 0 
                    ? Math.round((compensationSummary.deducted_amount / compensationSummary.total_amount) * 100) 
                    : 0
                } 
                strokeColor="#52c41a"
                size="large"
              />
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default StatisticsPage;