import React from 'react';
import { Collapse, Descriptions, Tag, Space } from 'antd';
import { QuestionCircleOutlined, CalculatorOutlined, FileTextOutlined } from '@ant-design/icons';
import { BALANCE_CALCULATION_RULES } from '../services/balanceService';
import { VALIDATION_RULES } from '../services/validationService';
import { EXPORT_RULES } from '../services/exportService';

const RuleExplanation: React.FC = () => {
  const items = [
    {
      key: 'balance',
      label: (
        <span className="flex items-center gap-2">
          <CalculatorOutlined />
          余额计算规则
        </span>
      ),
      children: (
        <div className="bg-gray-50 rounded-lg p-4">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="规则名称">{BALANCE_CALCULATION_RULES.name}</Descriptions.Item>
            <Descriptions.Item label="计算公式">
              <Tag color="blue">{BALANCE_CALCULATION_RULES.formula}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="规则说明">
              <div className="whitespace-pre-wrap text-sm">
                {BALANCE_CALCULATION_RULES.explanation}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="关键中间值">
              <Space>
                {BALANCE_CALCULATION_RULES.keyValues.map((v, i) => (
                  <Tag key={i}>{v}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </div>
      )
    },
    {
      key: 'validation',
      label: (
        <span className="flex items-center gap-2">
          <QuestionCircleOutlined />
          异常检测规则
        </span>
      ),
      children: (
        <div className="space-y-4">
          {Object.entries(VALIDATION_RULES).map(([key, rule]: [string, any]) => (
            <div key={key} className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">{rule.name}</h4>
              <Descriptions column={1} size="small">
                {rule.threshold !== undefined && (
                  <Descriptions.Item label="阈值">{rule.threshold}</Descriptions.Item>
                )}
                {rule.condition && (
                  <Descriptions.Item label="判断条件">
                    <Tag color="orange">{rule.condition}</Tag>
                  </Descriptions.Item>
                )}
                {rule.severity && (
                  <Descriptions.Item label="严重程度">
                    <Tag color={rule.severity === 'error' ? 'red' : 'orange'}>
                      {rule.severity === 'error' ? '错误' : '警告'}
                    </Tag>
                  </Descriptions.Item>
                )}
                {rule.action && (
                    <Descriptions.Item label="处理动作">{rule.action}</Descriptions.Item>
                  )}
                {rule.description && (
                    <Descriptions.Item label="规则描述">{rule.description}</Descriptions.Item>
                  )}
                {rule.matchFields && (
                    <Descriptions.Item label="匹配字段">
                      <Space>
                        {rule.matchFields.map((f: string, i: number) => (
                          <Tag key={i}>{f}</Tag>
                        ))}
                      </Space>
                    </Descriptions.Item>
                  )}
              </Descriptions>
            </div>
          ))}
        </div>
      )
    },
    {
      key: 'export',
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          数据导出规则
        </span>
      ),
      children: (
        <div className="bg-gray-50 rounded-lg p-4">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="规则名称">{EXPORT_RULES.name}</Descriptions.Item>
            <Descriptions.Item label="支持格式">
              <Space>
                {EXPORT_RULES.formats.map((f, i) => (
                  <Tag key={i} color="green">{f}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="编码方式">{EXPORT_RULES.encoding}</Descriptions.Item>
            <Descriptions.Item label="文件命名规则">
              <Tag color="purple">{EXPORT_RULES.filenamePattern}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="导出字段-兑付">
              <Space wrap>
                {EXPORT_RULES.includedFields.redemption.map((f, i) => (
                  <Tag key={i}>{f}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </div>
      )
    }
  ];

  return (
    <Collapse
      items={items}
      defaultActiveKey={[]}
      className="bg-white rounded-lg"
      size="small"
    />
  );
};

export default RuleExplanation;
