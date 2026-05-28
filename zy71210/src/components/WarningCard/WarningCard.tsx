import React, { useState } from 'react';
import { Card, Tag, Button, Collapse } from 'antd';
import {
  WarningOutlined,
  AlertOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { WarningItem } from '../../types';

const { Panel } = Collapse;

interface WarningCardProps {
  warning: WarningItem;
  onMarkRead?: (id: string) => void;
}

const WarningCard: React.FC<WarningCardProps> = ({ warning, onMarkRead }) => {
  const [expanded, setExpanded] = useState(false);

  const getSeverityColor = (severity: WarningItem['severity']) => {
    switch (severity) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'processing';
      default:
        return 'default';
    }
  };

  const getSeverityText = (severity: WarningItem['severity']) => {
    switch (severity) {
      case 'high':
        return '高风险';
      case 'medium':
        return '中风险';
      case 'low':
        return '提示';
      default:
        return '未知';
    }
  };

  const getIcon = (type: WarningItem['type']) => {
    switch (type) {
      case 'mismatch':
        return <WarningOutlined style={{ color: '#d32f2f' }} />;
      case 'rollover':
        return <AlertOutlined style={{ color: '#f57c00' }} />;
      case 'basis_duplicate':
        return <InfoCircleOutlined style={{ color: '#f57c00' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#1976d2' }} />;
    }
  };

  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        borderLeft: `4px solid ${
          warning.severity === 'high'
            ? '#d32f2f'
            : warning.severity === 'medium'
            ? '#f57c00'
            : '#1976d2'
        }`,
        background: warning.isRead ? '#fafafa' : '#fff',
        opacity: warning.isRead ? 0.7 : 1,
      }}
      hoverable
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>{getIcon(warning.type)}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={getSeverityColor(warning.severity)}>
              {getSeverityText(warning.severity)}
            </Tag>
            <span style={{ fontWeight: 500 }}>{warning.title}</span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#666' }}>
            {warning.description}
          </p>
        </div>
        {warning.isRead && (
          <CheckCircleOutlined style={{ color: '#388e3c', fontSize: 18 }} />
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed #e8e8e8' }}>
          <Collapse ghost defaultActiveKey={['1']}>
            <Panel header="操作建议" key="1">
              <p style={{ margin: 0, color: '#555', lineHeight: 1.8 }}>
                💡 {warning.suggestion}
              </p>
            </Panel>
          </Collapse>
          {onMarkRead && !warning.isRead && (
            <Button
              type="link"
              size="small"
              style={{ padding: 0, marginTop: 8 }}
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(warning.id);
              }}
            >
              标记为已处理
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

export default WarningCard;
