import React from 'react';
import { Card, List, Tag, Button, Collapse, Typography } from 'antd';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  FileText,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { ValidationError } from '@/types';
import { VALIDATION_TYPE_LABELS } from '@/utils/constants';
import { formatDateTime } from '@/utils/formatters';

const { Text, Paragraph } = Typography;

interface ValidationPanelProps {
  errors: ValidationError[];
  loading?: boolean;
  onLocate?: (error: ValidationError) => void;
}

const severityConfig = {
  error: {
    icon: <AlertCircle size={18} className="text-error" />,
    color: 'error',
    bgClass: 'bg-red-50 border-red-200',
    label: '错误',
  },
  warning: {
    icon: <AlertTriangle size={18} className="text-warning" />,
    color: 'warning',
    bgClass: 'bg-amber-50 border-amber-200',
    label: '警告',
  },
  info: {
    icon: <Info size={18} className="text-info" />,
    color: 'info',
    bgClass: 'bg-sky-50 border-sky-200',
    label: '提示',
  },
};

const ValidationPanel: React.FC<ValidationPanelProps> = ({
  errors,
  loading,
  onLocate,
}) => {
  const groupedErrors = errors.reduce(
    (acc, error) => {
      if (!acc[error.type]) {
        acc[error.type] = [];
      }
      acc[error.type].push(error);
      return acc;
    },
    {} as Record<string, ValidationError[]>
  );

  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;
  const infoCount = errors.filter((e) => e.severity === 'info').length;

  const collapseItems = Object.entries(groupedErrors).map(([type, typeErrors]) => {
    const typeLabel = VALIDATION_TYPE_LABELS[type as keyof typeof VALIDATION_TYPE_LABELS];
    const typeErrorCount = typeErrors.filter((e) => e.severity === 'error').length;
    const typeWarningCount = typeErrors.filter((e) => e.severity === 'warning').length;

    return {
      key: type,
      label: (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">{typeLabel}校验</span>
          {typeErrorCount > 0 && (
            <Tag color="error" className="m-0">
              {typeErrorCount} 个错误
            </Tag>
          )}
          {typeWarningCount > 0 && (
            <Tag color="warning" className="m-0">
              {typeWarningCount} 个警告
            </Tag>
          )}
          <span className="text-sm text-gray-400 ml-auto">
            对结果影响权重：
            {type === 'link'
              ? '55%'
              : type === 'points'
              ? '35%'
              : '10%'}
          </span>
        </div>
      ),
      children: (
        <List
          dataSource={typeErrors}
          loading={loading}
          renderItem={(error) => {
            const config = severityConfig[error.severity];
            return (
              <List.Item
                className={`border rounded-lg mb-3 p-4 ${config.bgClass} ${
                  error.isHistoricalJudgment ? 'historical-judgment' : 'new-judgment'
                }`}
              >
                <div className="w-full">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {config.icon}
                      <Tag color={config.color} className="m-0">
                        {config.label}
                      </Tag>
                      <Tag className="m-0">
                        {error.isHistoricalJudgment ? '历史判断' : '新增判断'}
                      </Tag>
                      <Text type="secondary" className="text-xs">
                        <Clock size={12} className="inline mr-1" />
                        {formatDateTime(error.timestamp)}
                      </Text>
                    </div>
                    {onLocate && (
                      <Button
                        type="text"
                        size="small"
                        icon={<ExternalLink size={14} />}
                        onClick={() => onLocate(error)}
                        className="text-primary-600 hover:text-primary-700"
                      >
                        定位
                      </Button>
                    )}
                  </div>

                  <Paragraph className="mb-2 text-gray-700" strong>
                    {error.errorMessage}
                  </Paragraph>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                    <div>
                      <Text type="secondary">字段：</Text>
                      <Text code>{error.fieldName}</Text>
                    </div>
                    <div>
                      <Text type="secondary">影响权重：</Text>
                      <Text strong className="text-primary-600">
                        {error.impactOnResult}%
                      </Text>
                    </div>
                    {error.fieldValue !== undefined && (
                      <div>
                        <Text type="secondary">当前值：</Text>
                        <Text code className="text-error">
                          {String(error.fieldValue)}
                        </Text>
                      </div>
                    )}
                    {error.expectedValue !== undefined && (
                      <div>
                        <Text type="secondary">期望值：</Text>
                        <Text code className="text-success">
                          {String(error.expectedValue)}
                        </Text>
                      </div>
                    )}
                    {error.contractNo && (
                      <div>
                        <Text type="secondary">合约编号：</Text>
                        <Text strong>{error.contractNo}</Text>
                      </div>
                    )}
                    {error.voucherNo && (
                      <div>
                        <Text type="secondary">收付凭证：</Text>
                        <Text strong>{error.voucherNo}</Text>
                      </div>
                    )}
                    {error.relatedMaterial && (
                      <div className="col-span-2">
                        <Text type="secondary">涉及材料：</Text>
                        <Text>
                          <FileText size={12} className="inline mr-1" />
                          {error.relatedMaterial}
                        </Text>
                      </div>
                    )}
                  </div>

                  <div className="bg-white/80 rounded p-2 border border-dashed border-gray-300">
                    <Text type="secondary" className="text-xs">
                      💡 建议操作：
                    </Text>
                    <Text className="text-sm ml-1">{error.suggestion}</Text>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      ),
    };
  });

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <AlertCircle size={20} className="text-error" />
          <span className="font-semibold">校验结果</span>
          {errorCount > 0 && (
            <Tag color="error" className="m-0">
              {errorCount} 错误
            </Tag>
          )}
          {warningCount > 0 && (
            <Tag color="warning" className="m-0">
              {warningCount} 警告
            </Tag>
          )}
          {infoCount > 0 && (
            <Tag color="info" className="m-0">
              {infoCount} 提示
            </Tag>
          )}
        </div>
      }
      className="shadow-sm"
    >
      {errors.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <AlertCircle size={48} className="mx-auto mb-3 text-success opacity-50" />
          <p className="text-lg">所有校验通过，未发现异常</p>
        </div>
      ) : (
        <Collapse
          items={collapseItems}
          defaultActiveKey={['link', 'points', 'match']}
          ghost
        />
      )}
    </Card>
  );
};

export default ValidationPanel;
