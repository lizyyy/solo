import React from 'react';
import { Button, Space, message, Card, Typography, Divider } from 'antd';
import {
  FileTextOutlined,
  FileJsonOutlined,
  DownloadOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { RiskLevelLabels, ActionTypeLabels, RiskLevel, ActionType } from '../types';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

function generateMarkdownReport(
  bridgeName,
  components,
  inspections,
  alarms,
  closureWindows,
  userOverrides,
  userNotes
) {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const stats = {
    total: components.length,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
    retest: 0,
    restrict: 0,
    immediate: 0,
    normal: 0,
  };

  components.forEach((comp) => {
    const analysis = comp.analysis || {};
    const riskLevel = analysis.riskLevel || RiskLevel.LOW;
    const actionType = userOverrides?.[comp.id] || analysis.actionType || ActionType.NORMAL;

    stats[riskLevel] = (stats[riskLevel] || 0) + 1;
    stats[actionType] = (stats[actionType] || 0) + 1;
  });

  const highRiskComponents = components.filter(
    (c) =>
      c.analysis?.riskLevel === RiskLevel.HIGH ||
      c.analysis?.riskLevel === RiskLevel.CRITICAL
  );

  let md = `# 桥梁巡检处置单\n\n`;
  md += `**桥梁名称**: ${bridgeName || '未命名桥梁'}\n\n`;
  md += `**生成时间**: ${now}\n\n`;

  md += `---\n\n`;

  md += `## 一、风险统计概览\n\n`;
  md += `| 风险等级 | 数量 | 占比 |\n`;
  md += `|----------|------|------|\n`;
  md += `| ${RiskLevelLabels[RiskLevel.LOW]} | ${stats.low} | ${((stats.low / stats.total) * 100).toFixed(1)}% |\n`;
  md += `| ${RiskLevelLabels[RiskLevel.MEDIUM]} | ${stats.medium} | ${((stats.medium / stats.total) * 100).toFixed(1)}% |\n`;
  md += `| ${RiskLevelLabels[RiskLevel.HIGH]} | ${stats.high} | ${((stats.high / stats.total) * 100).toFixed(1)}% |\n`;
  md += `| ${RiskLevelLabels[RiskLevel.CRITICAL]} | ${stats.critical} | ${((stats.critical / stats.total) * 100).toFixed(1)}% |\n\n`;

  md += `## 二、处置建议统计\n\n`;
  md += `| 处置类型 | 数量 |\n`;
  md += `|----------|------|\n`;
  md += `| ${ActionTypeLabels[ActionType.NORMAL]} | ${stats.normal} |\n`;
  md += `| ${ActionTypeLabels[ActionType.RETEST]} | ${stats.retest} |\n`;
  md += `| ${ActionTypeLabels[ActionType.RESTRICT]} | ${stats.restrict} |\n`;
  md += `| ${ActionTypeLabels[ActionType.IMMEDIATE]} | ${stats.immediate} |\n\n`;

  if (highRiskComponents.length > 0) {
    md += `---\n\n`;
    md += `## 三、高风险构件详情\n\n`;

    highRiskComponents.forEach((comp, index) => {
      const analysis = comp.analysis || {};
      const actionType = userOverrides?.[comp.id] || analysis.actionType || ActionType.NORMAL;
      const isOverride = !!userOverrides?.[comp.id];
      const note = userNotes?.[comp.id];

      md += `### ${index + 1}. ${comp.name}\n\n`;
      md += `- **构件ID**: \`${comp.id}\`\n`;
      md += `- **风险等级**: **${RiskLevelLabels[analysis.riskLevel || RiskLevel.LOW]}**\n`;
      md += `- **处置建议**: ${ActionTypeLabels[actionType]} ${isOverride ? '(人工改判)' : ''}\n\n`;

      if (analysis.riskReasons?.length > 0) {
        md += `**风险原因**:\n`;
        analysis.riskReasons.forEach((reason) => {
          md += `- ${reason}\n`;
        });
        md += `\n`;
      }

      if (analysis.inspections?.length > 0) {
        md += `**巡检记录**:\n`;
        analysis.inspections.forEach((ins) => {
          const date = ins.date || ins.inspectionDate || '未知日期';
          if (ins.type === 'crack') {
            md += `- ${date}: 裂缝 宽度${ins.width}mm, 长度${ins.length}cm, 深度${ins.depth}cm\n`;
          } else {
            md += `- ${date}: 锈蚀 等级${ins.level}, 面积${ins.area}%\n`;
          }
        });
        md += `\n`;
      }

      if (analysis.alarms?.length > 0) {
        md += `**传感器告警**:\n`;
        analysis.alarms.forEach((alarm) => {
          const time = alarm.time || alarm.alarmTime || '未知时间';
          const levelText =
            alarm.level === 'critical'
              ? '严重告警'
              : alarm.level === 'alarm'
              ? '告警'
              : '预警';
          md += `- ${time}: ${levelText} 振幅${alarm.amplitude}mm, 频率${alarm.frequency}Hz\n`;
        });
        md += `\n`;
      }

      if (note) {
        md += `**备注**: ${note}\n\n`;
      }

      md += `---\n\n`;
    });
  }

  if (closureWindows?.length > 0) {
    md += `## 四、临时封道窗口\n\n`;
    md += `| 构件ID | 开始时间 | 结束时间 | 原因 |\n`;
    md += `|--------|----------|----------|------|\n`;
    closureWindows.forEach((w) => {
      md += `| ${w.componentId} | ${w.startTime || '-'} | ${w.endTime || '-'} | ${w.reason || '-'} |\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;
  md += `## 五、完整构件清单\n\n`;
  md += `| 构件名称 | 类型 | 风险等级 | 处置建议 |\n`;
  md += `|----------|------|----------|----------|\n`;

  components.forEach((comp) => {
    const analysis = comp.analysis || {};
    const actionType = userOverrides?.[comp.id] || analysis.actionType || ActionType.NORMAL;
    const isOverride = !!userOverrides?.[comp.id];

    md += `| ${comp.name} | ${comp.type} | ${RiskLevelLabels[analysis.riskLevel || RiskLevel.LOW]} | ${ActionTypeLabels[actionType]}${isOverride ? '(改判)' : ''} |\n`;
  });

  md += `\n`;
  md += `---\n\n`;
  md += `*此报告由桥梁巡检3D复盘工具自动生成*\n`;

  return md;
}

function generateJSONExport(
  bridgeName,
  components,
  inspections,
  alarms,
  closureWindows,
  userOverrides,
  userNotes
) {
  const exportData = {
    bridgeName: bridgeName || '未命名桥梁',
    exportTime: new Date().toISOString(),
    data: {
      components: components.map((c) => ({
        ...c,
        analysis: c.analysis,
        userAction: userOverrides?.[c.id] || null,
        userNote: userNotes?.[c.id] || null,
      })),
      inspections,
      alarms,
      closureWindows,
      userOverrides,
      userNotes,
    },
    statistics: {
      totalComponents: components.length,
      riskDistribution: {},
      actionDistribution: {},
    },
  };

  components.forEach((comp) => {
    const analysis = comp.analysis || {};
    const riskLevel = analysis.riskLevel || RiskLevel.LOW;
    const actionType = userOverrides?.[comp.id] || analysis.actionType || ActionType.NORMAL;

    exportData.statistics.riskDistribution[riskLevel] =
      (exportData.statistics.riskDistribution[riskLevel] || 0) + 1;
    exportData.statistics.actionDistribution[actionType] =
      (exportData.statistics.actionDistribution[actionType] || 0) + 1;
  });

  return JSON.stringify(exportData, null, 2);
}

function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ExportPanel({
  bridgeName,
  components,
  inspections,
  alarms,
  closureWindows,
  userOverrides,
  userNotes,
}) {
  const hasData = components?.length > 0;

  const handleExportMarkdown = () => {
    if (!hasData) {
      message.warning('请先导入数据');
      return;
    }

    const content = generateMarkdownReport(
      bridgeName,
      components,
      inspections,
      alarms,
      closureWindows,
      userOverrides,
      userNotes
    );

    const filename = `桥梁巡检处置单_${dayjs().format('YYYYMMDD_HHmmss')}.md`;
    downloadFile(content, filename, 'text/markdown');
    message.success('Markdown 处置单导出成功');
  };

  const handleExportJSON = () => {
    if (!hasData) {
      message.warning('请先导入数据');
      return;
    }

    const content = generateJSONExport(
      bridgeName,
      components,
      inspections,
      alarms,
      closureWindows,
      userOverrides,
      userNotes
    );

    const filename = `桥梁巡检明细_${dayjs().format('YYYYMMDD_HHmmss')}.json`;
    downloadFile(content, filename, 'application/json');
    message.success('JSON 明细导出成功');
  };

  return (
    <Card size="small" title={<span><BarChartOutlined /> 数据导出</span>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          导出当前桥梁的风险分析结果和处置建议
        </Text>

        <Button
          type="primary"
          icon={<FileTextOutlined />}
          onClick={handleExportMarkdown}
          disabled={!hasData}
          block
        >
          导出 Markdown 处置单
        </Button>

        <Button
          icon={<FileJsonOutlined />}
          onClick={handleExportJSON}
          disabled={!hasData}
          block
        >
          导出 JSON 明细
        </Button>

        {!hasData && (
          <Text type="danger" style={{ fontSize: 12 }}>
            提示：请先导入桥跨结构数据
          </Text>
        )}
      </Space>
    </Card>
  );
}
