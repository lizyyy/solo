import React from 'react';
import { Alert, Space } from 'antd';
import { 边界提示 as 边界提示类型 } from '../types';

interface Props {
  边界提示列表: 边界提示类型[];
  title?: string;
}

const 边界提示面板: React.FC<Props> = ({ 边界提示列表, title = '边界提示' }) => {
  if (!边界提示列表 || 边界提示列表.length === 0) {
    return null;
  }

  const 获取类型描述 = (type: string) => {
    const 描述: Record<string, string> = {
      '重复缴费': '同一月份存在多条缴费记录',
      '补缴重复': '补缴月份与已缴月份重叠',
      '提前退休': '退休时间早于法定年龄',
      '延迟退休超限': '退休时间超过法定年龄5年',
      '多地满10年': '多个参保地缴费满10年',
      '多地均不满10年': '所有参保地缴费均不满10年',
      '缴费年限不足': '累计缴费不足15年'
    };
    return 描述[type] || type;
  };

  const 获取严重程度类型 = (severity: string) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ marginBottom: 12 }}>{title} ({边界提示列表.length}条)</h4>
      <Space direction="vertical" style={{ width: '100%' }}>
        {边界提示列表.map((提示, index) => (
          <Alert
            key={index}
            message={
              <span>
                <strong>{获取类型描述(提示.type)}</strong>: {提示.message}
              </span>
            }
            type={获取严重程度类型(提示.severity)}
            showIcon
            description={
              提示.detail && (
                <pre style={{ fontSize: 12, margin: '8px 0 0 0', background: 'rgba(0,0,0,0.05)', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(提示.detail, null, 2)}
                </pre>
              )
            }
          />
        ))}
      </Space>
    </div>
  );
};

export default 边界提示面板;
