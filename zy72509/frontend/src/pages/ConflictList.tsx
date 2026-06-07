import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, message, Popconfirm, Card, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { getConflicts, confirmRecord, rejectRecord, sendToAlgorithmReview } from '../api';
import { AnnotationRecord, ReviewStatus, statusText, statusColor } from '../types';

interface ConflictItem {
  record: AnnotationRecord;
  evidence: string[];
}

function ConflictList() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getConflicts();
      setConflicts(data);
    } catch (e) {
      message.error('获取冲突数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfirm = async (id: string) => {
    try {
      await confirmRecord(id);
      message.success('已确认该记录');
      fetchData();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectRecord(id);
      message.success('已驳回该记录');
      fetchData();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleAlgorithmReview = async (id: string) => {
    try {
      await sendToAlgorithmReview(id);
      message.success('已发送算法复核');
      fetchData();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const columns: ColumnsType<ConflictItem> = [
    {
      title: '会话ID',
      dataIndex: ['record', 'session_id'],
      key: 'session_id',
      width: 140,
    },
    {
      title: '用户问题',
      dataIndex: ['record', 'user_query'],
      key: 'user_query',
      width: 180,
      ellipsis: true,
    },
    {
      title: '标注员留言',
      dataIndex: ['record', 'annotator_comment'],
      key: 'annotator_comment',
      width: 200,
      ellipsis: true,
      render: (text) => <Tag color="blue">{text || '-'}</Tag>,
    },
    {
      title: '模型输出',
      dataIndex: ['record', 'model_output'],
      key: 'model_output',
      width: 200,
      ellipsis: true,
      render: (text) => <Tag color="purple">{text || '-'}</Tag>,
    },
    {
      title: '冲突证据',
      key: 'evidence',
      width: 300,
      render: (_, item) => (
        <div>
          {item.evidence.map((e, i) => (
            <div key={i} style={{ color: '#fa8c16', fontSize: 12, marginBottom: 4 }}>
              <ExclamationCircleOutlined style={{ marginRight: 4 }} />
              {e}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, item) => (
        <Space size="small">
          <Popconfirm
            title="确认该标注？"
            description="请确认标注员留言和模型输出的最终处理方式"
            onConfirm={() => handleConfirm(item.record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="primary" size="small" icon={<CheckOutlined />}>
              确认
            </Button>
          </Popconfirm>
          <Popconfirm
            title="驳回该标注？"
            description="标注将被标记为已驳回"
            onConfirm={() => handleReject(item.record.id)}
            okText="驳回"
            cancelText="取消"
          >
            <Button size="small" danger icon={<CloseOutlined />}>
              驳回
            </Button>
          </Popconfirm>
          <Popconfirm
            title="发送算法复核？"
            description="适用于手机号漏遮等需要算法处理的问题"
            onConfirm={() => handleAlgorithmReview(item.record.id)}
          >
            <Button size="small" style={{ borderColor: '#722ed1', color: '#722ed1' }}>
              算法复核
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="冲突处理说明"
        description={
          <div>
            <p>1. 系统自动检测标注员留言和模型输出片段的矛盾，列出冲突证据供人工判断</p>
            <p>2. <strong>不要自动拍板</strong>，请仔细阅读双方内容后选择"确认"或"驳回"</p>
            <p>3. 涉及手机号漏遮的，选择"算法复核"留给同事处理，不要直接归为正常</p>
          </div>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card
        title={`待处理冲突 (${conflicts.length})`}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={conflicts}
          rowKey={(item) => item.record.id}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条冲突`,
          }}
          scroll={{ x: 1300 }}
          locale={{ emptyText: '暂无冲突记录' }}
        />
      </Card>
    </div>
  );
}

export default ConflictList;
