import React, { useState } from 'react';
import { Card, Form, Select, DatePicker, Button, message, Table, Tag } from 'antd';
import { ExportOutlined, DownloadOutlined } from '@ant-design/icons';
import { exportAPI, workOrderAPI } from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const statusOptions = [
  { value: 'pending', label: '待处理' },
  { value: 'assigned', label: '已分派' },
  { value: 'processing', label: '处理中' },
  { value: 'reviewing', label: '复核中' },
  { value: 'completed', label: '已完成' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'blocked', label: '已拦截' }
];

const sceneOptions = [
  { value: 'normal', label: '正常流程' },
  { value: 'blocked', label: '规则拦截' },
  { value: 'review', label: '人工复核' },
  { value: 'duplicate', label: '重复提交' }
];

const statusMap: { [key: string]: { text: string; color: string } } = {
  pending: { text: '待处理', color: 'default' },
  assigned: { text: '已分派', color: 'blue' },
  processing: { text: '处理中', color: 'orange' },
  reviewing: { text: '复核中', color: 'purple' },
  completed: { text: '已完成', color: 'green' },
  rejected: { text: '已拒绝', color: 'red' },
  blocked: { text: '已拦截', color: 'red' }
};

const sceneMap: { [key: string]: { text: string; color: string } } = {
  normal: { text: '正常流程', color: 'green' },
  blocked: { text: '规则拦截', color: 'red' },
  review: { text: '人工复核', color: 'orange' },
  duplicate: { text: '重复提交', color: 'purple' }
};

const ExportPage: React.FC = () => {
  const [form] = Form.useForm();
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handlePreview = async (values: any) => {
    setLoading(true);
    try {
      const params: any = {};
      if (values.status) params.status = values.status;
      if (values.scene) params.scene = values.scene;
      
      const res = await workOrderAPI.list(params);
      setPreviewData(res.data.list || []);
      message.success(`预览到 ${res.data.list?.length || 0} 条数据`);
    } catch (error) {
      message.error('预览数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (values: any) => {
    setExporting(true);
    try {
      const exportData: any = {
        operatorId: 'user-001',
        operatorName: '当前用户'
      };

      if (values.dateRange && values.dateRange.length === 2) {
        exportData.startDate = values.dateRange[0].toISOString();
        exportData.endDate = values.dateRange[1].toISOString();
      }
      if (values.status) exportData.status = values.status;
      if (values.responsiblePersonId) exportData.responsiblePersonId = values.responsiblePersonId;

      const res = await exportAPI.exportWorkOrders(exportData);
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `工单导出_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('导出成功！导出文件包含工单列表、照片修改记录、修改历史');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { title: '工单编号', dataIndex: 'orderNo', key: 'orderNo', width: 140 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => {
        const info = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    { title: '场景', dataIndex: 'scene', key: 'scene', width: 100,
      render: (scene: string) => {
        const info = sceneMap[scene] || { text: scene, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  return (
    <div>
      <Card title="数据导出" extra={<Tag color="blue">支持按责任人、时间筛选</Tag>}>
        <Form form={form} layout="inline" onFinish={handlePreview} style={{ marginBottom: 24 }}>
          <Form.Item name="dateRange" label="时间范围">
            <RangePicker showTime />
          </Form.Item>
          <Form.Item name="status" label="工单状态">
            <Select placeholder="全部状态" allowClear style={{ width: 120 }}>
              {statusOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="scene" label="处理场景">
            <Select placeholder="全部场景" allowClear style={{ width: 120 }}>
              {sceneOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<ExportOutlined />} loading={loading}>
              预览
            </Button>
          </Form.Item>
          <Form.Item>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              loading={exporting}
              onClick={() => form.validateFields().then(values => handleExport(values))}
            >
              导出Excel
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
          <p style={{ marginBottom: 0 }}>
            <strong>导出说明：</strong>导出的Excel文件包含三个Sheet页：
            <br />1. 工单列表 - 所有工单的基础信息
            <br />2. 照片修改记录 - 处理照片的修改记录，包括谁修改的、为什么修改
            <br />3. 修改历史记录 - 所有字段的变更历史，包括原值、新值、修改人、影响记录
          </p>
        </div>

        {previewData.length > 0 && (
          <Card title="导出预览" size="small">
            <Table
              columns={columns}
              dataSource={previewData}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        )}
      </Card>
    </div>
  );
};

export default ExportPage;
