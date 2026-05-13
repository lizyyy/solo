import React, { useState } from 'react';
import { Button, Modal, Form, Select, DatePicker, message, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { exportApi, plansApi } from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ExportModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);

  const handleOpen = async () => {
    setIsOpen(true);
    try {
      const response = await plansApi.getAll();
      if (response.data.success) {
        setPlans(response.data.data || []);
      }
    } catch (error) {
      console.error('获取计划列表失败:', error);
    }
  };

  const handleExport = async (values: any) => {
    setLoading(true);
    try {
      const exportData = {
        planId: values.planId,
        responsiblePerson: values.responsiblePerson,
        startDate: values.dateRange ? values.dateRange[0].toISOString() : undefined,
        endDate: values.dateRange ? values.dateRange[1].toISOString() : undefined,
      };

      const response = await exportApi.exportExcel(exportData);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `换线报告-${dayjs().format('YYYY-MM-DD')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('导出成功');
      setIsOpen(false);
      form.resetFields();
    } catch (error) {
      message.error('导出失败');
      console.error('导出失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const uniquePersons = Array.from(new Set(
    plans.map(p => p.responsiblePerson).filter(Boolean)
  ));

  return (
    <>
      <Button type="primary" icon={<DownloadOutlined />} onClick={handleOpen}>
        导出报告
      </Button>
      <Modal
        title="导出报告"
        open={isOpen}
        onCancel={() => setIsOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={loading}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleExport}
        >
          <Form.Item label="选择计划" name="planId">
            <Select placeholder="全部计划" allowClear>
              {plans.map(plan => (
                <Option key={plan.id} value={plan.id}>
                  {plan.planNo} - {plan.productName}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="负责人" name="responsiblePerson">
            <Select placeholder="全部负责人" allowClear>
              {uniquePersons.map(person => (
                <Option key={person} value={person}>
                  {person}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="处理时间范围" name="dateRange">
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ExportModal;
