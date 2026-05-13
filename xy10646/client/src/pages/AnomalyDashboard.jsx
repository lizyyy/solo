import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, List, Tag, message } from 'antd';
import { ClockCircleOutlined, WarningOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';

function AnomalyDashboard() {
  const [anomalies, setAnomalies] = useState({
    timeoutFlows: [],
    abnormalTests: [],
    rejectedSamples: []
  });
  const [loading, setLoading] = useState(false);

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/anomalies');
      setAnomalies(response.data.data);
    } catch (error) {
      message.error('获取异常数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>异常看板</h2>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="超时接收"
              value={anomalies.timeoutFlows.length}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="检测异常"
              value={anomalies.abnormalTests.length}
              prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已拒收"
              value={anomalies.rejectedSamples.length}
              prefix={<StopOutlined style={{ color: '#ff7a45' }} />}
              valueStyle={{ color: '#ff7a45' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={8}>
          <Card title="超时接收记录" loading={loading}>
            <List
              dataSource={anomalies.timeoutFlows}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <div>
                        <Tag color="orange">超时</Tag>
                        <span>{item.SampleRecord?.sampleCode}</span>
                      </div>
                    }
                    description={
                      <div>
                        <div>采样点: {item.SampleRecord?.SamplingPoint?.name}</div>
                        <div>操作人: {item.operator}</div>
                        <div>操作时间: {dayjs(item.operationTime).format('YYYY-MM-DD HH:mm')}</div>
                        {item.timeoutReason && (
                          <div style={{ color: 'red', marginTop: 4 }}>
                            原因: {item.timeoutReason}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="检测异常记录" loading={loading}>
            <List
              dataSource={anomalies.abnormalTests}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <div>
                        <Tag color="red">异常</Tag>
                        <span>{item.itemName}</span>
                      </div>
                    }
                    description={
                      <div>
                        <div>样品: {item.SampleRecord?.sampleCode}</div>
                        <div>采样点: {item.SampleRecord?.SamplingPoint?.name}</div>
                        <div>标准值: {item.expectedValue}</div>
                        <div>检测值: {item.actualValue}</div>
                        <div>检测人: {item.tester}</div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="已拒收样品" loading={loading}>
            <List
              dataSource={anomalies.rejectedSamples}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <div>
                        <Tag color="volcano">拒收</Tag>
                        <span>{item.sampleCode}</span>
                      </div>
                    }
                    description={
                      <div>
                        <div>采样点: {item.SamplingPoint?.name}</div>
                        <div>采样时间: {dayjs(item.samplingTime).format('YYYY-MM-DD HH:mm')}</div>
                        <div>采样人: {item.sampler}</div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default AnomalyDashboard;
