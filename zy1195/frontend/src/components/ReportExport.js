import React, { useState } from 'react';
import { Button, Dropdown, Space, message, Modal, Descriptions, Tag, Typography, Radio } from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  CodeOutlined,
  EyeOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Text, Paragraph } = Typography;
const { Group: RadioGroup } = Radio;

const ReportExport = ({ experimentId }) => {
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFormat, setPreviewFormat] = useState('markdown');
  const [previewContent, setPreviewContent] = useState(null);

  const handleDownload = async (format) => {
    try {
      message.loading({ content: `正在生成 ${format.toUpperCase()} 报告...`, key: 'download' });
      api.downloadReport(experimentId, format);
      message.success({ content: '报告下载已开始', key: 'download' });
    } catch (err) {
      console.error('下载报告失败:', err);
      message.error('下载报告失败');
    }
  };

  const handlePreview = async (format) => {
    setLoading(true);
    try {
      const res = await api.getReport(experimentId, format);
      setPreviewFormat(format);
      setPreviewContent(res.data.data);
      setPreviewVisible(true);
    } catch (err) {
      console.error('获取报告失败:', err);
      message.error('获取报告失败');
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      key: 'download-markdown',
      icon: <FileTextOutlined />,
      label: '下载 Markdown 报告',
      onClick: () => handleDownload('markdown')
    },
    {
      key: 'download-json',
      icon: <CodeOutlined />,
      label: '下载 JSON 报告',
      onClick: () => handleDownload('json')
    },
    {
      key: 'preview-markdown',
      icon: <EyeOutlined />,
      label: '预览报告',
      onClick: () => handlePreview('markdown')
    }
  ];

  return (
    <>
      <Space>
        <Dropdown.Button
          menu={{ items: menuItems }}
          icon={<DownloadOutlined />}
          onClick={() => handleDownload('markdown')}
          loading={loading}
        >
          导出报告
        </Dropdown.Button>
      </Space>

      <Modal
        title="实验报告预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="download" 
            type="primary" 
            onClick={() => handleDownload(previewFormat)}
          >
            下载报告
          </Button>
        ]}
        width={900}
      >
        {previewFormat === 'json' ? (
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: 16, 
              borderRadius: 4,
              fontSize: 12,
              overflow: 'auto'
            }}>
              {JSON.stringify(previewContent, null, 2)}
            </pre>
          </div>
        ) : (
          <div 
            style={{ 
              maxHeight: '60vh', 
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              fontFamily: 'SF Mono, Monaco, monospace',
              fontSize: 13,
              lineHeight: 1.6
            }}
          >
            {previewContent}
          </div>
        )}
      </Modal>
    </>
  );
};

export default ReportExport;
