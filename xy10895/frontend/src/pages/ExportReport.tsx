import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Progress,
  Tag,
  message,
} from 'antd';
import { DownloadOutlined, FileTextOutlined, FileExcelOutlined } from '@ant-design/icons';
import apiService from '../services/api';

const ExportReport: React.FC = () => {
  const [stats, setStats] = useState({
    total: 0,
    byStatus: {
      draft: 0,
      reviewing: 0,
      active: 0,
      deprecated: 0,
      archived: 0,
    },
    byPermission: {
      public: 0,
      internal: 0,
      confidential: 0,
      restricted: 0,
    },
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiService.getApiList({ limit: 1000 });
        if (response.data.success) {
          const items = response.data.data.items;
          setStats({
            total: items.length,
            byStatus: {
              draft: items.filter((a: any) => a.status === 'draft').length,
              reviewing: items.filter((a: any) => a.status === 'reviewing').length,
              active: items.filter((a: any) => a.status === 'active').length,
              deprecated: items.filter((a: any) => a.status === 'deprecated').length,
              archived: items.filter((a: any) => a.status === 'archived').length,
            },
            byPermission: {
              public: items.filter((a: any) => a.permission_level === 'public').length,
              internal: items.filter((a: any) => a.permission_level === 'internal').length,
              confidential: items.filter((a: any) => a.permission_level === 'confidential').length,
              restricted: items.filter((a: any) => a.permission_level === 'restricted').length,
            },
          });
        }
      } catch (error) {
        console.error('Failed to fetch stats');
      }
    };
    fetchStats();
  }, []);

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const response = await apiService.exportReport(format);
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `api_catalog_report.${format}`;
      link.click();
      message.success(`报告已导出为 ${format.toUpperCase()} 格式`);
    } catch (error) {
      message.error('导出失败');
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'default',
    reviewing: 'orange',
    active: 'green',
    deprecated: 'red',
    archived: 'default',
  };

  return (
    <div>
      <Card title="导出报告" style={{ marginBottom: 24 }}>
        <Space size="large">
          <Button
            type="primary"
            size="large"
            icon={<FileTextOutlined />}
            onClick={() => handleExport('json')}
          >
            导出 JSON 报告
          </Button>
          <Button
            size="large"
            icon={<FileExcelOutlined />}
            onClick={() => handleExport('csv')}
          >
            导出 CSV 报告
          </Button>
        </Space>
      </Card>

      <Card title="API 目录统计概览">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="API 总数" value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="活跃 API"
                value={stats.byStatus.active}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="废弃 API"
                value={stats.byStatus.deprecated}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="草稿 API" value={stats.byStatus.draft} />
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Card title="按状态分布" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Tag color={statusColors[status]}>{status}</Tag>
                      <span>{count} 个 ({stats.total ? ((count / stats.total) * 100).toFixed(1) : 0}%)</span>
                    </Space>
                    <Progress
                      percent={stats.total ? (count / stats.total) * 100 : 0}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="按权限等级分布" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {Object.entries(stats.byPermission).map(([permission, count]) => (
                  <div key={permission}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Tag>{permission}</Tag>
                      <span>{count} 个 ({stats.total ? ((count / stats.total) * 100).toFixed(1) : 0}%)</span>
                    </Space>
                    <Progress
                      percent={stats.total ? (count / stats.total) * 100 : 0}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ExportReport;
