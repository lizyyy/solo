import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Card,
  Alert,
  Typography,
  Checkbox,
  Modal,
  List,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { artworkAPI } from '../utils/api';

const { Title, Text, Paragraph } = Typography;

function ReviewPage() {
  const [pendingArtworks, setPendingArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentArtwork, setCurrentArtwork] = useState(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const response = await artworkAPI.getAll({ needs_confirmation: true });
      setPendingArtworks(response.data);
    } catch (error) {
      message.error('获取待确认列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleConfirm = async (confirmed) => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要处理的作品');
      return;
    }

    try {
      await artworkAPI.confirm({
        artwork_ids: selectedIds,
        confirmed: confirmed,
      });
      message.success(
        confirmed
          ? `已确认 ${selectedIds.length} 件作品`
          : `已标记 ${selectedIds.length} 件作品为待处理`
      );
      setSelectedIds([]);
      fetchPending();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleViewDetails = (artwork) => {
    setCurrentArtwork(artwork);
    setDetailModalVisible(true);
  };

  const rowSelection = {
    selectedRowKeys: selectedIds,
    onChange: (keys) => setSelectedIds(keys),
  };

  const columns = [
    {
      title: '作品编号',
      dataIndex: 'artwork_id',
      key: 'artwork_id',
      width: 120,
    },
    {
      title: '作品名称',
      dataIndex: 'title',
      key: 'title',
      width: 180,
    },
    {
      title: '艺术家',
      dataIndex: 'artist',
      key: 'artist',
      width: 120,
    },
    {
      title: '尺寸',
      key: 'dimensions',
      width: 150,
      render: (_, record) => (
        <span>
          {record.width} × {record.height} {record.unit}
        </span>
      ),
    },
    {
      title: '问题数量',
      key: 'issues',
      width: 100,
      render: (_, record) => {
        const count = record.issues?.length || 0;
        if (count === 0) return <Tag color="green">无问题</Tag>;
        return (
          <Tag color="orange">
            <WarningOutlined /> {count} 项
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => handleViewDetails(record)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  const getIssueIcon = (severity) => {
    if (severity === 'error') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    if (severity === 'warning') return <WarningOutlined style={{ color: '#faad14' }} />;
    return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
  };

  return (
    <div>
      <Title level={2}>复核修正</Title>

      <Paragraph>
        以下作品存在需要确认的问题。请逐一检查，确认无误后点击"批量确认"。
        有问题的作品会单独标记，不会混入正常结果。
      </Paragraph>

      {pendingArtworks.length > 0 && (
        <Alert
          message={`有 ${pendingArtworks.length} 件作品待确认`}
          description="请仔细核对作品信息，特别是尺寸单位和挂墙位置。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(true)}
              disabled={selectedIds.length === 0}
            >
              批量确认 ({selectedIds.length})
            </Button>
            <Button
              onClick={() => setSelectedIds(pendingArtworks.map((a) => a.id))}
            >
              全选
            </Button>
            <Button onClick={() => setSelectedIds([])}>取消选择</Button>
          </Space>
        </div>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={pendingArtworks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: '暂无待确认的作品，所有数据都已确认完毕',
          }}
        />
      </Card>

      <Modal
        title="作品详情 - 待确认项"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="confirm"
            type="primary"
            onClick={() => {
              setSelectedIds([currentArtwork.id]);
              setDetailModalVisible(false);
              setTimeout(() => handleConfirm(true), 100);
            }}
          >
            确认此作品
          </Button>,
        ]}
        width={600}
      >
        {currentArtwork && (
          <div>
            <Card
              size="small"
              title="基本信息"
              style={{ marginBottom: 16 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>
                  <strong>作品编号：</strong> {currentArtwork.artwork_id}
                </Text>
                <Text>
                  <strong>作品名称：</strong> {currentArtwork.title}
                </Text>
                <Text>
                  <strong>艺术家：</strong> {currentArtwork.artist}
                </Text>
                <Text>
                  <strong>尺寸：</strong> {currentArtwork.width} ×{' '}
                  {currentArtwork.height} {currentArtwork.unit}
                </Text>
                <Text>
                  <strong>展墙位置：</strong>{' '}
                  {currentArtwork.wall_location || '未设置'}
                </Text>
              </Space>
            </Card>

            <Card
              size="small"
              title={
                <Space>
                  <WarningOutlined style={{ color: '#faad14' }} />
                  需要确认的问题
                </Space>
              }
            >
              {currentArtwork.issues && currentArtwork.issues.length > 0 ? (
                <List
                  dataSource={currentArtwork.issues}
                  renderItem={(issue, index) => (
                    <List.Item key={index}>
                      <List.Item.Meta
                        avatar={getIssueIcon(issue.severity)}
                        title={
                          <Text
                            type={
                              issue.severity === 'error' ? 'danger' : 'warning'
                            }
                          >
                            {issue.message}
                          </Text>
                        }
                        description={
                          issue.type === 'unit_error'
                            ? '建议：请确认作品的实际尺寸单位'
                            : issue.type === 'dimension_warning'
                            ? '建议：尺寸数值异常，请核实是否填写正确'
                            : issue.type === 'position_change'
                            ? '建议：作品位置有变动，请确认新位置是否正确'
                            : '请确认信息无误后继续'
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#999' }}>
                  暂无具体问题标记
                </div>
              )}
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ReviewPage;
