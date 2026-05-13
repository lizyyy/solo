import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Button, Space, Timeline, Tag, message, Row, Col, Statistic } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, CheckCircleOutlined, AuditOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { workOrderAPI } from '../services/api';
import dayjs from 'dayjs';

const statusMap: { [key: string]: { text: string; color: string } } = {
  pending: { text: '待处理', color: 'default' },
  assigned: { text: '已分派', color: 'blue' },
  processing: { text: '处理中', color: 'orange' },
  reviewing: { text: '复核中', color: 'purple' },
  completed: { text: '已完成', color: 'green' },
  rejected: { text: '已拒绝', color: 'red' },
  blocked: { text: '已拦截', color: 'red' }
};

const sceneMap: { [key: string]: { text: string; color: string } } = {
  normal: { text: '正常流程', color: 'green' },
  blocked: { text: '规则拦截', color: 'red' },
  review: { text: '人工复核', color: 'orange' },
  duplicate: { text: '重复提交', color: 'purple' }
};

const operationTypeMap: { [key: string]: string } = {
  create: '创建工单',
  update: '更新工单',
  assign: '分派工单',
  process: '开始处理',
  complete: '完成处理',
  review: '审核工单',
  block: '拦截工单',
  follow_up: '回访记录',
  export: '数据导出'
};

const WorkOrderDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDetail(id);
      fetchLogs(id);
    }
  }, [id]);

  const fetchDetail = async (orderId: string) => {
    try {
      const res = await workOrderAPI.getById(orderId);
      setOrder(res.data);
    } catch (error) {
      message.error('获取工单详情失败');
    }
  };

  const fetchLogs = async (orderId: string) => {
    try {
      const res = await workOrderAPI.getLogs(orderId);
      setLogs(res.data);
    } catch (error) {
      console.error('获取操作日志失败', error);
    }
  };

  const handleProcess = async () => {
    if (!id) return;
    try {
      await workOrderAPI.process(id, {
        operatorId: 'user-001',
        operatorName: '当前用户',
        description: '开始处理工单'
      });
      message.success('处理成功');
      fetchDetail(id);
      fetchLogs(id);
    } catch (error) {
      message.error('处理失败');
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    try {
      await workOrderAPI.complete(id, {
        operatorId: 'user-001',
        operatorName: '当前用户',
        completionNote: '工单已完成处理'
      });
      message.success('完成成功');
      fetchDetail(id);
      fetchLogs(id);
    } catch (error) {
      message.error('完成失败');
    }
  };

  const handleReview = async (approved: boolean) => {
    if (!id) return;
    try {
      await workOrderAPI.review(id, {
        operatorId: 'user-001',
        operatorName: '当前用户',
        approved,
        comment: approved ? '复核通过，可以处理' : '复核不通过，退回'
      });
      message.success('复核完成');
      fetchDetail(id);
      fetchLogs(id);
    } catch (error) {
      message.error('复核失败');
    }
  };

  if (!order) {
    return <div>加载中...</div>;
  }

  const statusInfo = statusMap[order.status] || { text: order.status, color: 'default' };
  const sceneInfo = sceneMap[order.scene] || { text: order.scene, color: 'default' };

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="工单状态" value={statusInfo.text} prefix={<Tag color={statusInfo.color} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="处理场景" value={sceneInfo.text} prefix={<Tag color={sceneInfo.color} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="创建时间" value={dayjs(order.createdAt).format('MM-DD HH:mm')} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="完成时间" value={order.completedAt ? dayjs(order.completedAt).format('MM-DD HH:mm') : '未完成'} />
          </Card>
        </Col>
      </Row>

      <Card title="工单详情" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="工单编号">{order.orderNo}</Descriptions.Item>
          <Descriptions.Item label="优先级">{order.priority}</Descriptions.Item>
          <Descriptions.Item label="是否紧急">{order.isUrgent ? '是' : '否'}</Descriptions.Item>
          <Descriptions.Item label="网格编码">{order.gridCode}</Descriptions.Item>
          <Descriptions.Item label="问题描述" span={2}>{order.description}</Descriptions.Item>
          {order.blockerReason && (
            <Descriptions.Item label="拦截原因" span={2}><Tag color="red">{order.blockerReason}</Tag></Descriptions.Item>
          )}
          {order.reviewerComment && (
            <Descriptions.Item label="复核意见" span={2}>{order.reviewerComment}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {order.status !== 'completed' && order.status !== 'blocked' && order.status !== 'rejected' && (
        <Card title="操作" style={{ marginBottom: 16 }}>
          <Space>
            {order.status === 'reviewing' && (
              <>
                <Button type="primary" icon={<AuditOutlined />} onClick={() => handleReview(true)}>
                  复核通过
                </Button>
                <Button danger icon={<AuditOutlined />} onClick={() => handleReview(false)}>
                  复核拒绝
                </Button>
              </>
            )}
            {(order.status === 'assigned' || order.status === 'pending') && (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleProcess}>
                开始处理
              </Button>
            )}
            {order.status === 'processing' && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleComplete}>
                完成处理
              </Button>
            )}
          </Space>
        </Card>
      )}

      <Card title="时间线">
        <Timeline>
          {logs.slice().reverse().map((log: any, index: number) => (
            <Timeline.Item key={log.id}>
              <p>
                <strong>{operationTypeMap[log.operationType] || log.operationType}</strong>
                <span style={{ marginLeft: 8, color: '#666' }}>
                  操作人: {log.operatorName}
                </span>
              </p>
              <p style={{ color: '#888', marginBottom: 0 }}>{log.description}</p>
              <p style={{ color: '#aaa', fontSize: 12, marginBottom: 0 }}>
                {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </p>
            </Timeline.Item>
          ))}
          {logs.length === 0 && (
            <Timeline.Item>暂无操作记录</Timeline.Item>
          )}
        </Timeline>
      </Card>
    </div>
  );
};

export default WorkOrderDetail;
