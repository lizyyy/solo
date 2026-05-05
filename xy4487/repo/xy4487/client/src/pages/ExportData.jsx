import React, { useState } from 'react';
import {
  Card,
  Button,
  Descriptions,
  message,
  Spin,
  Divider,
  Alert,
} from 'antd';
import {
  FileTextOutlined,
  CodeOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { exportAPI } from '../utils/api';
import dayjs from 'dayjs';

function ExportData() {
  const [loading, setLoading] = useState(false);

  const handleExportDispatchNotes = async () => {
    setLoading(true);
    try {
      const response = await exportAPI.getDispatchNotes();
      const blob = new Blob([response.data], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dispatch-notes-${dayjs().format('YYYYMMDD-HHmmss')}.md`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('派工单导出成功');
    } catch (error) {
      message.error('导出失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportAuditPackage = async () => {
    setLoading(true);
    try {
      const response = await exportAPI.getAuditPackage();
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-package-${dayjs().format('YYYYMMDD-HHmmss')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('审计包导出成功');
    } catch (error) {
      message.error('导出失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div className="page-header">
        <h2>数据导出</h2>
        <p>导出派工单和审计包，用于存档和审计</p>
      </div>

      <Alert
        message="导出说明"
        description={
          <div>
            <p>系统支持两种导出格式：</p>
            <ul style={{ margin: '8px 0 0 20px' }}>
              <li><strong>Markdown 派工单</strong>：包含所有预约的详细信息、风险评估和改判记录，适合打印或分享</li>
              <li><strong>JSON 审计包</strong>：包含所有数据的结构化导出，包含统计汇总、风险分析和审计日志，用于数据备份和审计</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileTextOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <span>Markdown 派工单</span>
            </div>
          }
          extra={
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportDispatchNotes}
              size="large"
            >
              导出
            </Button>
          }
        >
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="文件格式">
              Markdown (.md)
            </Descriptions.Item>
            <Descriptions.Item label="包含内容">
              所有预约记录、农户信息、机具信息、机手信息、风险评估结果、手动改判记录、油料补贴信息、统计汇总
            </Descriptions.Item>
            <Descriptions.Item label="用途">
              打印派工单、存档备查、分享给作业人员
            </Descriptions.Item>
            <Descriptions.Item label="特点">
              人类可读、格式化良好、支持直接打印
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CodeOutlined style={{ fontSize: 24, color: '#722ed1' }} />
              <span>JSON 审计包</span>
            </div>
          }
          extra={
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportAuditPackage}
              size="large"
              style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
            >
              导出
            </Button>
          }
        >
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="文件格式">
              JSON (.json)
            </Descriptions.Item>
            <Descriptions.Item label="包含内容">
              完整数据导出（地块、机具、机手、预约、补贴、风险评估、审计日志）、统计汇总、风险类型统计、风险等级统计、最近操作记录
            </Descriptions.Item>
            <Descriptions.Item label="用途">
              数据备份、审计追踪、数据分析、系统迁移
            </Descriptions.Item>
            <Descriptions.Item label="特点">
              结构化数据、机器可读、包含完整审计日志
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      <Divider>单个预约导出</Divider>

      <Alert
        message="提示"
        description="单个预约的派工单导出请前往「预约管理」页面，点击对应预约的「派工单」按钮进行导出。"
        type="info"
        showIcon
      />

      <Card title="导出内容示例说明" style={{ marginTop: 24 }}>
        <h4 style={{ marginBottom: 16 }}>Markdown 派工单包含：</h4>
        <ul style={{ marginLeft: 20 }}>
          <li>派工单编号和生成时间</li>
          <li>农户与地块信息（姓名、地块名、面积、位置、作物类型）</li>
          <li>作业信息（类型、开始/结束时间）</li>
          <li>机具信息（名称、类型、车牌号、上次保养日期）</li>
          <li>机手信息（姓名、电话、驾驶证类型、到期日期）</li>
          <li>油料补贴信息（补贴金额、油耗、单位补贴）</li>
          <li>风险评估详情（风险类型、等级、描述、改判原因）</li>
          <li>统计汇总（总数量、可放行数量、被拦截数量）</li>
        </ul>

        <h4 style={{ margin: '24px 0 16px 0' }}>JSON 审计包包含：</h4>
        <ul style={{ marginLeft: 20 }}>
          <li>生成时间和版本号</li>
          <li>统计摘要（各类数据数量、拦截数、改判数）</li>
          <li>完整数据集
            <ul style={{ marginTop: 8, marginLeft: 20 }}>
              <li>地块数据</li>
              <li>机具数据</li>
              <li>机手数据</li>
              <li>预约数据</li>
              <li>油料补贴数据</li>
              <li>风险评估数据</li>
              <li>审计日志（所有操作记录）</li>
            </ul>
          </li>
          <li>风险摘要
            <ul style={{ marginTop: 8, marginLeft: 20 }}>
              <li>按风险类型统计</li>
              <li>按风险等级统计</li>
              <li>最近20条操作记录</li>
            </ul>
          </li>
        </ul>
      </Card>
    </Spin>
  );
}

export default ExportData;
