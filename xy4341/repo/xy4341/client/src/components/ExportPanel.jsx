import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  message,
  Descriptions,
  Modal,
  Typography
} from 'antd';
import { 
  FileTextOutlined, 
  DownloadOutlined,
  EyeOutlined,
  AuditOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import useStore from '../store';
import { exportsApi } from '../services/api';

const { Paragraph, Text, Title } = Typography;

function ExportPanel() {
  const { currentDrill, events, riskAssessments, persons, exits } = useStore();
  const [previewReport, setPreviewReport] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [exporting, setExporting] = useState(false);
  
  const generateReportSummary = () => {
    const summary = {
      totalPersons: persons.length,
      evacuated: persons.filter(p => p.status === 'evacuated').length,
      trapped: persons.filter(p => p.status === 'trapped' || p.status === 'injured').length,
      idle: persons.filter(p => p.status === 'idle').length,
      totalExits: exits.length,
      availableExits: exits.filter(e => e.status === 'available').length,
      blockedExits: exits.filter(e => e.status === 'blocked').length,
      totalEvents: events.length,
      fireEvents: events.filter(e => e.event_type === 'fire_detected').length,
      congestionEvents: events.filter(e => e.event_type === 'congestion_detected').length,
      maxTimeStep: events.length > 0 ? Math.max(...events.map(e => e.time_step)) : 0
    };
    
    summary.evacuationRate = summary.totalPersons > 0 
      ? ((summary.evacuated / summary.totalPersons) * 100).toFixed(1)
      : 0;
    
    return summary;
  };
  
  const handleGenerateReport = async (preview = false) => {
    if (!currentDrill) {
      message.warning('请先开始演练');
      return;
    }
    
    setExporting(true);
    try {
      const response = await exportsApi.generateReport(currentDrill.id, 'markdown');
      if (preview) {
        setReportContent(response.data?.content || '报告生成中...');
        setPreviewReport(true);
      } else {
        message.success('报告已生成');
      }
    } catch (error) {
      message.error('生成报告失败: ' + (error.message || '未知错误'));
    } finally {
      setExporting(false);
    }
  };
  
  const handleDownloadReport = async (format = 'markdown') => {
    if (!currentDrill) {
      message.warning('请先开始演练');
      return;
    }
    
    setExporting(true);
    try {
      const response = await exportsApi.generateReport(currentDrill.id, format);
      const content = response.data?.content || '';
      
      const blob = new Blob([content], { 
        type: format === 'json' ? 'application/json' : 'text/markdown' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fire-drill-report-${Date.now()}.${format === 'json' ? 'json' : 'md'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success(`报告已下载 (${format})`);
    } catch (error) {
      message.error('下载报告失败');
    } finally {
      setExporting(false);
    }
  };
  
  const handleExportAudit = async () => {
    if (!currentDrill) {
      message.warning('请先开始演练');
      return;
    }
    
    setExporting(true);
    try {
      const response = await exportsApi.exportAudit(currentDrill.id);
      const data = response.data;
      
      const content = JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fire-drill-audit-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success('审计包已导出');
    } catch (error) {
      message.error('导出审计包失败');
    } finally {
      setExporting(false);
    }
  };
  
  const summary = generateReportSummary();
  
  return (
    <div className="export-panel">
      <Card 
        size="small"
        title={
          <Space>
            <FileTextOutlined />
            <span>演练报告导出</span>
          </Space>
        }
      >
        <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="演练状态">
            <Text type={currentDrill ? 'success' : 'secondary'}>
              {currentDrill 
                ? (currentDrill.status === 'running' ? '运行中' : 
                   currentDrill.status === 'paused' ? '已暂停' : 
                   currentDrill.status === 'completed' ? '已完成' : '未开始')
                : '未开始'}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="时间步">
            <Text strong>{currentDrill?.current_time_step || 0}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="总人数">
            <Text strong>{summary.totalPersons}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="疏散率">
            <Text 
              strong 
              type={parseFloat(summary.evacuationRate) >= 80 ? 'success' : 'warning'}
            >
              {summary.evacuationRate}%
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="可用出口">
            <Text strong type="success">{summary.availableExits}/{summary.totalExits}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="事件总数">
            <Text strong>{summary.totalEvents}</Text>
          </Descriptions.Item>
        </Descriptions>
        
        <div className="export-options">
          <div className="export-section">
            <div className="export-section-title">
              <SafetyOutlined /> 演练报告
            </div>
            <Space.Compact>
              <Button 
                icon={<EyeOutlined />}
                onClick={() => handleGenerateReport(true)}
                loading={exporting}
              >
                预览报告
              </Button>
              <Button 
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadReport('markdown')}
                loading={exporting}
              >
                下载 Markdown
              </Button>
              <Button 
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadReport('json')}
                loading={exporting}
              >
                下载 JSON
              </Button>
            </Space.Compact>
          </div>
          
          <div className="export-section">
            <div className="export-section-title">
              <AuditOutlined /> 审计数据
            </div>
            <Button 
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportAudit}
              loading={exporting}
              disabled={!currentDrill}
            >
              导出完整审计包 (JSON)
            </Button>
            <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
              包含：演练配置、人员状态、出口状态、事件日志、风险评估记录
            </div>
          </div>
        </div>
      </Card>
      
      <Modal
        title="演练报告预览"
        open={previewReport}
        onCancel={() => setPreviewReport(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewReport(false)}>
            关闭
          </Button>,
          <Button 
            key="download" 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={() => {
              handleDownloadReport('markdown');
              setPreviewReport(false);
            }}
          >
            下载报告
          </Button>
        ]}
        width={800}
        style={{ top: 20 }}
      >
        <div style={{ 
          maxHeight: '70vh', 
          overflow: 'auto', 
          background: '#fafafa',
          padding: 16,
          borderRadius: 4,
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '13px',
          lineHeight: '1.6'
        }}>
          {reportContent || '报告内容加载中...'}
        </div>
      </Modal>
    </div>
  );
}

export default ExportPanel;
