import React, { useState } from 'react';
import {
  Button,
  Form,
  Select,
  DatePicker,
  Space,
  message,
  Card,
  Typography,
  Row,
  Col,
  Statistic
} from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { reportsAPI } from '../services/api';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

function Reports() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      const params = {
        responsible_person: values.responsible_person
      };
      if (values.date_range) {
        params.start_date = values.date_range[0].format('YYYY-MM-DD');
        params.end_date = values.date_range[1].format('YYYY-MM-DD');
      }
      
      const res = await reportsAPI.export(params);
      if (res.data.success) {
        setDownloadUrl(res.data.download_url);
        message.success('报表生成成功');
      }
    } catch (error) {
      message.error('导出报表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
    setDownloadUrl(null);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>报表导出</Title>

      <Card style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date_range" label="处理时间范围">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="responsible_person" label="责任人">
                <Select placeholder="请输入责任人姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                onClick={handleExport}
                loading={loading}
              >
                生成Excel报表
              </Button>
              <Button onClick={handleReset}>重置</Button>
              {downloadUrl && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                >
                  下载报表
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="导出说明">
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Statistic
              title="报表内容"
              value="系统导出的报表包含以下数据：礼品库存、活动计划、客户名单、员工领用、快递单号、退回入库、异常记录"
              valueStyle={{ fontSize: 14, fontWeight: 'normal' }}
            />
          </Col>
          <Col span={24}>
            <Statistic
              title="筛选条件"
              value="支持按处理时间范围和责任人进行筛选，导出符合条件的数据"
              valueStyle={{ fontSize: 14, fontWeight: 'normal' }}
            />
          </Col>
          <Col span={24}>
            <Statistic
              title="文件格式"
              value="Excel格式 (.xlsx)，可直接在Microsoft Excel、WPS等软件中打开"
              valueStyle={{ fontSize: 14, fontWeight: 'normal' }}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default Reports;
