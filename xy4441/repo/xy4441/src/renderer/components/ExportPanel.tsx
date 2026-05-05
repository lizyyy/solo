import React, { useState } from 'react';
import {
  Card,
  Typography,
  Button,
  Checkbox,
  message,
  Space,
  Divider,
  Tag,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  FileTextOutlined,
  FileOutlined,
  ExportOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useApp } from '../store/AppContext';
import { ExportOptions } from '../../shared/types';

const { Title, Paragraph } = Typography;

const ExportPanel: React.FC = () => {
  const {
    scenes,
    costumes,
    risks,
    exportMarkdown,
    exportJson,
  } = useApp();

  const [markdownOptions, setMarkdownOptions] = useState<ExportOptions>({
    format: 'markdown',
    includeResolved: false,
    includeNotes: true,
  });

  const [jsonOptions, setJsonOptions] = useState<ExportOptions>({
    format: 'json',
    includeResolved: true,
    includeNotes: true,
  });

  const [isExporting, setIsExporting] = useState<string | null>(null);

  const activeRisks = risks.filter((r) => !r.isResolved);
  const resolvedRisks = risks.filter((r) => r.isResolved);

  const handleExportMarkdown = async () => {
    try {
      setIsExporting('markdown');
      const result = await exportMarkdown(markdownOptions);
      if (result) {
        message.success(`交接单已导出: ${result}`);
      }
    } catch (error) {
      message.error('导出失败');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportJson = async () => {
    try {
      setIsExporting('json');
      const result = await exportJson(jsonOptions);
      if (result) {
        message.success(`审计包已导出: ${result}`);
      }
    } catch (error) {
      message.error('导出失败');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="stats-card">
            <Statistic
              title="场次数量"
              value={scenes.length}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stats-card">
            <Statistic
              title="服装数量"
              value={costumes.length}
              prefix={<FileOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stats-card">
            <Statistic
              title="风险总数"
              value={risks.length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{
                color: activeRisks.length > 0 ? '#ff4d4f' : '#52c41a',
              }}
            />
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <Tag color="error">{activeRisks.length} 未解决</Tag>
              <Tag color="success">{resolvedRisks.length} 已解决</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            className="panel-card"
            title={
              <Space>
                <FileTextOutlined />
                <span>Markdown 交接单</span>
              </Space>
            }
          >
            <Paragraph type="secondary">
              导出为 Markdown 格式的服装交接单，可直接用于打印或转换为 PDF。包含场次清单、服装清单和风险预警。
            </Paragraph>

            <Divider />

            <div className="export-options">
              <div style={{ marginBottom: 12 }}>
                <Title level={5}>导出选项</Title>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Checkbox
                  checked={markdownOptions.includeResolved}
                  onChange={(e) =>
                    setMarkdownOptions({
                      ...markdownOptions,
                      includeResolved: e.target.checked,
                    })
                  }
                >
                  包含已解决的风险
                </Checkbox>
              </div>
              <div>
                <Checkbox
                  checked={markdownOptions.includeNotes}
                  onChange={(e) =>
                    setMarkdownOptions({
                      ...markdownOptions,
                      includeNotes: e.target.checked,
                    })
                  }
                >
                  包含用户备注
                </Checkbox>
              </div>
            </div>

            <Button
              type="primary"
              size="large"
              icon={<ExportOutlined />}
              onClick={handleExportMarkdown}
              loading={isExporting === 'markdown'}
              block
            >
              导出 Markdown 交接单
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            className="panel-card"
            title={
              <Space>
                <FileOutlined />
                <span>JSON 审计包</span>
              </Space>
            }
          >
            <Paragraph type="secondary">
              导出为 JSON 格式的完整数据包，包含所有数据（场次、服装、记录、照片、风险）。
              适用于数据备份、导入其他系统或进一步分析。
            </Paragraph>

            <Divider />

            <div className="export-options">
              <div style={{ marginBottom: 12 }}>
                <Title level={5}>导出选项</Title>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Checkbox
                  checked={jsonOptions.includeResolved}
                  onChange={(e) =>
                    setJsonOptions({
                      ...jsonOptions,
                      includeResolved: e.target.checked,
                    })
                  }
                >
                  包含已解决的风险
                </Checkbox>
              </div>
              <div>
                <Checkbox
                  checked={jsonOptions.includeNotes}
                  onChange={(e) =>
                    setJsonOptions({
                      ...jsonOptions,
                      includeNotes: e.target.checked,
                    })
                  }
                >
                  包含用户备注
                </Checkbox>
              </div>
            </div>

            <Button
              type="primary"
              size="large"
              icon={<ExportOutlined />}
              onClick={handleExportJson}
              loading={isExporting === 'json'}
              block
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              导出 JSON 审计包
            </Button>
          </Card>
        </Col>
      </Row>

      <Card className="panel-card" style={{ marginTop: 16 }}>
        <Title level={4}>导出格式说明</Title>
        <Divider />
        
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Title level={5}>
              <Space>
                <FileTextOutlined />
                Markdown 交接单
              </Space>
            </Title>
            <Paragraph>
              包含以下内容：
              <ul>
                <li>场次概览表格（场次号、名称、日期、地点、角色）</li>
                <li>按角色分组的服装清单（条码、名称、尺码、颜色、状态）</li>
                <li>风险预警统计和详情（按严重程度排序）</li>
                <li>用户备注和改判状态（可选）</li>
              </ul>
              <Text type="secondary">
                提示：可使用 Typora、VS Code 或其他 Markdown 编辑器打开，也可转换为 PDF 打印。
              </Text>
            </Paragraph>
          </Col>

          <Col xs={24} lg={12}>
            <Title level={5}>
              <Space>
                <FileOutlined />
                JSON 审计包
              </Space>
            </Title>
            <Paragraph>
              包含以下数据结构：
              <ul>
                <li><code>project</code>: 项目基本信息</li>
                <li><code>scenes</code>: 场次通告数据</li>
                <li><code>costumes</code>: 服装条码数据</li>
                <li><code>washRecords</code>: 清洗记录</li>
                <li><code>alterationRecords</code>: 改衣记录</li>
                <li><code>photos</code>: 参考照片元数据</li>
                <li><code>risks</code>: 风险检测结果</li>
                <li><code>exportedAt</code>: 导出时间</li>
                <li><code>version</code>: 数据版本</li>
              </ul>
              <Text type="secondary">
                提示：可用于数据备份、与其他系统集成、或导入回此工具。
              </Text>
            </Paragraph>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ExportPanel;
