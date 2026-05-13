import React from 'react';
import { Card, Row, Col, Button, Form, Select, DatePicker, message, Space } from 'antd';
import { FileExcelOutlined, FileTextOutlined, ShoppingOutlined } from '@ant-design/icons';
import { exportAPI, downloadFile } from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ExportCenter = () => {
  const [depositForm] = Form.useForm();
  const [handoverForm] = Form.useForm();
  const [flowForm] = Form.useForm();

  const handleExportDepositReport = async () => {
    try {
      const values = await depositForm.validateFields();
      const filters = {};
      if (values.dateRange) {
        filters.startDate = values.dateRange[0].format('YYYY-MM-DD');
        filters.endDate = values.dateRange[1].format('YYYY-MM-DD');
      }
      if (values.modifiedBy) {
        filters.modifiedBy = values.modifiedBy;
      }
      if (values.status) {
        filters.status = values.status;
      }

      message.loading('正在导出报告...', 0);
      const response = await exportAPI.exportDepositReport(filters);
      message.destroy();
      downloadFile(response.data, `押金赔付报告_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`);
      message.success('导出成功');
    } catch (error) {
      message.destroy();
      message.error('导出失败');
      console.error(error);
    }
  };

  const handleExportHandoverReport = async () => {
    try {
      const values = await handoverForm.validateFields();
      const filters = {};
      if (values.dateRange) {
        filters.startDate = values.dateRange[0].format('YYYY-MM-DD');
        filters.endDate = values.dateRange[1].format('YYYY-MM-DD');
      }

      message.loading('正在导出报告...', 0);
      const response = await exportAPI.exportSupplierHandoverReport(filters);
      message.destroy();
      downloadFile(response.data, `供应商交接报告_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`);
      message.success('导出成功');
    } catch (error) {
      message.destroy();
      message.error('导出失败');
      console.error(error);
    }
  };

  const handleExportFlowReport = async () => {
    try {
      const values = await flowForm.validateFields();
      const filters = {};
      if (values.dateRange) {
        filters.startDate = values.dateRange[0].format('YYYY-MM-DD');
        filters.endDate = values.dateRange[1].format('YYYY-MM-DD');
      }

      message.loading('正在导出报告...', 0);
      const response = await exportAPI.exportDepositFlowReport(filters);
      message.destroy();
      downloadFile(response.data, `押金流水报告_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`);
      message.success('导出成功');
    } catch (error) {
      message.destroy();
      message.error('导出失败');
      console.error(error);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>导出中心</h2>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card
            title={
              <Space>
                <FileExcelOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                <span>押金赔付报告</span>
              </Space>
            }
            className="export-card"
          >
            <p style={{ marginBottom: 16, color: '#666' }}>
              导出押金赔付汇总报告，包含修改历史、破损照片详情，可按责任人和处理时间筛选。
            </p>
            <Form form={depositForm} layout="vertical">
              <Form.Item name="dateRange" label="日期范围">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select placeholder="全部状态" allowClear>
                  <Option value="pending">待处理</Option>
                  <Option value="pending_review">待审核</Option>
                  <Option value="verified">已通过</Option>
                  <Option value="rejected">已拒绝</Option>
                </Select>
              </Form.Item>
              <Form.Item name="modifiedBy" label="责任人">
                <Select placeholder="全部责任人" allowClear>
                  <Option value={1}>系统管理员</Option>
                  <Option value={2}>操作员张三</Option>
                  <Option value={3}>审核员李四</Option>
                </Select>
              </Form.Item>
              <Button
                type="primary"
                block
                icon={<FileExcelOutlined />}
                onClick={handleExportDepositReport}
              >
                导出报告
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            title={
              <Space>
                <ShoppingOutlined style={{ color: '#1890ff', fontSize: 20 }} />
                <span>供应商交接报告</span>
              </Space>
            }
            className="export-card"
          >
            <p style={{ marginBottom: 16, color: '#666' }}>
              导出供应商托盘交接记录报告，包含交接单号、供应商信息、押金金额等详细数据。
            </p>
            <Form form={handoverForm} layout="vertical">
              <Form.Item name="dateRange" label="日期范围">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="supplierId" label="供应商">
                <Select placeholder="全部供应商" allowClear>
                  <Option value={1}>托盘供应商A</Option>
                  <Option value={2}>托盘供应商B</Option>
                </Select>
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select placeholder="全部状态" allowClear>
                  <Option value="pending">待处理</Option>
                  <Option value="verified">已通过</Option>
                </Select>
              </Form.Item>
              <Button
                type="primary"
                block
                icon={<FileExcelOutlined />}
                onClick={handleExportHandoverReport}
              >
                导出报告
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            title={
              <Space>
                <FileTextOutlined style={{ color: '#722ed1', fontSize: 20 }} />
                <span>押金流水报告</span>
              </Space>
            }
            className="export-card"
          >
            <p style={{ marginBottom: 16, color: '#666' }}>
              导出押金流水记录报告，包含流水号、流水类型、金额、状态、拦截原因等详细信息。
            </p>
            <Form form={flowForm} layout="vertical">
              <Form.Item name="dateRange" label="日期范围">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="flowType" label="流水类型">
                <Select placeholder="全部类型" allowClear>
                  <Option value="deposit">押金收取</Option>
                  <Option value="refund">押金退还</Option>
                  <Option value="compensation">赔付扣款</Option>
                </Select>
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select placeholder="全部状态" allowClear>
                  <Option value="pending">待处理</Option>
                  <Option value="blocked">已拦截</Option>
                  <Option value="processed">已处理</Option>
                </Select>
              </Form.Item>
              <Button
                type="primary"
                block
                icon={<FileExcelOutlined />}
                onClick={handleExportFlowReport}
              >
                导出报告
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ExportCenter;
