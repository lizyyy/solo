import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Statistic,
  Row,
  Col,
  Progress,
  message,
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { distributionApi } from '../services/api';
import { DistributionVersion } from '../types';

function DistributionsPage() {
  const [distributions, setDistributions] = useState<(DistributionVersion & { configItem: any })[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchConfigId, setSearchConfigId] = useState('');

  const loadDistributions = async () => {
    setLoading(true);
    try {
      const response = await distributionApi.getList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        configId: searchConfigId || undefined,
      });
      setDistributions(response.data.data.items);
      setPagination({
        ...pagination,
        total: response.data.data.pagination.total,
      });
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDistributions();
  }, [pagination.current, pagination.pageSize]);

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    setTimeout(loadDistributions, 0);
  };

  const loadVersionDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await distributionApi.getById(id);
      setSelectedVersion(response.data.data);
    } catch (error) {
      message.error('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    { title: '配置Key', dataIndex: ['configItem', 'key'], key: 'configKey', width: 150 },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    { title: '配置ID', dataIndex: 'configId', key: 'configId', ellipsis: true },
    { title: '发布者', dataIndex: 'releasedBy', key: 'releasedBy', width: 100 },
    { title: '发布说明', dataIndex: 'releaseNote', key: 'releaseNote', ellipsis: true },
    { title: '拉取次数', dataIndex: ['_count', 'pullRecords'], key: 'pullCount', width: 100 },
    { title: '发布时间', dataIndex: 'releasedAt', key: 'releasedAt', width: 180, render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: DistributionVersion) => (
        <Button size="small" onClick={() => loadVersionDetail(record.id)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="分发版本"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadDistributions} loading={loading}>
            刷新
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索配置ID"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={searchConfigId}
            onChange={(e) => setSearchConfigId(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Button type="primary" onClick={handleSearch}>搜索</Button>
        </Space>

        <Table
          loading={loading}
          dataSource={distributions}
          columns={columns}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
        />

        {selectedVersion && (
          <Card
            title={`版本 ${selectedVersion.version} 详情`}
            style={{ marginTop: 16 }}
            loading={detailLoading}
          >
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="总拉取数" value={selectedVersion.stats?.total || 0} />
              </Col>
              <Col span={6}>
                <Statistic title="成功数" value={selectedVersion.stats?.success || 0} valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col span={6}>
                <Statistic title="失败数" value={selectedVersion.stats?.failed || 0} valueStyle={{ color: '#f5222d' }} />
              </Col>
              <Col span={6}>
                <Statistic title="待处理" value={selectedVersion.stats?.pending || 0} valueStyle={{ color: '#faad14' }} />
              </Col>
            </Row>

            <div style={{ marginTop: 24 }}>
              <h4>拉取进度</h4>
              <Progress
                percent={Math.round(
                  ((selectedVersion.stats?.success || 0) / (selectedVersion.stats?.total || 1)) * 100
                )}
                status="active"
              />
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
}

export default DistributionsPage;
