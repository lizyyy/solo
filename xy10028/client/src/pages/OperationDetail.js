import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Button, Space, message, Tabs, Row, Col, Tag } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons';
import operationService from '../services/operationService';
import dayjs from 'dayjs';

const { TabPane } = Tabs;

function OperationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [operation, setOperation] = useState(null);
  const [replayData, setReplayData] = useState(null);
  const [loading, setLoading] = useState(true);

  const operationTypeMap = {
    CREATE: { color: 'green', label: '创建' },
    UPDATE: { color: 'blue', label: '更新' },
    ADJUST: { color: 'orange', label: '调整' },
    TRANSFER_IN: { color: 'cyan', label: '调入' },
    TRANSFER_OUT: { color: 'purple', label: '调出' },
    PRICE_CHANGE: { color: 'magenta', label: '改价' }
  };

  const statusMap = {
    SUCCESS: { color: 'green', label: '成功' },
    FAILED: { color: 'red', label: '失败' },
    PENDING: { color: 'orange', label: '处理中' },
    ROLLED_BACK: { color: 'gold', label: '已回滚' }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [opRes, replayRes] = await Promise.all([
        operationService.getOperationById(id),
        operationService.replayOperation(id)
      ]);

      if (opRes.success) {
        setOperation(opRes.data);
      }
      if (replayRes.success) {
        setReplayData(replayRes.data);
      }
    } catch (error) {
      message.error('加载操作详情失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}>加载中...</div>;
  }

  if (!operation) {
    return <div style={{ textAlign: 'center', padding: 50 }}>操作记录不存在</div>;
  }

  const typeInfo = operationTypeMap[operation.operationType] || { color: 'default', label: operation.operationType };
  const statusInfo = statusMap[operation.status] || { color: 'default', label: operation.status };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/operations')}>
          返回列表
        </Button>
        <h2 style={{ margin: 0 }}>操作详情</h2>
        <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
        <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
      </Space>

      <Tabs defaultActiveKey="1">
        <TabPane tab="基本信息" key="1">
          <Card title="操作信息">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="序号">{operation.sequence}</Descriptions.Item>
              <Descriptions.Item label="请求ID">
                <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                  {operation.requestId}
                </code>
              </Descriptions.Item>
              <Descriptions.Item label="操作类型">{typeInfo.label}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusInfo.label}</Descriptions.Item>
              <Descriptions.Item label="操作人">{operation.User?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="操作时间">
                {dayjs(operation.operationAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="门店" span={2}>
                {operation.Inventory?.Store?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="商品" span={2}>
                {operation.Inventory?.Product?.name || '-'} ({operation.Inventory?.Product?.sku || '-'})
              </Descriptions.Item>
              {operation.errorMessage && (
                <Descriptions.Item label="错误信息" span={2}>
                  <span style={{ color: 'red' }}>{operation.errorMessage}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </TabPane>

        <TabPane tab="状态变化" key="2">
          <Row gutter={16}>
            <Col span={12}>
              <Card title="变更前状态" style={{ background: '#fff7e6' }}>
                <pre style={{ margin: 0, background: 'white', padding: 16, borderRadius: 4 }}>
                  {JSON.stringify(operation.beforeState, null, 2)}
                </pre>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="变更后状态" style={{ background: '#f6ffed' }}>
                <pre style={{ margin: 0, background: 'white', padding: 16, borderRadius: 4 }}>
                  {JSON.stringify(operation.afterState, null, 2)}
                </pre>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="变更详情" key="3">
          <Card title="详细变更记录">
            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, margin: 0 }}>
              {JSON.stringify(operation.changeDetails, null, 2)}
            </pre>
          </Card>
        </TabPane>

        {replayData && (
          <TabPane tab={
            <Space>
              <PlayCircleOutlined />
              <span>操作回放</span>
            </Space>
          } key="4">
            <Card title="回放信息">
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="操作人">
                    <p style={{ fontSize: 18, margin: 0 }}>{replayData.replayInfo.operator}</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="操作时间">
                    <p style={{ fontSize: 18, margin: 0 }}>
                      {dayjs(replayData.replayInfo.operationTime).format('YYYY-MM-DD HH:mm:ss')}
                    </p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="操作结果">
                    <Tag color={statusMap[replayData.replayInfo.status]?.color || 'default'}>
                      {statusMap[replayData.replayInfo.status]?.label || replayData.replayInfo.status}
                    </Tag>
                  </Card>
                </Col>
              </Row>

              <Card 
                size="small" 
                title="状态变更" 
                style={{ marginTop: 16 }}
                extra={
                  <Button onClick={loadData} icon={<PlayCircleOutlined />}>
                    重新加载回放
                  </Button>
                }
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <h4>变更前</h4>
                    <ul>
                      <li>库存数量: {replayData.beforeState?.quantity ?? '-'}</li>
                      <li>价格: {replayData.beforeState?.price !== undefined 
                        ? `¥${Number(replayData.beforeState.price).toFixed(2)}` 
                        : '-'}</li>
                      <li>版本号: {replayData.beforeState?.version ?? '-'}</li>
                    </ul>
                  </Col>
                  <Col span={12}>
                    <h4>变更后</h4>
                    <ul>
                      <li>库存数量: {replayData.afterState?.quantity ?? '-'}</li>
                      <li>价格: {replayData.afterState?.price !== undefined 
                        ? `¥${Number(replayData.afterState.price).toFixed(2)}` 
                        : '-'}</li>
                      <li>版本号: {replayData.afterState?.version ?? '-'}</li>
                    </ul>
                  </Col>
                </Row>
              </Card>
            </Card>
          </TabPane>
        )}
      </Tabs>
    </div>
  );
}

export default OperationDetail;
