import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Card, message, Descriptions } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getSLARules, getCallbackTargets } from '../api';
import { SLARule, CallbackTarget } from '../types';

const Settings: React.FC = () => {
  const [slaRules, setSlaRules] = useState<SLARule[]>([]);
  const [callbackTargets, setCallbackTargets] = useState<CallbackTarget[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rules, targets] = await Promise.all([
        getSLARules(),
        getCallbackTargets()
      ]);
      setSlaRules(rules);
      setCallbackTargets(targets);
    } catch (error) {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const slaColumns = [
    {
      title: '规则ID',
      dataIndex: 'id',
      key: 'id',
      width: 150
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => <Tag>{priority}</Tag>
    },
    {
      title: '超时时间',
      dataIndex: 'timeoutMinutes',
      key: 'timeoutMinutes',
      width: 120,
      render: (minutes: number) => `${minutes} 分钟`
    },
    {
      title: '警告时间',
      dataIndex: 'warningMinutes',
      key: 'warningMinutes',
      width: 120,
      render: (minutes?: number) => minutes ? `${minutes} 分钟` : '-'
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      )
    }
  ];

  const targetColumns = [
    {
      title: '目标ID',
      dataIndex: 'id',
      key: 'id',
      width: 150
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: 250,
      ellipsis: true
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (method: string) => <Tag color="blue">{method}</Tag>
    },
    {
      title: '超时',
      dataIndex: 'timeoutMs',
      key: 'timeoutMs',
      width: 100,
      render: (ms: number) => `${ms}ms`
    },
    {
      title: '最大重试',
      dataIndex: 'maxRetries',
      key: 'maxRetries',
      width: 100
    },
    {
      title: '重试间隔',
      dataIndex: 'retryIntervalMs',
      key: 'retryIntervalMs',
      width: 120,
      render: (ms: number) => `${ms}ms`
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      )
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>配置管理</h2>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </Space>

      <Card title="SLA 规则" style={{ marginBottom: 16 }}>
        <Table
          columns={slaColumns}
          dataSource={slaRules}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Card title="回调目标">
        <Table
          columns={targetColumns}
          dataSource={callbackTargets}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Card title="系统说明" style={{ marginTop: 16 }}>
        <Descriptions column={1}>
          <Descriptions.Item label="功能说明">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>SLA 超时事件会自动推送到所有启用的回调目标</li>
              <li>回调失败会自动重试，达到最大重试次数后标记为失败</li>
              <li>可以手动发起重试，系统会创建补发批次</li>
              <li>重复事件Key会被去重，避免重复推送</li>
              <li>所有回调响应都会被记录，可查看详细错误信息</li>
              <li>支持按条件筛选和导出数据</li>
            </ul>
          </Descriptions.Item>
          <Descriptions.Item label="API 接口">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>POST /api/events - 创建超时事件</li>
              <li>GET /api/events - 查询事件列表</li>
              <li>GET /api/events/{'{id}'} - 获取事件详情</li>
              <li>POST /api/events/{'{id}'}/retry - 手动重试事件</li>
              <li>GET /api/export/events - 导出事件数据</li>
              <li>GET /api/sla-rules - 获取SLA规则列表</li>
              <li>GET /api/callback-targets - 获取回调目标列表</li>
            </ul>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default Settings;
