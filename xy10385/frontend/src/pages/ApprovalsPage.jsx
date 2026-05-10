import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, message, Modal, Descriptions } from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api';

function ApprovalsPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getPendingApprovals();
      setPending(res.data);
    } catch (e) {
      message.error('加载待审批列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const handleApprove = (id) => {
    Modal.confirm({
      title: '确认审批通过',
      content: '确认通过该加项申请？通过后可以正常计费。',
      onOk: async () => {
        try {
          await api.approveExamination(id, { operator: '管理员' });
          message.success('审批通过');
          setRefreshKey(k => k + 1);
        } catch (e) {
          message.error('操作失败');
        }
      }
    });
  };

  const handleReject = (id) => {
    Modal.confirm({
      title: '确认拒绝',
      content: '拒绝后该加项将不计入费用，确认拒绝？',
      onOk: async () => {
        try {
          await api.rejectExamination(id, { operator: '管理员' });
          message.success('已拒绝');
          setRefreshKey(k => k + 1);
        } catch (e) {
          message.error('操作失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      render: t => <Tag color="blue">{t}</Tag>
    },
    {
      title: '患者',
      dataIndex: 'patient_name',
      key: 'patient_name'
    },
    {
      title: '加项项目',
      dataIndex: 'exam_name',
      key: 'exam_name'
    },
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department'
    },
    {
      title: '金额',
      dataIndex: 'price',
      key: 'price',
      render: v => <span style={{ color: '#f5222d' }}>¥{v}</span>
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: t => dayjs(t).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record.id)}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleReject(record.id)}
          >
            拒绝
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/orders/${record.order_id}`)}
          >
            查看订单
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="加项审批"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey(k => k + 1)}>
            刷新
          </Button>
        }
      >
        <Card type="inner" style={{ marginBottom: 16 }}>
          <Descriptions column={4}>
            <Descriptions.Item label="待审批总数">
              <Tag color="gold" style={{ fontSize: 16 }}>{pending.length}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="待处理金额">
              <span style={{ color: '#f5222d', fontSize: 16, fontWeight: 'bold' }}>
                ¥{pending.reduce((s, p) => s + (p.price || 0), 0)}
              </span>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Table
          columns={columns}
          dataSource={pending}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暂无待审批的加项' }}
        />
      </Card>

      <Card title="审批规则说明" style={{ marginTop: 16 }} type="inner">
        <p><strong>📋 加项审批规则：</strong></p>
        <ul>
          <li>陪诊员在服务过程中发现需要额外检查项目时，可以申请临时加项</li>
          <li>加项需要经过管理员审批通过后才能计入费用</li>
          <li>存在未审批加项时，订单无法进行计费结算</li>
          <li>拒绝的加项不计入费用，但记录保留供审计</li>
          <li>已结束的订单不能申请加项</li>
        </ul>
      </Card>
    </div>
  );
}

export default ApprovalsPage;
