import { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, Button, message } from 'antd';
import { Plus, FlaskConical } from 'lucide-react';
import dayjs from 'dayjs';

interface BottleFormData {
  bottleNo: string;
  batchNo: string;
  experimentResult: string;
  resultUnit: string;
  sampledAt: dayjs.Dayjs;
  remark?: string;
}

interface NewBottleData {
  bottleNo: string;
  batchNo: string;
  experimentResult: string;
  resultUnit: string;
  sampledAt: string;
  sequence: number;
  remark: string;
}

interface BatchAddModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (data: {
    bottles: NewBottleData[];
    reason: string;
    remark: string;
    operator: string;
  }) => void;
  reportNo: string;
  existingBatches: string[];
  existingBottleCount: number;
}

const unitOptions = ['mg/L', 'μg/L', 'g/m³', 'kg/m³', 'ppm', '其他'];

export default function BatchAddModal({
  open,
  onCancel,
  onConfirm,
  reportNo,
  existingBatches,
  existingBottleCount,
}: BatchAddModalProps) {
  const [form] = Form.useForm();
  const [bottleCount, setBottleCount] = useState(1);
  const [operator] = useState('老何');

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const bottles = Array.from({ length: bottleCount }, (_, i) => ({
        bottleNo: `${values.bottlePrefix}-${String(i + 1).padStart(2, '0')}`,
        batchNo: values.batchNo,
        experimentResult: values.experimentResult || '',
        resultUnit: values.resultUnit,
        sampledAt: values.sampledAt.format('YYYY-MM-DDTHH:mm:ss'),
        sequence: existingBottleCount + i + 1,
        remark: values.remark || '',
      }));

      onConfirm({
        bottles,
        reason: values.reason || '批次补录',
        remark: values.remark || '',
        operator,
      });

      message.success('补录成功');
      form.resetFields();
      setBottleCount(1);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const suggestedBatchNo = existingBatches.length > 0
    ? `BATCH-${String(existingBatches.length + 1).padStart(2, '0')}`
    : 'BATCH-01';

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-blue-600" />
          补录采样瓶 - {reportNo}
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={560}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit}>
          确认补录
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" initialValues={{
        batchNo: suggestedBatchNo,
        resultUnit: 'mg/L',
        sampledAt: dayjs(),
      }}>
        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="batchNo"
            label="批次号"
            rules={[{ required: true, message: '请输入批次号' }]}
          >
            <Input placeholder="如 BATCH-02" />
          </Form.Item>

          <Form.Item
            label="补录数量"
            name="bottleCount"
            initialValue={1}
          >
            <InputNumber
              min={1}
              max={20}
              value={bottleCount}
              onChange={(v) => setBottleCount(Number(v) || 1)}
              style={{ width: '100%' }}
              addonAfter="瓶"
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="bottlePrefix"
            label="采样瓶编号前缀"
            rules={[{ required: true, message: '请输入编号前缀' }]}
          >
            <Input placeholder="如 P-0615-B" />
          </Form.Item>

          <Form.Item
            name="sampledAt"
            label="采样时间"
            rules={[{ required: true, message: '请选择采样时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="experimentResult"
            label="实验结果"
          >
            <Input placeholder="如 3.25" />
          </Form.Item>

          <Form.Item
            name="resultUnit"
            label="结果单位"
            rules={[{ required: true, message: '请选择单位' }]}
          >
            <Select options={unitOptions.map((u) => ({ label: u, value: u }))} />
          </Form.Item>
        </div>

        <Form.Item name="reason" label="补录原因">
          <Input placeholder="如 第二批采样结果到齐" />
        </Form.Item>

        <Form.Item name="remark" label="备注说明">
          <Input.TextArea rows={3} placeholder="选填：本次补录的详细说明..." />
        </Form.Item>

        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
          <div className="font-medium mb-1">
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            补录说明
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-blue-600">
            <li>补录数据不会覆盖原有数据，所有历史数据均可追溯</li>
            <li>系统会自动检测单位是否一致，发现异常将标记提醒</li>
            <li>补录记录将写入变更历史，包含旧值、新值和改判原因</li>
          </ul>
        </div>
      </Form>
    </Modal>
  );
}
