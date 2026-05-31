import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  List,
  Tag,
  Button,
  Space,
  Upload,
  message,
  Progress,
  Collapse,
  Alert,
  Tooltip,
} from 'antd';
import {
  Upload as UploadIcon,
  Play,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Calculator,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { useAppStore } from '../store';
import { tagColors, tagLabels } from '../data/mockData';
import { ValidationResult, Severity } from '../types';

const { Panel } = Collapse;

const severityColors: Record<Severity, string> = {
  high: '#F53F3F',
  medium: '#FF7D00',
  low: '#00B42A',
};

const severityLabels: Record<Severity, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const UnitValidator: React.FC = () => {
  const { validationResults, runValidation } = useAppStore();
  const [isValidating, setIsValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasRun, setHasRun] = useState(false);

  const handleRunValidation = () => {
    setIsValidating(true);
    setProgress(0);
    setHasRun(true);

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsValidating(false);
          runValidation();
          message.success('校验完成');
          return 100;
        }
        return p + 10;
      });
    }, 200);
  };

  const highCount = validationResults.filter((v) => v.severity === 'high').length;
  const mediumCount = validationResults.filter(
    (v) => v.severity === 'medium'
  ).length;
  const lowCount = validationResults.filter((v) => v.severity === 'low').length;

  const typeLabels: Record<string, string> = {
    unit_error: '单位换算错误',
    zero_drift: '零点漂移',
    sample_gap: '采样缺口',
  };

  const typeIcons: Record<string, React.ReactNode> = {
    unit_error: <Calculator size={16} />,
    zero_drift: <RefreshCw size={16} />,
    sample_gap: <FileSpreadsheet size={16} />,
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'unit_error':
        return <Calculator size={20} />;
      case 'zero_drift':
        return <RefreshCw size={20} />;
      case 'sample_gap':
        return <FileSpreadsheet size={20} />;
      default:
        return <AlertTriangle size={20} />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">数据校验工具</h2>
            <p className="text-sm text-gray-500">
              自动检测单位换算错误、零点漂移、采样缺口等常见问题
            </p>
          </div>
          <Space>
            <Upload.Dragger
              accept=".csv,.txt,.json"
              beforeUpload={() => {
                message.info('文件上传功能演示');
                return false;
              }}
              showUploadList={false}
              style={{ border: 'none', padding: 0, background: 'transparent' }}
            >
              <Button icon={<UploadIcon size={16} />}>
                导入数据文件
              </Button>
            </Upload.Dragger>
            <Button
              type="primary"
              icon={<Play size={16} />}
              onClick={handleRunValidation}
              loading={isValidating}
            >
              开始校验
            </Button>
          </Space>
        </div>

        {isValidating && (
          <div className="mb-4">
            <Progress percent={progress} status="active" />
            <p className="text-xs text-gray-500 mt-2">正在分析数据...</p>
          </div>
        )}

        {!hasRun && (
          <Alert
            message="请点击「开始校验」按钮运行数据检测"
            type="info"
            showIcon
          />
        )}
      </Card>

      {hasRun && !isValidating && (
        <>
          <Row gutter={16}>
            <Col span={6}>
              <Card className="text-center">
                <Statistic
                  title={
                    <span className="flex items-center justify-center">
                      <AlertTriangle
                        size={16}
                        className="mr-2"
                        style={{ color: severityColors.high }}
                      />
                      高严重度问题
                    </span>
                  }
                  value={highCount}
                  valueStyle={{ color: severityColors.high }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="text-center">
                <Statistic
                  title={
                    <span className="flex items-center justify-center">
                      <AlertTriangle
                        size={16}
                        className="mr-2"
                        style={{ color: severityColors.medium }}
                      />
                      中严重度问题
                    </span>
                  }
                  value={mediumCount}
                  valueStyle={{ color: severityColors.medium }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="text-center">
                <Statistic
                  title={
                    <span className="flex items-center justify-center">
                      <AlertTriangle
                        size={16}
                        className="mr-2"
                        style={{ color: severityColors.low }}
                      />
                      低严重度问题
                    </span>
                  }
                  value={lowCount}
                  valueStyle={{ color: severityColors.low }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="text-center">
                <Statistic
                  title={
                    <span className="flex items-center justify-center">
                      <CheckCircle
                        size={16}
                        className="mr-2 text-green-500"
                      />
                      校验通过率
                    </span>
                  }
                  value={Math.round(
                    ((100 - validationResults.length) / 100) * 100
                  )}
                  suffix="%"
                  valueStyle={{ color: '#00B42A' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Card title="问题类型分布">
                <div className="space-y-4">
                  {Object.entries(typeLabels).map(([type, label]) => {
                    const count = validationResults.filter(
                      (r) => r.type === type
                    ).length;
                    const percentage =
                      validationResults.length > 0
                        ? Math.round(
                            (count / validationResults.length) * 100
                          )
                        : 0;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center text-sm">
                            <span
                              className="mr-2"
                              style={{ color: tagColors[type] }}
                            >
                              {typeIcons[type]}
                            </span>
                            {label}
                          </span>
                          <span className="text-sm font-medium">
                            {count} ({percentage}%)
                          </span>
                        </div>
                        <Progress
                          percent={percentage}
                          showInfo={false}
                          strokeColor={tagColors[type]}
                          size="small"
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Col>

            <Col span={16}>
              <Card title="检测结果详情">
                <List
                  dataSource={validationResults}
                  renderItem={(result: ValidationResult) => (
                    <List.Item className="py-3 border-b last:border-b-0">
                      <List.Item.Meta
                        avatar={
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: `${severityColors[result.severity]}15`,
                              color: severityColors[result.severity],
                            }}
                          >
                            {getResultIcon(result.type)}
                          </div>
                        }
                        title={
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {typeLabels[result.type]}
                            </span>
                            <Tag color={severityColors[result.severity]}>
                              {severityLabels[result.severity]}严重
                            </Tag>
                            <Tag color={tagColors[result.type]}>
                              {tagLabels[result.type]}
                            </Tag>
                          </div>
                        }
                        description={
                          <div className="mt-2">
                            <p className="text-sm text-gray-600 mb-2">
                              {result.description}
                            </p>
                            <Collapse
                              ghost
                              size="small"
                            >
                              <Panel
                                header={
                                  <span className="text-xs text-blue-500 flex items-center">
                                    <Lightbulb size={12} className="mr-1" />
                                    查看修复建议
                                  </span>
                                }
                                key="1"
                              >
                                <div className="bg-blue-50 p-3 rounded text-sm text-gray-700">
                                  <span className="font-medium text-blue-600">
                                    建议：
                                  </span>
                                  {result.suggestion}
                                </div>
                              </Panel>
                            </Collapse>
                            <div className="text-xs text-gray-400 mt-1">
                              位置：第 {result.location.start} -{' '}
                              {result.location.end} 个数据点
                            </div>
                          </div>
                        }
                      />
                      <Space>
                        <Tooltip title="快速修复">
                          <Button
                            size="small"
                            type="primary"
                            icon={<ArrowRight size={14} />}
                            onClick={() => message.info('跳转至修复功能')}
                          >
                            处理
                          </Button>
                        </Tooltip>
                        <Tooltip title="标记为已忽略">
                          <Button
                            size="small"
                            onClick={() => message.info('已忽略')}
                          >
                            忽略
                          </Button>
                        </Tooltip>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>

          <Card title="单位换算参考">
            <Row gutter={16}>
              <Col span={8}>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center">
                    <Calculator size={16} className="mr-2 text-blue-500" />
                    磁场单位换算
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>特斯拉 (T)</span>
                      <span className="font-mono">1 T = 10,000 Gs</span>
                    </div>
                    <div className="flex justify-between">
                      <span>毫特斯拉 (mT)</span>
                      <span className="font-mono">1 mT = 10 Gs</span>
                    </div>
                    <div className="flex justify-between">
                      <span>高斯 (Gs)</span>
                      <span className="font-mono">1 Gs = 0.1 mT</span>
                    </div>
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center">
                    <RefreshCw size={16} className="mr-2 text-orange-500" />
                    零点漂移检测
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>• 检测空白样品基线偏移</p>
                    <p>• 阈值：偏移 {'>'} 0.5 mT 告警</p>
                    <p>• 建议：定期使用标样校准</p>
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center">
                    <FileSpreadsheet
                      size={16}
                      className="mr-2 text-purple-500"
                    />
                    采样完整性
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>• 检查时间戳连续性</p>
                    <p>• 缺口 {'>'} 2 倍采样间隔告警</p>
                    <p>• 可使用线性插值补全</p>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </>
      )}
    </div>
  );
};
