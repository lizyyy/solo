import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, DatePicker, TimePicker, Checkbox, message, Space, Divider, Alert } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api';

const { Option } = Select;
const { TextArea } = Input;

function CreateOrderPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [patients, setPatients] = useState([]);
  const [escorts, setEscorts] = useState([]);
  const [examinations, setExaminations] = useState([]);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictResult, setConflictResult] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getPatients(),
      api.getEscorts(),
      api.getExaminations()
    ]).then(([p, e, ex]) => {
      setPatients(p.data);
      setEscorts(e.data);
      setExaminations(ex.data);
    });
  }, []);

  const checkConflict = async (values) => {
    if (!values.escort_id || !values.date || !values.time_range) {
      return;
    }
    setCheckingConflict(true);
    try {
      const res = await api.checkSchedule({
        escort_id: values.escort_id,
        date: values.date.format('YYYY-MM-DD'),
        start_time: values.time_range[0].format('HH:mm'),
        end_time: values.time_range[1].format('HH:mm')
      });
      setConflictResult(res.data);
    } catch (e) {
      setConflictResult(null);
    } finally {
      setCheckingConflict(false);
    }
  };

  const handleSubmit = async (values) => {
    if (conflictResult?.has_conflict) {
      message.error('陪诊员时间冲突，请更换时间或陪诊员');
      return;
    }

    try {
      const startDateTime = values.date.format('YYYY-MM-DD') + ' ' + values.time_range[0].format('HH:mm');
      const endDateTime = values.date.format('YYYY-MM-DD') + ' ' + values.time_range[1].format('HH:mm');

      const res = await api.createOrder({
        patient_id: values.patient_id,
        escort_id: values.escort_id,
        service_type: values.service_type || 'normal',
        start_time: startDateTime,
        end_time: endDateTime,
        department: values.department,
        hospital: values.hospital,
        notes: values.notes,
        examination_ids: values.examination_ids
      });

      message.success('订单创建成功！');
      navigate(`/orders/${res.data.id}`);
    } catch (e) {
      message.error(e.response?.data?.error || '创建订单失败');
    }
  };

  const formItemLayout = {
    labelCol: { span: 6 },
    wrapperCol: { span: 16 }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
          返回列表
        </Button>
      </Space>

      <Card title="新建陪诊订单">
        <Form
          {...formItemLayout}
          form={form}
          layout="horizontal"
          onFinish={handleSubmit}
          onValuesChange={(_, values) => checkConflict(values)}
        >
          <Form.Item
            label="患者"
            name="patient_id"
            rules={[{ required: true, message: '请选择患者' }]}
          >
            <Select placeholder="选择患者" allowClear>
              {patients.map(p => (
                <Option key={p.id} value={p.id}>
                  {p.name} ({p.gender}, {p.age}岁)
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="陪诊员"
            name="escort_id"
            rules={[{ required: true, message: '请选择陪诊员' }]}
          >
            <Select placeholder="选择陪诊员" allowClear>
              {escorts.map(e => (
                <Option key={e.id} value={e.id}>
                  {e.name} - {e.skills}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="服务日期"
            name="date"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} disabledDate={d => d && d < dayjs().startOf('day')} />
          </Form.Item>

          <Form.Item
            label="服务时间"
            name="time_range"
            rules={[{ required: true, message: '请选择时间' }]}
          >
            <TimePicker.RangePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>

          {conflictResult && (
            <Form.Item wrapperCol={{ offset: 6, span: 16 }}>
              <Alert
                message={conflictResult.has_conflict ? '时间冲突' : '时间可用'}
                description={conflictResult.has_conflict 
                  ? '该陪诊员在此时间段已有安排，请重新选择'
                  : '该陪诊员在此时间段可用'}
                type={conflictResult.has_conflict ? 'error' : 'success'}
                showIcon
              />
            </Form.Item>
          )}

          <Form.Item
            label="科室"
            name="department"
            rules={[{ required: true, message: '请输入科室' }]}
          >
            <Input placeholder="例如：内科、骨科" />
          </Form.Item>

          <Form.Item
            label="医院"
            name="hospital"
            rules={[{ required: true, message: '请输入医院' }]}
          >
            <Input placeholder="例如：北京协和医院" />
          </Form.Item>

          <Form.Item label="预约检查" name="examination_ids">
            <Checkbox.Group style={{ width: '100%' }}>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {examinations.map(ex => (
                  <div key={ex.id} style={{ marginBottom: 8 }}>
                    <Checkbox value={ex.id}>
                      <strong>{ex.name}</strong> - {ex.department} - ¥{ex.price}
                    </Checkbox>
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item label="备注" name="notes">
            <TextArea rows={3} placeholder="特殊需求或注意事项" />
          </Form.Item>

          <Form.Item wrapperCol={{ offset: 6, span: 16 }}>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={checkingConflict}>
                创建订单
              </Button>
              <Button onClick={() => navigate('/orders')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default CreateOrderPage;
