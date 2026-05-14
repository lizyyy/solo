import React from 'react';
import { Card, Descriptions, Tag, Row, Col, Button, Space } from 'antd';
import { 
  ExportOutlined, 
  FileExcelOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { statusMap, eventTypeMap, impactLevelMap, scopeTypeMap } from '../services/api';
import moment from 'moment';

const AnnotationDetail = ({ annotation, onExport, onExportExcel }) => {
  if (!annotation) return null;

  return (
    <Card 
      title="注释详情"
      extra={
        <Space>
          <Button 
            icon={<ExportOutlined />} 
            onClick={onExport}
          >
            导出洞察
          </Button>
          <Button 
            type="primary" 
            icon={<FileExcelOutlined />}
            onClick={onExportExcel}
          >
            下载Excel
          </Button>
        </Space>
      }
    >
      <Descriptions column={2} bordered>
        <Descriptions.Item label="标题" span={2}>
          <h3 style={{ margin: 0 }}>{annotation.title}</h3>
        </Descriptions.Item>
        <Descriptions.Item label="事件类型">
          <Tag color="blue">{eventTypeMap[annotation.event_type]?.label || annotation.event_type}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="影响程度">
          <Tag color={impactLevelMap[annotation.impact_level]?.color}>
            {impactLevelMap[annotation.impact_level]?.label || annotation.impact_level}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="当前状态">
          <Tag color={statusMap[annotation.status]?.color}>
            {statusMap[annotation.status]?.label || annotation.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="当前版本">
          <Tag color="purple">v{annotation.version}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="事件日期">
          {moment(annotation.event_date).format('YYYY-MM-DD')}
        </Descriptions.Item>
        <Descriptions.Item label="创建人">
          {annotation.created_by}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间" span={2}>
          {moment(annotation.created_at).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="重试次数" span={2}>
          <Tag color={annotation.retry_count >= annotation.max_retries ? 'red' : 'orange'}>
            {annotation.retry_count} / {annotation.max_retries}
          </Tag>
          {annotation.retry_count >= annotation.max_retries && (
            <span style={{ color: '#ff4d4f', marginLeft: 8 }}>已达最大重试次数</span>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="详细描述" span={2}>
          {annotation.description}
        </Descriptions.Item>
      </Descriptions>

      {annotation.scopes && annotation.scopes.length > 0 && (
        <Card type="inner" title="生效范围" style={{ marginTop: 16 }}>
          <Row gutter={[8, 8]}>
            {annotation.scopes.map((scope, index) => (
              <Col key={index}>
                <Tag color="geekblue">
                  {scopeTypeMap[scope.scope_type] || scope.scope_type}: {scope.scope_value}
                </Tag>
              </Col>
            ))}
          </Row>
        </Card>
      )}
    </Card>
  );
};

export default AnnotationDetail;
