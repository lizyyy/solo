import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  Select,
  Checkbox,
  Radio,
  DatePicker,
  Card,
  Tabs,
  Space,
  Divider,
  message,
  Spin,
} from 'antd';
import {
  ExportOutlined,
  FileTextOutlined,
  CodeOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { LostItem, ItemStatus, ExportOptions } from '../../shared/types';

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { TextArea } = Form;

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  items: LostItem[];
  getStatusLabel: (status: ItemStatus) => string;
}

const ExportModal: React.FC<ExportModalProps> = ({ open, onClose, items, getStatusLabel }) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('preview');
  const [previewContent, setPreviewContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const uniqueStations = Array.from(new Set(items.map((i) => i.station))).sort();
  const uniqueStatuses = Array.from(new Set(items.map((i) => i.status))).sort();

  const statusOptions = uniqueStatuses.map((s) => ({
    label: getStatusLabel(s as ItemStatus),
    value: s,
  }));

  const stationOptions = uniqueStations.map((s) => ({
    label: s,
    value: s,
  }));

  const generatePreview = async (values: any) => {
    setLoading(true);
    try {
      const options: ExportOptions = {
        format: values.format || 'markdown',
        includePhotos: values.includePhotos || false,
        includeHistory: values.includeHistory || false,
        stationFilter: values.stationFilter || [],
        statusFilter: values.statusFilter || [],
        dateRange: values.dateRange
          ? {
              start: values.dateRange[0].toISOString(),
              end: values.dateRange[1].toISOString(),
            }
          : null,
      };

      let content = '';
      if (options.format === 'markdown') {
        content = await window.electronAPI.export.previewMarkdown(options);
      } else {
        content = await window.electronAPI.export.previewJson(options);
      }

      setPreviewContent(content);
    } catch (error) {
      message.error('生成预览失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleValuesChange = (changedValues: any, allValues: any) => {
    generatePreview(allValues);
  };

  const handleExport = async () => {
    try {
      const values = form.getFieldsValue();
      setExporting(true);

      const options: ExportOptions = {
        format: values.format || 'markdown',
        includePhotos: values.includePhotos || false,
        includeHistory: values.includeHistory || false,
        stationFilter: values.stationFilter || [],
        statusFilter: values.statusFilter || [],
        dateRange: values.dateRange
          ? {
              start: values.dateRange[0].toISOString(),
              end: values.dateRange[1].toISOString(),
            }
          : null,
      };

      let result: string | null;
      if (options.format === 'markdown') {
        result = await window.electronAPI.export.toMarkdown(options);
      } else {
        result = await window.electronAPI.export.toJson(options);
      }

      if (result) {
        message.success('导出成功');
        onClose();
      }
    } catch (error) {
      message.error('导出失败');
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyPreview = () => {
    navigator.clipboard
      .writeText(previewContent)
      .then(() => message.success('已复制到剪贴板'))
      .catch(() => message.error('复制失败'));
  };

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        format: 'markdown',
        includePhotos: false,
        includeHistory: false,
        stationFilter: [],
        statusFilter: [],
        dateRange: null,
      });
      generatePreview({
        format: 'markdown',
        includePhotos: false,
        includeHistory: false,
        stationFilter: [],
        statusFilter: [],
        dateRange: null,
      });
    }
  }, [open]);

  return (
    <Modal
      title="数据导出"
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="export" type="primary" loading={exporting} onClick={handleExport} icon={<ExportOutlined />}>
          导出文件
        </Button>,
      ]}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="导出设置" key="settings">
          <Form
            form={form}
            layout="vertical"
            onValuesChange={handleValuesChange}
            initialValues={{
              format: 'markdown',
              includePhotos: false,
              includeHistory: false,
              stationFilter: [],
              statusFilter: [],
              dateRange: null,
            }}
          >
            <Card size="small" title="基本选项" style={{ marginBottom: 16 }}>
              <Form.Item label="导出格式" name="format">
                <Radio.Group>
                  <Radio.Button value="markdown">
                    <FileTextOutlined /> Markdown
                  </Radio.Button>
                  <Radio.Button value="json">
                    <CodeOutlined /> JSON
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item label="包含内容" name={['includePhotos', 'includeHistory']}>
                <Checkbox.Group>
                  <Space direction="vertical">
                    <Checkbox value="includePhotos">包含照片信息</Checkbox>
                    <Checkbox value="includeHistory">包含历史记录（自动判断、人工复核等）</Checkbox>
                  </Space>
                </Checkbox.Group>
              </Form.Item>
            </Card>

            <Card size="small" title="筛选条件" style={{ marginBottom: 16 }}>
              <Form.Item label="筛选站点" name="stationFilter">
                <Select
                  mode="multiple"
                  placeholder="全部站点"
                  style={{ width: '100%' }}
                  options={stationOptions}
                  allowClear
                />
              </Form.Item>

              <Form.Item label="筛选状态" name="statusFilter">
                <Select
                  mode="multiple"
                  placeholder="全部状态"
                  style={{ width: '100%' }}
                  options={statusOptions}
                  allowClear
                />
              </Form.Item>

              <Form.Item label="时间范围" name="dateRange">
                <RangePicker
                  style={{ width: '100%' }}
                  placeholder={['开始日期', '结束日期']}
                  allowClear
                />
              </Form.Item>
            </Card>
          </Form>
        </TabPane>

        <TabPane tab="预览" key="preview">
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>预览内容</span>
            <Button icon={<CopyOutlined />} onClick={handleCopyPreview} size="small">
              复制
            </Button>
          </div>
          <Spin spinning={loading}>
            <div className="export-preview">
              {previewContent || '暂无预览内容'}
            </div>
          </Spin>
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default ExportModal;
