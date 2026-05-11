import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Upload,
  message,
  Space,
  Tag,
  Modal,
  Descriptions,
  Progress,
  Empty,
  Spin,
  Typography,
  Divider,
} from 'antd';
import {
  UploadOutlined,
  EyeOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { billApi, anomalyApi } from '../services/api';
import {
  BILL_IMPORT_STATUS_LABELS,
  BILL_IMPORT_STATUS_COLORS,
  ANOMALY_TYPE_LABELS,
  ANOMALY_TYPES,
  CLOUD_PROVIDER_LABELS,
} from '../utils/constants';
import { formatCurrency, formatPercent, getCurrentMonth, isFinance } from '../utils/helpers';

const { Title, Text } = Typography;

function BillImport({ user }) {
  const [loading, setLoading] = useState(false);
  const [imports, setImports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [selectedImport, setSelectedImport] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [anomalyStats, setAnomalyStats] = useState({});

  const canImport = isFinance(user?.role);

  useEffect(() => {
    loadImports();
    loadAnomalyStats();
  }, [pagination.page, pagination.pageSize]);

  const loadImports = async () => {
    setLoading(true);
    try {
      const response = await billApi.getImports({
        page: pagination.page,
        pageSize: pagination.pageSize,
      });
      if (response.data.success) {
        setImports(response.data.data);
        setPagination(p => ({
          ...p,
          total: response.data.pagination?.total || 0,
        }));
      }
    } catch (error) {
      message.error('加载导入记录失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAnomalyStats = async () => {
    try {
      const response = await anomalyApi.getStats({ billMonth: getCurrentMonth() });
      if (response.data.success) {
        setAnomalyStats(response.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const uploadProps = {
    name: 'file',
    accept: '.csv,.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      const validTypes = ['.csv', '.xlsx', '.xls'];
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!validTypes.includes(ext)) {
        message.error('仅支持 CSV 或 Excel 文件');
        return false;
      }
      return true;
    },
    customRequest: async ({ file }) => {
      const formData = new FormData();
      formData.append('file', file);

      setUploading(true);
      try {
        const response = await billApi.importBill(formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        if (response.data.success) {
          const result = response.data.data;
          if (result.status === 'duplicate') {
            message.warning('检测到重复导入，已跳过');
          } else {
            message.success(
              `导入成功！共 ${result.totalRecords} 条，成功 ${result.successRecords} 条`
            );
            if (result.anomalyCount > 0) {
              message.info(`检测到 ${result.anomalyCount} 个异常，请在异常处理页面查看`);
            }
          }
          loadImports();
          loadAnomalyStats();
        } else {
          message.error(response.data.message || '导入失败');
        }
      } catch (error) {
        message.error(error.response?.data?.message || '导入失败');
      } finally {
        setUploading(false);
      }
    },
  };

  const handleViewDetail = async (record) => {
    try {
      const response = await billApi.getImport(record.id);
      if (response.data.success) {
        setSelectedImport(response.data.data);
        setDetailVisible(true);
      }
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const columns = [
    {
      title: '导入时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => new Date(text).toLocaleString('zh-CN'),
      width: 180,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
    },
    {
      title: '云厂商',
      dataIndex: 'cloudProvider',
      key: 'cloudProvider',
      width: 120,
      render: (v) => CLOUD_PROVIDER_LABELS[v] || '未知',
    },
    {
      title: '账单月份',
      dataIndex: 'billMonth',
      key: 'billMonth',
      width: 120,
    },
    {
      title: '记录数',
      dataIndex: 'totalRecords',
      key: 'totalRecords',
      width: 100,
    },
    {
      title: '成功',
      dataIndex: 'successRecords',
      key: 'successRecords',
      width: 80,
      render: (v, record) => (
        <Text type={v === record.totalRecords ? 'success' : 'warning'}>
          {v}
        </Text>
      ),
    },
    {
      title: '异常数',
      dataIndex: 'anomalyCount',
      key: 'anomalyCount',
      width: 80,
      render: (v) => (
        <Text type={v > 0 ? 'danger' : 'secondary'}>
          {v || 0}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => (
        <Tag color={BILL_IMPORT_STATUS_COLORS[status]}>
          {BILL_IMPORT_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h2 className="page-header-title">账单导入</h2>
          <p className="page-header-desc">导入云厂商账单，系统将自动匹配项目和标签</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadImports}>
            刷新
          </Button>
          {canImport && (
            <Upload {...uploadProps}>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={uploading}
              >
                导入账单
              </Button>
            </Upload>
          )}
        </Space>
      </div>

      <div style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
        <Card
          size="small"
          style={{ flex: 1 }}
          cover={
            <div
              style={{
                padding: 16,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
              }}
            >
              <CloudServerOutlined style={{ fontSize: 24, marginBottom: 8 }} />
              <div style={{ fontSize: 24, fontWeight: 600 }}>
                {formatCurrency(anomalyStats.totalCost || 0)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>本月总费用</div>
            </div>
          }
        />
        <Card
          size="small"
          style={{ flex: 1 }}
          cover={
            <div
              style={{
                padding: 16,
                background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                color: 'white',
              }}
            >
              <CheckCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
              <div style={{ fontSize: 24, fontWeight: 600 }}>
                {formatPercent(anomalyStats.autoAllocRate || 0)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>自动分配率</div>
            </div>
          }
        />
        <Card
          size="small"
          style={{ flex: 1 }}
          cover={
            <div
              style={{
                padding: 16,
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
              }}
            >
              <InfoCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
              <div style={{ fontSize: 24, fontWeight: 600 }}>
                {anomalyStats.noTagsCount || 0}
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>无标签资源</div>
            </div>
          }
        />
        <Card
          size="small"
          style={{ flex: 1 }}
          cover={
            <div
              style={{
                padding: 16,
                background: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
                color: 'white',
              }}
            >
              <AlertOutlined style={{ fontSize: 24, marginBottom: 8 }} />
              <div style={{ fontSize: 24, fontWeight: 600 }}>
                {anomalyStats.totalAnomalies || 0}
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>待处理异常</div>
            </div>
          }
        />
      </div>

      <Card>
        <Table
          dataSource={imports}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            onChange: (page, pageSize) =>
              setPagination((p) => ({ ...p, page, pageSize })),
          }}
          locale={{ emptyText: <Empty description="暂无导入记录" /> }}
        />
      </Card>

      <Modal
        title="导入详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {selectedImport && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="导入时间">
                {new Date(selectedImport.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="导入人">
                {selectedImport.importedByUser?.fullName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="文件名">
                {selectedImport.fileName}
              </Descriptions.Item>
              <Descriptions.Item label="文件大小">
                {selectedImport.fileSize
                  ? (selectedImport.fileSize / 1024).toFixed(2) + ' KB'
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="云厂商">
                {CLOUD_PROVIDER_LABELS[selectedImport.cloudProvider] || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="账单月份">
                {selectedImport.billMonth || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="处理状态">
                <Tag color={BILL_IMPORT_STATUS_COLORS[selectedImport.status]}>
                  {BILL_IMPORT_STATUS_LABELS[selectedImport.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="总记录数">
                {selectedImport.totalRecords}
              </Descriptions.Item>
              <Descriptions.Item label="成功处理" span={2}>
                <Progress
                  percent={Math.round(
                    (selectedImport.successRecords / selectedImport.totalRecords) * 100
                  )}
                  format={(p) =>
                    `${selectedImport.successRecords} / ${selectedImport.totalRecords} 条 (${p}%)`
                  }
                  status={
                    selectedImport.successRecords === selectedImport.totalRecords
                      ? 'success'
                      : 'normal'
                  }
                />
              </Descriptions.Item>
              {selectedImport.status === 'duplicate' && (
                <Descriptions.Item label="重复检测" span={2}>
                  <Tag color="orange">该月份账单已导入，已自动跳过</Tag>
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedImport.records && selectedImport.records.length > 0 && (
              <>
                <Divider orientation="left">记录预览</Divider>
                <Table
                  dataSource={selectedImport.records}
                  columns={[
                    { title: '资源ID', dataIndex: 'resourceId', key: 'resourceId' },
                    { title: '资源类型', dataIndex: 'resourceType', key: 'resourceType' },
                    {
                      title: '费用',
                      dataIndex: 'cost',
                      key: 'cost',
                      render: (v) => formatCurrency(v),
                    },
                    { title: '归属项目', dataIndex: 'projectName', key: 'projectName' },
                  ]}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              </>
            )}

            <Divider orientation="left">导入说明</Divider>
            <div style={{ color: '#666', fontSize: 13, lineHeight: 1.8 }}>
              <p>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                支持格式：CSV (.csv)、Excel (.xlsx, .xls)
              </p>
              <p>
                <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                系统会自动检测重复导入（同一月份同一云厂商）
              </p>
              <p>
                <AlertOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                无标签、标签冲突等异常会记录到异常处理页面
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default BillImport;
