import React, { useMemo } from 'react';
import { Card, Statistic, Row, Col, message } from 'antd';
import { 
  FileTextOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { useNotification } from '../contexts/NotificationContext';
import { NOTIFICATION_STATUS } from '../constants/status';
import FilterBar from '../components/FilterBar';
import NotificationTable from '../components/NotificationTable';
import { generateMarkdownReport, downloadMarkdown } from '../services/exportService';

const NotificationPage = () => {
  const {
    notifications,
    loadingIds,
    filters,
    stores,
    loadNotifications,
    setFilters,
    addLoadingId,
    removeLoadingId,
  } = useNotification();

  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    if (filters.storeName) {
      result = result.filter(n => n.storeName === filters.storeName);
    }

    if (filters.status) {
      result = result.filter(n => n.status === filters.status);
    }

    return result;
  }, [notifications, filters]);

  const statistics = useMemo(() => {
    return {
      total: notifications.length,
      pending: notifications.filter(n => n.status === NOTIFICATION_STATUS.PENDING).length,
      sending: notifications.filter(n => n.status === NOTIFICATION_STATUS.SENDING).length,
      success: notifications.filter(n => n.status === NOTIFICATION_STATUS.SUCCESS).length,
      failed: notifications.filter(n => n.status === NOTIFICATION_STATUS.FAILED).length,
    };
  }, [notifications]);

  const handleRefresh = () => {
    loadNotifications();
    message.success('数据已刷新');
  };

  const handleExport = () => {
    const markdown = generateMarkdownReport(filteredNotifications, filters);
    downloadMarkdown(markdown);
    message.success('报告已导出');
  };

  const handleNotificationUpdate = () => {
    loadNotifications();
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="总通知数"
              value={statistics.total}
              prefix={<FileTextOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="待补发"
              value={statistics.pending}
              valueStyle={{ color: '#666' }}
              prefix={<ClockCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="发送中"
              value={statistics.sending}
              valueStyle={{ color: '#1890ff' }}
              prefix={<LoadingOutlined spin />}
            />
          </Col>
          <Col span={3}>
            <Statistic
              title="已成功"
              value={statistics.success}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col span={3}>
            <Statistic
              title="失败"
              value={statistics.failed}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <FilterBar
          stores={stores}
          filters={filters}
          onFilterChange={setFilters}
          onRefresh={handleRefresh}
          onExport={handleExport}
          loading={loadingIds.length > 0}
        />

        <NotificationTable
          notifications={filteredNotifications}
          loadingIds={loadingIds}
          onNotificationUpdate={handleNotificationUpdate}
          addLoadingId={addLoadingId}
          removeLoadingId={removeLoadingId}
        />
      </Card>
    </div>
  );
};

export default NotificationPage;
