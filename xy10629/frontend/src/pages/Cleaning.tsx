import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Modal, Form, message, Drawer, Tag } from 'antd';
import { PlusOutlined, EditOutlined, SearchOutlined, HistoryOutlined } from '@ant-design/icons';
import { cleaningAPI, recoveryAPI } from '../services/api';
import { CleaningRecord, RecoveryRecord, ModificationHistory } from '../types';

const { Option } = Select;

const Cleaning: React.FC = () => {
  const [records, setRecords] = useState<CleaningRecord[]>([]);
  const [recoveryRecords, setRecoveryRecords] = useState<RecoveryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CleaningRecord | null>(null);
  const [searchText, setSearchText] = useState('');
  const [resultFilter, setResultFilter] = useState<string | undefined>();
  const [historyData, setHistoryData] = useState<ModificationHistory[]>([]);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRecords();
    loadRecoveryRecords();
  }, [searchText, resultFilter]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await cleaningAPI.getAll({ keyword: searchText || undefined, result: resultFilter });
      setRecords(res.data.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRecoveryRecords = async () => {
    try {
      const res = await recoveryAPI.getAll();
      setRecoveryRecords(res.data.data);
    } catch (error) {
      console.error('加载回收记录失败');
    }
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: CleaningRecord) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleShowHistory = async (id: number) => {
    try {
      const res = await cleaningAPI.getHistory(id);
      setHistoryData(res.data.data);
      setHistoryVisible(true);
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };

  const handleSave = async (values: any) => {
    try {
      if (editingRecord) {
        await cleaningAPI.update(editingRecord.id, { ...values, modified_by: '管理员' });
        message.success('更新成功');
      } else {
        await cleaningAPI.create(values);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      loadRecords();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const columns = [
    { title: '清洗编号', dataIndex: 'cleaning_no', key: 'cleaning_no' },
    { title: '器械包', dataIndex: 'package_name', key: 'package_name' },
    { title: '清洗员', dataIndex: 'cleaner', key: 'cleaner' },
    { title: '清洗方式', dataIndex: 'cleaning_method', key: 'cleaning_method' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time' },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time' },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (result: string) => {
        const colorMap: Record<string, string> = {
          passed: 'green',
          failed: 'red',
          pending: 'orange',
        };
        const textMap: Record<string, string> = {
          passed: '通过',
          failed: '失败',
          pending: '待处理',
        };
        return <Tag color={colorMap[result] || 'default'}>{textMap[result] || result}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CleaningRecord) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" icon={<HistoryOutlined />} onClick={() => handleShowHistory(record.id)}>
            修改历史
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input
            placeholder="搜索"
            value={''}
            onChange={() => {}}
            style={{ width: 200 }}
          />
          <Select
            placeholder="结果筛选"
            allowClear
            style={{ width: 120 }}
          >
            <Option value="passed">通过</Option>
            <Option value="failed">失败</Option>
            <Option value="pending">待处理</Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加清洗记录
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingRecord ? '编辑清洗记录' : '添加清洗记录'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="cleaning_no" label="清洗编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="recovery_id" label="回收记录" rules={[{ required: true }]}>
            <Select>
              {recoveryRecords.map((r) => (
                <Option key={r.id} value={r.id}>
                  {r.recovery_no}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="cleaner" label="清洗员" rules={[{ required: true }]}>
            <Select>
              <Option value="张三">张三</Option>
              <Option value="李四">李四</Option>
              <Option value="王五">王五</Option>
              <Option value="赵六">赵六</Option>
              <Option value="钱七">钱七</Option>
            </Select>
          </Form.Item>
          <Form.Item name="cleaning_method" label="清洗方式" rules={[{ required: true }]}>
            <Select>
              <Option value="全自动清洗">全自动清洗</Option>
              <Option value="手工清洗">手工清洗</Option>
              <Option value="超声波清洗">超声波清洗</Option>
            </Select>
          </Form.Item>
          <Form.Item name="start_time" label="开始时间" rules={[{ required: true }]}>
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="end_time" label="结束时间">
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="result" label="结果">
            <Select>
              <Option value="pending">待处理</Option>
              <Option value="passed">通过</Option>
              <Option value="failed">失败</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="修改历史"
        open={historyVisible}
        onClose={() => setHistoryVisible(false)}
        width={400}
      >
        {historyData.length === 0 ? (
          <div>暂无修改记录</div>
        ) : (
          historyData.map((item, index) => (
            <div key={index} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>
                {item.field_name} - {item.modified_by} - {item.modified_at}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ color: '#ff4d4f', textDecoration: 'line-through' }}>
                  {item.old_value || '空'}
                </span>
                <span>→</span>
                <span style={{ color: '#52c41a', fontWeight: 500 }}>
                  {item.new_value || '空'}
                </span>
              </div>
            </div>
          ))
        )}
      </Drawer>
    </div>
  );
};

export default Cleaning;
