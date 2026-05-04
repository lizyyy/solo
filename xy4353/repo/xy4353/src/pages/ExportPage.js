import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Tag, 
  Space, 
  Statistic, 
  Row, 
  Col, 
  message,
  Divider,
  Descriptions,
  Tabs,
  Typography
} from 'antd';
import { 
  FileTextOutlined, 
  CodeOutlined,
  DownloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { usePhotoScan, REPAIR_STATUS, RISK_STATUS } from '../context/PhotoScanContext';
import ExportService from '../services/ExportService';

const { TabPane } = Tabs;
const { Text, Paragraph } = Typography;

function ExportPage() {
  const { state } = usePhotoScan();
  const [previewContent, setPreviewContent] = useState('');
  const [previewType, setPreviewType] = useState(null);

  const stats = {
    total: state.records.length,
    notRepaired: state.records.filter(r => r.repairStatus === REPAIR_STATUS.NOT_REPAIRED).length,
    inProgress: state.records.filter(r => r.repairStatus === REPAIR_STATUS.IN_PROGRESS).length,
    repaired: state.records.filter(r => r.repairStatus === REPAIR_STATUS.REPAIRED).length,
    reviewed: state.records.filter(r => r.reviewed).length,
    passed: state.records.filter(r => r.reviewStatus === 'pass').length,
    failed: state.records.filter(r => r.reviewStatus === 'fail').length,
    risks: state.risks.length,
    pendingRisks: state.risks.filter(r => r.status === RISK_STATUS.PENDING).length,
    resolvedRisks: state.risks.filter(r => r.status === RISK_STATUS.RESOLVED).length
  };

  const canExport = state.records.length > 0;

  const exportMarkdown = () => {
    if (!canExport) {
      message.warning('没有数据可导出');
      return;
    }
    const content = ExportService.generateMarkdownHandover(state);
    const filename = `交接单_${moment().format('YYYYMMDD_HHmmss')}.md`;
    ExportService.downloadFile(content, filename, 'text/markdown');
    message.success('Markdown 交接单已导出');
  };

  const exportJSON = () => {
    if (!canExport) {
      message.warning('没有数据可导出');
      return;
    }
    const content = ExportService.generateJSONAudit(state);
    const filename = `审计包_${moment().format('YYYYMMDD_HHmmss')}.json`;
    ExportService.downloadFile(content, filename, 'application/json');
    message.success('JSON 审计包已导出');
  };

  const previewMarkdown = () => {
    if (!canExport) {
      message.warning('没有数据可预览');
      return;
    }
    const content = ExportService.generateMarkdownHandover(state);
    setPreviewContent(content);
    setPreviewType('markdown');
  };

  const previewJSON = () => {
    if (!canExport) {
      message.warning('没有数据可预览');
      return;
    }
    const content = ExportService.generateJSONAudit(state);
    setPreviewContent(content);
    setPreviewType('json');
  };

  const exportAll = () => {
    if (!canExport) {
      message.warning('没有数据可导出');
      return;
    }
    exportMarkdown();
    setTimeout(() => exportJSON(), 500);
  };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={3}>
            <Statistic title="总记录数" value={stats.total} suffix="条" />
          </Col>
          <Col span={3}>
            <Statistic title="已修复" value={stats.repaired} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col span={3}>
            <Statistic title="已复核" value={stats.reviewed} />
          </Col>
          <Col span={3}>
            <Statistic title="通过" value={stats.passed} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col span={3}>
            <Statistic title="有问题" value={stats.failed} valueStyle={{ color: '#ff4d4f' }} />
          </Col>
          <Col span={3}>
            <Statistic title="风险数" value={stats.risks} />
          </Col>
          <Col span={3}>
            <Statistic 
              title="待处理风险" 
              value={stats.pendingRisks} 
              valueStyle={{ color: stats.pendingRisks > 0 ? '#faad14' : '#52c41a' }}
            />
          </Col>
          <Col span={3} style={{ textAlign: 'right' }}>
            <Statistic 
              title="导出时间" 
              value={moment().format('HH:mm:ss')}
            />
          </Col>
        </Row>
      </Card>

      <Card 
        size="small"
        title={
          <Space>
            <DownloadOutlined />
            <span>导出选项</span>
          </Space>
        }
        extra={
          <Button 
            type="primary" 
            size="large"
            icon={<DownloadOutlined />}
            onClick={exportAll}
            disabled={!canExport}
          >
            一键导出全部
          </Button>
        }
      >
        <Row gutter={16}>
          <Col span={12}>
            <Card 
              size="small"
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#1890ff' }} />
                  <span>Markdown 交接单</span>
                </Space>
              }
              type="inner"
            >
              <Paragraph>
                生成包含以下内容的 Markdown 格式交接单：
              </Paragraph>
              <ul>
                <li><Text code>基本信息</Text> - 总记录数、已修复、已复核等统计</li>
                <li><Text code>风险统计</Text> - 按类型分类的风险汇总</li>
                <li><Text code>记录清单</Text> - 按底片盒分组的详细清单</li>
                <li><Text code>待处理风险</Text> - 尚未处理的风险详情</li>
              </ul>
              <Divider />
              <Space>
                <Button 
                  icon={<EyeOutlined />} 
                  onClick={previewMarkdown}
                  disabled={!canExport}
                >
                  预览
                </Button>
                <Button 
                  type="primary"
                  icon={<DownloadOutlined />} 
                  onClick={exportMarkdown}
                  disabled={!canExport}
                >
                  导出 Markdown
                </Button>
              </Space>
            </Card>
          </Col>

          <Col span={12}>
            <Card 
              size="small"
              title={
                <Space>
                  <CodeOutlined style={{ color: '#52c41a' }} />
                  <span>JSON 审计包</span>
                </Space>
              }
              type="inner"
            >
              <Paragraph>
                生成包含完整审计信息的 JSON 格式数据包：
              </Paragraph>
              <ul>
                <li><Text code>审计摘要</Text> - 审计时间、版本号、统计汇总</li>
                <li><Text code>完整记录</Text> - 所有扫描记录的完整数据</li>
                <li><Text code>风险详情</Text> - 所有风险记录及处理状态</li>
                <li><Text code>时间线</Text> - 数据导入、风险发现、处理的时间线</li>
              </ul>
              <Divider />
              <Space>
                <Button 
                  icon={<EyeOutlined />} 
                  onClick={previewJSON}
                  disabled={!canExport}
                >
                  预览
                </Button>
                <Button 
                  type="primary"
                  icon={<DownloadOutlined />} 
                  onClick={exportJSON}
                  disabled={!canExport}
                >
                  导出 JSON
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      {previewContent && (
        <Card 
          size="small"
          style={{ marginTop: 16 }}
          title={
            <Space>
              <EyeOutlined />
              <span>预览: {previewType === 'markdown' ? 'Markdown 交接单' : 'JSON 审计包'}</span>
            </Space>
          }
          extra={
            <Button onClick={() => setPreviewContent('')}>
              关闭预览
            </Button>
          }
        >
          <pre 
            style={{ 
              maxHeight: '500px', 
              overflow: 'auto',
              padding: '16px',
              background: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '12px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {previewContent}
          </pre>
        </Card>
      )}

      <Card 
        size="small"
        title="导出说明"
        style={{ marginTop: 16 }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Descriptions title="Markdown 交接单使用说明" column={1} size="small">
              <Descriptions.Item label="用途">
                用于纸质存档、邮件传递、或导入到文档系统中
              </Descriptions.Item>
              <Descriptions.Item label="查看方式">
                可用任何文本编辑器打开，或使用 Markdown 编辑器预览（如 Typora、VS Code、在线编辑器等）
              </Descriptions.Item>
              <Descriptions.Item label="命名规则">
                自动命名为：交接单_YYYYMMDD_HHmmss.md
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={12}>
            <Descriptions title="JSON 审计包使用说明" column={1} size="small">
              <Descriptions.Item label="用途">
                用于数据备份、系统间数据交换、审计追踪、程序处理
              </Descriptions.Item>
              <Descriptions.Item label="查看方式">
                可用任何文本编辑器打开，或使用 JSON 格式化工具查看
              </Descriptions.Item>
              <Descriptions.Item label="命名规则">
                自动命名为：审计包_YYYYMMDD_HHmmss.json
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>

        <Divider />

        <Card size="small" title="交接单示例内容" type="inner">
          <pre style={{ fontSize: '12px', color: '#666', margin: 0 }}>
{`# 老照片底片扫描交接单

## 基本信息

| 项目 | 内容 |
|------|------|
| 导出时间 | 2024-01-15 14:30:00 |
| 总记录数 | 156 |
| 已修复 | 120 |
| 已复核 | 156 |
| 待处理风险 | 0 |

## 风险统计

| 风险类型 | 数量 | 待处理 |
|----------|------|--------|
| 缺文件 | 2 | 0 |
| 重复编号 | 1 | 0 |
| ... | ... | ... |

## 记录清单

### 底片盒: A001

| 张号 | 扫描文件 | 分辨率(DPI) | 修复状态 | 责任人 | 复核状态 |
|------|----------|-------------|----------|--------|----------|
| 1 | A001_001.tif | 600 | 已修复 | 张三 | 通过 |
| 2 | A001_002.tif | 300 | 修复中 | 李四 | 通过 |
| ... | ... | ... | ... | ... | ... |

---

*本交接单由老照片底片扫描管理系统自动生成*`}
          </pre>
        </Card>
      </Card>
    </div>
  );
}

export default ExportPage;
