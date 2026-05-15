import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Card, Tag, Select, Input, Modal, Form, message, Popconfirm, Descriptions, Badge } from 'antd';
import { ReloadOutlined, SearchOutlined, EyeOutlined, ToolOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ status: '' });
  const [detailVisible, setDetailVisible] = useState(false);
  const [compensateVisible, setCompensateVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [compensateForm] = Form.useForm();

  const fetchHistory = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize, ...filters };
      if (!filters.status) delete params.status;
      
      const res = await axios.get('/api/history', { params });
      if (res.data.success) {
        setHistory(res.data.data);
        setPagination({
          current: page,
          pageSize,
          total: res.data.total
        });
      }
    } catch (error) {
      message.error('获取历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [filters]);

  const handleTableChange = (pag) => {
    fetchHistory(pag.current, pag.pageSize);
  };

  const handleViewDetail = (record) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  const handleCompensate = (record) => {
    setSelectedRecord(record);
    compensateForm.setFieldsValue({
      responseBody: JSON.stringify(record.responseBody, null, 2),
      statusCode: record.responseStatusCode
    });
    setCompensateVisible(true);
  };

  const handleCompensateSubmit = async (values) => {
    try {
      let responseBody = values.responseBody;
      try {
        responseBody = JSON.parse(values.responseBody);
      } catch (e) {
        // 保持原样
      }
      
      await axios.post(`/api/history/${selectedRecord.id}/compensate`, {
        responseBody,
        statusCode: values.statusCode,
        compensatedBy: 'manual'
      });
      
      message.success('补偿成功');
      setCompensateVisible(false);
      fetchHistory(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error(error.response?.data?.error || '补偿失败');
    }
  };

  const handleExport = async () => {
    try {
      const res = await axios.get('/api/history/export');
      if (res.data.success) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mock-history-${dayjs().format('YYYYMMDDHHmmss')}.json`;
        a.click();
        message.success('导出成功');
      }
    } catch (error) {
      message.error('导出失败');
    }
  };

  const statusColors = {
    success: 'green',
    failed: 'red',
    no_match: 'orange',
    compensated: 'blue'
  };

  const statusLabels = {
    success: '成功',
    failed: '失败',
    no_match: '无匹配',
    compensated: '已补偿'
  };

  const columns = [
    {
      title: '请求路径',
      dataIndex: 'requestPath',
      key: 'requestPath',
      ellipsis: true,
      width: 200,
      render: (text) => <code style={{ fontSize: '12px' }}>{text}</code>
    },
    {
      title: '方法',
      dataIndex: 'requestMethod',
      key: 'requestMethod',
      width: 80,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '成功', value: 'success' },
        { text: '失败', value: 'failed' },
        { text: '无匹配', value: 'no_match' },
        { text: '已补偿', value: 'compensated' }
      ],
      render: (status) => (
        <Space>
          <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
          {status === 'compensated' && <Badge status="processing" />}
        </Space>
      )
    },
    {
      title: 'HTTP 状态码',
      dataIndex: 'responseStatusCode',
      key: 'responseStatusCode',
      width: 120,
      render: (code) => (
        <Tag color={code >= 400 ? 'red' : 'green'}>{code}</Tag>
      )
    },
    {
      title: '匹配场景',
      dataIndex: 'matchedSceneName',
      key: 'matchedSceneName',
      ellipsis: true,
      width: 150,
      render: (text) => text || '-'
    },
    {
      title: '延迟(ms)',
      dataIndex: 'responseDelay',
      key: 'responseDelay',
      width: 100,
      sorter: (a, b) => a.responseDelay - b.responseDelay
    },
    {
      title: '失败原因',
      dataIndex: 'failureReason',
      key: 'failureReason',
      ellipsis: true,
      width: 200,
      render: (text) => text ? (
        <Tag color="red" style={{ maxWidth: '100%' }}>
          {text}
        </Tag>
      ) : '-'
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (time) => dayjs(time).format('MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {!record.isCompensated && (
            <Button type="link" size="small" icon={<ToolOutlined />} onClick={() => handleCompensate(record)}>
              补偿
            </Button>
          )}
          {record.isCompensated && (
            <Tag color="blue">已补偿</Tag>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="回放历史"
        extra={
          <Space>
            <Select
              placeholder="筛选状态"
              style={{ width: 150 }}
              allowClear
              value={filters.status || undefined}
              onChange={(value) => setFilters({ ...filters, status: value || '' })}
            >
              <Option value="success">成功</Option>
              <Option value="failed">失败</Option>
              <Option value="no_match">无匹配</Option>
              <Option value="compensated">已补偿</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => fetchHistory()}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={history}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 1300 }}
          size="small"
        />
      </Card>

      <Modal
        title="请求详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={800}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="请求路径">{selectedRecord.requestPath}</Descriptions.Item>
            <Descriptions.Item label="请求方法">{selectedRecord.requestMethod}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[selectedRecord.status]}>{statusLabels[selectedRecord.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="HTTP 状态码">{selectedRecord.responseStatusCode}</Descriptions.Item>
            <Descriptions.Item label="匹配场景">{selectedRecord.matchedSceneName || '-'}</Descriptions.Item>
            <Descriptions.Item label="响应延迟">{selectedRecord.responseDelay}ms</Descriptions.Item>
            {selectedRecord.failureReason && (
              <Descriptions.Item label="失败原因" labelStyle={{ color: 'red' }}>
                <span style={{ color: 'red' }}>{selectedRecord.failureReason}</span>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="请求时间">{dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            {selectedRecord.isCompensated && (
              <>
                <Descriptions.Item label="补偿时间">{dayjs(selectedRecord.compensatedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                <Descriptions.Item label="补偿人">{selectedRecord.compensatedBy}</Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="请求头">
              <pre style={{ fontSize: '12px', maxHeight: 200, overflow: 'auto' }}>
                {JSON.stringify(selectedRecord.requestHeaders, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="响应体">
              <pre style={{ fontSize: '12px', maxHeight: 300, overflow: 'auto' }}>
                {JSON.stringify(selectedRecord.responseBody, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title="人工补偿"
        open={compensateVisible}
        onCancel={() => setCompensateVisible(false)}
        onOk={() => compensateForm.submit()}
        width={700}
      >
        <Form form={compensateForm} layout="vertical" onFinish={handleCompensateSubmit}>
          <Form.Item name="statusCode" label="HTTP 状态码" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="responseBody" label="响应体 (JSON)">
            <TextArea rows={10} placeholder="请输入 JSON 格式的响应体" />
          </Form.Item>
          <div style={{ color: '#666', fontSize: '12px' }}>
            提示：补偿后该记录状态将标记为"已补偿"，并记录补偿人和补偿时间
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default History;
