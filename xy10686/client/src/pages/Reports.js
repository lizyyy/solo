import React, { useState } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Space, message, Row, Col } from 'antd';
import { DownloadOutlined, FileTextOutlined, FileExcelOutlined } from '@ant-design/icons';
import { orderApi, inspectionApi } from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Reports = () => {
  const [orderForm] = Form.useForm();
  const [inspectionForm] = Form.useForm();
  const [exporting, setExporting] = useState(false);

  const handleExportOrders = async () => {
    const values = orderForm.getFieldsValue();
    const params = {};
    if (values.responsiblePerson) params.responsiblePerson = values.responsiblePerson;
    if (values.dateRange && values.dateRange.length === 2) {
      params.startDate = values.dateRange[0].format('YYYY-MM-DD');
      params.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }

    setExporting(true);
    try {
      orderApi.export(params);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleExportInspections = async () => {
    const values = inspectionForm.getFieldsValue();
    const params = {};
    if (values.inspector) params.inspector = values.inspector;
    if (values.dateRange && values.dateRange.length === 2) {
      params.startDate = values.dateRange[0].format('YYYY-MM-DD');
      params.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    if (values.status) params.status = values.status;

    setExporting(true);
    try {
      inspectionApi.export(params);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>报表导出</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileExcelOutlined />
                材料订单报表
              </Space>
            }
            className="table-container"
          >
            <Form form={orderForm} layout="vertical">
              <Form.Item name="responsiblePerson" label="责任人">
                <Input placeholder="请输入责任人，为空则导出全部" />
              </Form.Item>
              <Form.Item name="dateRange" label="创建日期范围">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExportOrders}
                  loading={exporting}
                  block
                >
                  导出订单报表 CSV
                </Button>
              </Form.Item>
            </Form>
            <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '4px', fontSize: '12px' }}>
              <p style={{ margin: 0 }}>
                <FileTextOutlined style={{ marginRight: 8 }} />
                报表包含：订单编号、项目名称、材料名称、规格型号、数量、单位、单价、总金额、供应商、责任人、状态、创建日期等字段
              </p>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileExcelOutlined />
                验收记录报表
              </Space>
            }
            className="table-container"
          >
            <Form form={inspectionForm} layout="vertical">
              <Form.Item name="inspector" label="质检员">
                <Input placeholder="请输入质检员，为空则导出全部" />
              </Form.Item>
              <Form.Item name="status" label="验收状态">
                <Select placeholder="请选择状态，为空则导出全部" allowClear>
                  <Option value="draft">草稿</Option>
                  <Option value="submitted">已提交</Option>
                  <Option value="reviewed">已审核</Option>
                  <Option value="completed">已完成</Option>
                </Select>
              </Form.Item>
              <Form.Item name="dateRange" label="验收日期范围">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExportInspections}
                  loading={exporting}
                  block
                >
                  导出验收报表 CSV
                </Button>
              </Form.Item>
            </Form>
            <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '4px', fontSize: '12px' }}>
              <p style={{ margin: 0 }}>
                <FileTextOutlined style={{ marginRight: 8 }} />
                报表包含：验收单号、订单编号、送货单号、项目名称、材料名称、验收日期、验收数量、合格数量、拒收数量、验收结果、拒收原因、质检员、状态等字段
              </p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Reports;
