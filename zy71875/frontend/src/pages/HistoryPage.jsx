import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tabs,
  Tag,
  Button,
  Space,
  Descriptions,
  Modal,
  Alert,
  Badge,
} from 'antd';
import {
  HistoryOutlined,
  BarChartOutlined,
  ImportOutlined,
  EditOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api.js';

function HistoryPage() {
  const [activeTab, setActiveTab] = useState('predictions');
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [importHistory, setImportHistory] = useState([]);
  const [correctionHistory, setCorrectionHistory] = useState([]);
  const [loading, setLoading] = useState({ predictions: false, imports: false, corrections: false });
  const [pagination, setPagination] = useState({
    predictions: { current: 1, pageSize: 10, total: 0 },
    imports: { current: 1, pageSize: 10, total: 0 },
    corrections: { current: 1, pageSize: 20, total: 0 },
  });
  const [showDetail, setShowDetail] = useState(null);
  const [detailType, setDetailType] = useState(null);

  useEffect(() => {
    loadPredictionHistory();
    loadImportHistory();
    loadCorrectionHistory();
  }, []);

  const loadPredictionHistory = async (page = 1, pageSize = 10) => {
    setLoading(prev => ({ ...prev, predictions: true }));
    try {
      const data = await api.get('/history/predictions', { params: { page, page_size: pageSize } });
      setPredictionHistory(data.items || []);
      setPagination(prev => ({
        ...prev,
        predictions: { current: page, pageSize, total: data.total || 0 },
      }));
    } catch (error) {
      console.error('加载预测历史失败:', error);
    } finally {
      setLoading(prev => ({ ...prev, predictions: false }));
    }
  };

  const loadImportHistory = async (page = 1, pageSize = 10) => {
    setLoading(prev => ({ ...prev, imports: true }));
    try {
      const data = await api.get('/history/imports', { params: { page, page_size: pageSize } });
      setImportHistory(data.items || []);
      setPagination(prev => ({
        ...prev,
        imports: { current: page, pageSize, total: data.total || 0 },
      }));
    } catch (error) {
      console.error('加载导入历史失败:', error);
    } finally {
      setLoading(prev => ({ ...prev, imports: false }));
    }
  };

  const loadCorrectionHistory = async (page = 1, pageSize = 20) => {
    setLoading(prev => ({ ...prev, corrections: true }));
    try {
      const data = await api.get('/history/corrections', { params: { page, page_size: pageSize } });
      setCorrectionHistory(data.items || []);
      setPagination(prev => ({
        ...prev,
        corrections: { current: page, pageSize, total: data.total || 0 },
      }));
    } catch (error) {
      console.error('加载修正历史失败:', error);
    } finally {
      setLoading(prev => ({ ...prev, corrections: false }));
    }
  };

  const viewPredictionDetail = (record) => {
    setShowDetail(record);
    setDetailType('prediction');
  };

  const viewImportDetail = (record) => {
    setShowDetail(record);
    setDetailType('import');
  };

  const predictionColumns = [
    {
      title: '批次名称',
      dataIndex: 'batch_name',
      key: 'batch_name',
      ellipsis: true,
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '日期范围',
      key: 'date_range',
      width: 220,
      render: (_, record) => (
        <span>
          {record.start_date} ~ {record.end_date}
        </span>
      ),
    },
    {
      title: '模型版本',
      dataIndex: 'model_version',
      key: 'model_version',
      width: 100,
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '处理记录数',
      dataIndex: 'total_records',
      key: 'total_records',
      width: 110,
      align: 'right',
      render: (v) => <strong>{v} 条</strong>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = {
          completed: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
          failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
          processing: { color: 'processing', icon: <ClockCircleOutlined />, text: '处理中' },
          pending: { color: 'warning', icon: <ClockCircleOutlined />, text: '等待中' },
        };
        const cfg = config[status] || { color: 'default', text: status };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.text}</Tag>;
      },
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={() => viewPredictionDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  const importColumns = [
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: true,
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '文件类型',
      dataIndex: 'file_type',
      key: 'file_type',
      width: 80,
      render: (type) => (
        <Tag color={type === 'csv' ? 'orange' : 'green'}>
          {type?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '总行数',
      dataIndex: 'total_rows',
      key: 'total_rows',
      width: 80,
      align: 'right',
    },
    {
      title: '成功',
      dataIndex: 'success_rows',
      key: 'success_rows',
      width: 70,
      align: 'right',
      render: (v) => <strong style={{ color: '#52c41a' }}>{v}</strong>,
    },
    {
      title: '失败',
      dataIndex: 'failed_rows',
      key: 'failed_rows',
      width: 70,
      align: 'right',
      render: (v) => v > 0 ? <strong style={{ color: '#ff4d4f' }}>{v}</strong> : v,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = {
          completed: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
          partial: { color: 'warning', icon: <InfoCircleOutlined />, text: '部分成功' },
          failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
          processing: { color: 'processing', icon: <ClockCircleOutlined />, text: '处理中' },
        };
        const cfg = config[status] || { color: 'default', text: status };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.text}</Tag>;
      },
    },
    {
      title: '导入人',
      dataIndex: 'imported_by',
      key: 'imported_by',
      width: 100,
    },
    {
      title: '导入时间',
      dataIndex: 'imported_at',
      key: 'imported_at',
      width: 170,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={() => viewImportDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  const correctionColumns = [
    {
      title: '记录ID',
      dataIndex: 'record_id',
      key: 'record_id',
      width: 80,
      align: 'center',
    },
    {
      title: '修改字段',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 100,
      render: (field) => {
        const names = {
          predicted_count: '预测份数',
          actual_count: '实际份数',
          price: '单价',
          dish_name: '菜品名称',
          category: '菜品分类',
          notes: '备注',
        };
        return <Tag color="blue">{names[field] || field}</Tag>;
      },
    },
    {
      title: '原值',
      dataIndex: 'old_value',
      key: 'old_value',
      width: 120,
      render: (v) => <span style={{ color: '#9ca3af', textDecoration: 'line-through' }}>{v || '（空）'}</span>,
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      width: 120,
      render: (v) => <strong style={{ color: '#52c41a' }}>{v || '（空）'}</strong>,
    },
    {
      title: '修正原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '修正人',
      dataIndex: 'corrected_by',
      key: 'corrected_by',
      width: 100,
    },
    {
      title: '修正时间',
      dataIndex: 'corrected_at',
      key: 'corrected_at',
      width: 170,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  const tabItems = [
    {
      key: 'predictions',
      label: (
        <Space>
          <BarChartOutlined />
          预测批次历史
          {predictionHistory.length > 0 && (
            <Badge count={predictionHistory.filter(h => h.status !== 'completed').length} size="small" />
          )}
        </Space>
      ),
      children: (
        <Card
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadPredictionHistory(pagination.predictions.current, pagination.predictions.pageSize)}
              size="small"
            >
              刷新
            </Button>
          }
        >
          <Table
            columns={predictionColumns}
            dataSource={predictionHistory}
            rowKey="id"
            loading={loading.predictions}
            pagination={{
              ...pagination.predictions,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条记录`,
              onChange: (page, pageSize) => loadPredictionHistory(page, pageSize),
            }}
            scroll={{ x: 900 }}
          />
        </Card>
      ),
    },
    {
      key: 'imports',
      label: (
        <Space>
          <ImportOutlined />
          文件导入历史
        </Space>
      ),
      children: (
        <Card
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadImportHistory(pagination.imports.current, pagination.imports.pageSize)}
              size="small"
            >
              刷新
            </Button>
          }
        >
          <Table
            columns={importColumns}
            dataSource={importHistory}
            rowKey="id"
            loading={loading.imports}
            pagination={{
              ...pagination.imports,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条记录`,
              onChange: (page, pageSize) => loadImportHistory(page, pageSize),
            }}
            scroll={{ x: 900 }}
          />
        </Card>
      ),
    },
    {
      key: 'corrections',
      label: (
        <Space>
          <EditOutlined />
          数据修正历史
        </Space>
      ),
      children: (
        <Card
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadCorrectionHistory(pagination.corrections.current, pagination.corrections.pageSize)}
              size="small"
            >
              刷新
            </Button>
          }
        >
          <Alert
            message="这里记录了所有数据修正操作，每条修改都有完整的操作留痕"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            columns={correctionColumns}
            dataSource={correctionHistory}
            rowKey="id"
            loading={loading.corrections}
            pagination={{
              ...pagination.corrections,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条记录`,
              onChange: (page, pageSize) => loadCorrectionHistory(page, pageSize),
            }}
            scroll={{ x: 900 }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">历史记录</h1>
        <p className="page-subtitle">查看所有预测批次、文件导入和数据修正的历史记录</p>
      </div>

      <Card className="card-section">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>

      <Modal
        title={detailType === 'prediction' ? '预测批次详情' : '导入记录详情'}
        open={!!showDetail}
        onCancel={() => {
          setShowDetail(null);
          setDetailType(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setShowDetail(null);
              setDetailType(null);
            }}
          >
            关闭
          </Button>,
        ]}
        width={700}
      >
        {showDetail && detailType === 'prediction' && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="批次名称" span={2}>
                {showDetail.batch_name}
              </Descriptions.Item>
              <Descriptions.Item label="批次ID">
                <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                  {showDetail.batch_id}
                </code>
              </Descriptions.Item>
              <Descriptions.Item label="模型版本">
                <Tag color="blue">{showDetail.model_version}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="开始日期">
                {showDetail.start_date}
              </Descriptions.Item>
              <Descriptions.Item label="结束日期">
                {showDetail.end_date}
              </Descriptions.Item>
              <Descriptions.Item label="处理记录数">
                <strong>{showDetail.total_records} 条</strong>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {showDetail.status === 'completed' ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>
                ) : showDetail.status === 'failed' ? (
                  <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>
                ) : (
                  <Tag color="processing" icon={<ClockCircleOutlined />}>处理中</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {showDetail.created_by}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {showDetail.created_at && dayjs(showDetail.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {showDetail.completed_at && (
                <Descriptions.Item label="完成时间" span={2}>
                  {dayjs(showDetail.completed_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
            </Descriptions>
            {showDetail.error_message && (
              <Alert
                message="错误信息"
                description={showDetail.error_message}
                type="error"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </div>
        )}

        {showDetail && detailType === 'import' && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="文件名" span={2}>
                {showDetail.file_name}
              </Descriptions.Item>
              <Descriptions.Item label="导入ID">
                <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                  {showDetail.import_id}
                </code>
              </Descriptions.Item>
              <Descriptions.Item label="文件类型">
                <Tag color={showDetail.file_type === 'csv' ? 'orange' : 'green'}>
                  {showDetail.file_type?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="总行数">
                {showDetail.total_rows} 行
              </Descriptions.Item>
              <Descriptions.Item label="成功行数">
                <strong style={{ color: '#52c41a' }}>{showDetail.success_rows} 行</strong>
              </Descriptions.Item>
              <Descriptions.Item label="失败行数">
                <strong style={{ color: showDetail.failed_rows > 0 ? '#ff4d4f' : 'inherit' }}>
                  {showDetail.failed_rows} 行
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {showDetail.status === 'completed' ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>全部成功</Tag>
                ) : showDetail.status === 'partial' ? (
                  <Tag color="warning" icon={<InfoCircleOutlined />}>部分成功</Tag>
                ) : showDetail.status === 'failed' ? (
                  <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>
                ) : (
                  <Tag color="processing" icon={<ClockCircleOutlined />}>处理中</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="导入人">
                {showDetail.imported_by}
              </Descriptions.Item>
              <Descriptions.Item label="导入时间" span={2}>
                {showDetail.imported_at && dayjs(showDetail.imported_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
            {showDetail.error_details && (
              <Alert
                message="错误详情"
                description={
                  <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', margin: 0, marginTop: 8 }}>
                    {showDetail.error_details}
                  </pre>
                }
                type="error"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default HistoryPage;
