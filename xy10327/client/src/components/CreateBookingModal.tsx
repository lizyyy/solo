import { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  TimePicker, 
  InputNumber,
  message,
  Space,
  Card,
  Button
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { Room, Store } from '../types';
import { api } from '../api';

interface CreateBookingModalProps {
  visible: boolean;
  rooms: Room[];
  stores: Store[];
  onCancel: () => void;
  onSuccess: () => void;
}

const { RangePicker } = DatePicker;

export default function CreateBookingModal({
  visible,
  rooms,
  stores,
  onCancel,
  onSuccess
}: CreateBookingModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const handleCheckAvailability = async () => {
    const values = form.getFieldsValue();
    if (!values.roomId || !values.timeRange) {
      message.warning('请先选择琴房和时间');
      return;
    }
    
    setChecking(true);
    try {
      const [start, end] = values.timeRange;
      const result = await api.checkAvailability(
        values.roomId,
        start.toISOString(),
        end.toISOString()
      );
      setAvailable(result.available);
      if (result.available) {
        message.success('该时段可用');
      } else {
        message.error('该时段已被占用');
      }
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const [start, end] = values.timeRange;
      
      await api.createBooking({
        storeId: stores[0]?.id || 'store-001',
        roomId: values.roomId,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        notes: values.notes
      });
      
      message.success('预约创建成功');
      form.resetFields();
      setAvailable(null);
      onSuccess();
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const disabledTime = (current: Dayjs | null) => {
    const selectedDate = current || dayjs();
    const store = stores[0];
    const openHour = store ? parseInt(store.openTime.split(':')[0]) : 9;
    const closeHour = store ? parseInt(store.closeTime.split(':')[0]) : 22;
    
    return {
      disabledHours: () => {
        const hours: number[] = [];
        for (let i = 0; i < 24; i++) {
          if (i < openHour || i >= closeHour) {
            hours.push(i);
          }
        }
        return hours;
      }
    };
  };

  const disabledDate = (current: Dayjs) => {
    return current && current < dayjs().startOf('day');
  };

  return (
    <Modal
      title="新建预约"
      open={visible}
      onCancel={() => {
        form.resetFields();
        setAvailable(null);
        onCancel();
      }}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="确认预约"
      cancelText="取消"
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          storeId: stores[0]?.id
        }}
      >
        <Form.Item
          name="customerName"
          label="顾客姓名"
          rules={[{ required: true, message: '请输入顾客姓名' }]}
        >
          <Input placeholder="请输入顾客姓名" />
        </Form.Item>

        <Form.Item
          name="customerPhone"
          label="联系电话"
          rules={[
            { required: true, message: '请输入联系电话' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' }
          ]}
        >
          <Input placeholder="请输入11位手机号码" />
        </Form.Item>

        <Form.Item
          name="roomId"
          label="选择琴房"
          rules={[{ required: true, message: '请选择琴房' }]}
        >
          <Select
            placeholder="请选择琴房"
            options={rooms
              .filter(r => r.status === 'available')
              .map(r => ({
                label: `${r.name} (¥${r.pricePerHour}/小时, 容量${r.capacity}人)`,
                value: r.id
              }))}
          />
        </Form.Item>

        <Form.Item
          name="timeRange"
          label="预约时间"
          rules={[{ required: true, message: '请选择预约时间' }]}
        >
          <RangePicker
            showTime={{ 
              format: 'HH:mm',
              minuteStep: 30,
              hideDisabledOptions: true
            }}
            format="YYYY-MM-DD HH:mm"
            disabledDate={disabledDate}
            disabledTime={disabledTime}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="notes"
          label="备注"
        >
          <Input.TextArea rows={3} placeholder="可选，填写备注信息" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button 
              onClick={handleCheckAvailability}
              loading={checking}
            >
              检查时段可用性
            </Button>
            {available === true && <span style={{ color: '#52c41a' }}>✓ 时段可用</span>}
            {available === false && <span style={{ color: '#ff4d4f' }}>✗ 时段已占用</span>}
          </Space>
        </Form.Item>
      </Form>

      <Card size="small" style={{ background: '#fafafa' }}>
        <div style={{ fontSize: 12, color: '#666' }}>
          <p><strong>提示：</strong></p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>营业时间：{stores[0]?.openTime || '09:00'} - {stores[0]?.closeTime || '22:00'}</li>
            <li>最小预约单位：30分钟</li>
            <li>迟到超过15分钟系统将自动释放</li>
            <li>续时需确保后续时段可用</li>
          </ul>
        </div>
      </Card>
    </Modal>
  );
}
