import React from 'react';
import { Card, Tag, Collapse } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  BulbOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { ProcessingConclusion as ProcessingConclusionType } from '../types';
import { getSeverityColor } from '../utils/helpers';

interface ProcessingConclusionProps {
  conclusion: ProcessingConclusionType;
  showDetails?: boolean;
}

const ProcessingConclusionComponent: React.FC<ProcessingConclusionProps> = ({
  conclusion,
  showDetails = true
}) => {
  const getStatusConfig = () => {
    switch (conclusion.status) {
      case 'normal':
        return {
          icon: <CheckCircleOutlined className="text-4xl" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-400',
          textColor: 'text-green-700',
          iconColor: 'text-green-500'
        };
      case 'warning':
        return {
          icon: <WarningOutlined className="text-4xl" />,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-400',
          textColor: 'text-orange-700',
          iconColor: 'text-orange-500'
        };
      case 'error':
        return {
          icon: <ExclamationCircleOutlined className="text-4xl" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-400',
          textColor: 'text-red-700',
          iconColor: 'text-red-500'
        };
      default:
        return {
          icon: <InfoCircleOutlined className="text-4xl" />,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-400',
          textColor: 'text-blue-700',
          iconColor: 'text-blue-500'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Card
      className={`${config.bgColor} border-2 ${config.borderColor} ${conclusion.status === 'error' ? 'conclusion-pulse' : ''}`}
      style={{ borderRadius: '12px' }}
    >
      <div className="flex items-start gap-6">
        <div className={`${config.iconColor} flex-shrink-0`}>
          {config.icon}
        </div>
        <div className="flex-1">
          <h3 className={`text-xl font-bold ${config.textColor} mb-2`} style={{ fontFamily: 'Noto Serif SC, serif' }}>
            {conclusion.title}
          </h3>
          <p className="text-gray-600 mb-4">
            {conclusion.description}
          </p>

          {conclusion.suggestions.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <BulbOutlined className="text-yellow-500" />
                <span className="font-medium text-gray-700">处理建议</span>
              </div>
              <ul className="space-y-1 pl-6">
                {conclusion.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-gray-600 text-sm list-disc">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showDetails && conclusion.details.length > 0 && (
            <Collapse
              ghost
              size="small"
              items={[{
                key: 'details',
                label: <span className="text-gray-600">查看详细问题</span>,
                children: (
                  <div className="space-y-3 bg-white rounded-lg p-4">
                    {conclusion.details.map((detail, index) => (
                      <div key={index} className="border-l-4 pl-3 py-1" style={{ borderColor: getSeverityColor(detail.severity) }}>
                        <div className="flex items-center gap-2">
                          <Tag color={detail.severity === 'error' ? 'red' : detail.severity === 'warning' ? 'orange' : 'blue'}>
                            {detail.severity === 'error' ? '错误' : detail.severity === 'warning' ? '警告' : '提示'}
                          </Tag>
                          <span className="font-medium">{detail.message}</span>
                        </div>
                        {detail.ruleExplanation && (
                          <p className="text-sm text-gray-500 mt-1">
                            <InfoCircleOutlined className="mr-1" />
                            规则说明：{detail.ruleExplanation}
                          </p>
                        )}
                        {detail.calculationProcess && (
                          <div className="mt-2 bg-gray-50 rounded p-2 text-sm font-mono text-gray-600 whitespace-pre-wrap">
                            {detail.calculationProcess}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }]}
            />
          )}
        </div>
      </div>
    </Card>
  );
};

export default ProcessingConclusionComponent;
