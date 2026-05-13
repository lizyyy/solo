import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, DatePicker, message, InputNumber, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const WardDemands = () => {
  const [data, setData] = useState([]);
  const [wards, setWards] = useState([]);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    loadWards();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get('/api/ward-demands');
      setData(res.data);
    } catch (err) {
      message.error('加载失败');
    }
  };

  const loadWards = async () => {
    try {
      const res = await axios.get('/api/wards');
      setWards(res.data);
    } catch (err) {
      message.error('加载病区失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const submitData = {
        ...values,
        date: values.date.format('YYYY-MM-DD')
      };
      if (editing) {
        await axios.put(`/api/ward-demands/${editing.id}`, submitData);
        message.success('更新成功');
      } else {
        await axios.post('/api/ward-demands', submitData);
        message.success('创建成功');
      }
      setVisible(false);
      loadData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleBatchImport = async (info) => {
    const file = info.file;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const demands = JSON.parse(e.target.result);
        await axios.post('/api/ward-demands/batch', { demands });
        message.success('批量导入成功');
        loadData();
      } catch (err) {
        message.error('导入失败');
      }
    };
    reader.readAsText(file);
  };

  const columns = [
    { title: '病区', dataIndex: 'ward_name', key: 'ward_name' },
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '班次', dataIndex: 'shift_type', key: 'shift_type' },
    { title: '需求人数', dataIndex: 'required_count', key: 'required_count' },
    { title: '状态', dataIndex: 'status', key: 'status' },
    {
      title: '操作',
      render: (_, record) => (
        <Button onClick={() => { 
          setEditing(record); 
          form.setFieldsValue({ ...record, date: dayjs(record.date) }); 
          setVisible(true); 
        }}>
          编辑
        </Button>
      ),
    },
  ];

  const shiftOptions = [
    { value: 'morning', label: '早班' },
    { value: 'afternoon', label: '下午班' },
    { value: 'night', label: '夜班' },
    { value: 'day', label: '白班' },
    { value: 'night_full', label: '整夜班' }
  ];

  return (
    <div>
      <Button.Group>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setVisible(true); }}>
          新建需求
        </Button>
        <Upload beforeUpload={() => false} onChange={handleBatchImport} showUploadList={false}>
          <Button icon={<UploadOutlined />}>批量导入</Button>
        </Upload>
      </Button.Group>
      <Table columns={columns} dataSource={data} rowKey="id" style={{ marginTop: 16 }} />
      <Modal
        title={editing ? '编辑病区需求' : '新建病区需求'}
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="ward_id" label="病区" rules={[{ required: true }]}>
            <Select>
              {wards.map(w => (
                <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="shift_type" label="班次" rules={[{ required: true }]}>
            <Select options={shiftOptions} />
          </Form.Item>
          <Form.Item name="required_count" label="需求人数" initialValue={1}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="min_skill_level" label="最低技能等级" initialValue={1}>
            <Select>
              <Select.Option value={1}>初级</Select.Option>
              <Select.Option value={2}>中级</Select.Option>
              <Select.Option value={3}>高级</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WardDemands;
