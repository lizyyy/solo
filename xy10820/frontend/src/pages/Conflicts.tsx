import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, Space, message, Tag, Tabs, Card } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { syncAPI } from '../api';

interface Conflict {
  id: number;
  batch_id: number;
  supplier_product_id: number;
  conflict_type: string;
  field_name: string;
  old_value: any;
  new_value: any;
  status: string;
  resolution: any;
  created_at: string;
}

interface PendingItem {
  id: number;
  batch_id: number;
  supplier_product_id: number;
  field_name: string;
  suggested_value: any;
  current_value: any;
  status: string;
  created_at: string;
}

const Conflicts: React.FC = () => {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [selectedPending, setSelectedPending] = useState<PendingItem | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [conflictsRes, pendingRes] = await Promise.all([
        syncAPI.listConflicts('open'),
        syncAPI.listPending('pending'),
      ]);
      setConflicts(conflictsRes.data);
      setPending(pendingRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResolveConflict = (record: Conflict) => {
    setSelectedConflict(record);
    form.setFieldsValue({
      resolution_type: 'apply',
    });
    setResolveModalVisible(true);
  };

  const handleSubmitResolve = async (values: any) => {
    if (!selectedConflict) return;

    try {
      await syncAPI.resolveConflict(selectedConflict.id, {
        resolution: { apply_changes: values.resolution_type === 'apply', notes: values.notes },
        resolved_by: 'admin',
      });
      message.success('冲突已解决');
      setResolveModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleConfirmPending = (record: PendingItem) => {
    setSelectedPending(record);
    setConfirmModalVisible(true);
  };

  const handleSubmitConfirm = async (values: any) => {
    if (!selectedPending) return;

    try {
      await syncAPI.confirmPending(selectedPending.id, {
        status: values.action,
        confirmed_value: values.action === 'confirmed' ? selectedPending.suggested_value : selectedPending.current_value,
        confirmed_by: 'admin',
      });
      message.success('确认完成');
      setConfirmModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const conflictColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '冲突类型', dataIndex: 'conflict_type', key: 'conflict_type' },
    { title: '字段名', dataIndex: 'field_name', key: 'field_name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={v === 'open' ? 'orange' : 'green'}>{v}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Conflict) => (
        <Button type="primary" size="small" onClick={() => handleResolveConflict(record)}>处理</Button>
      ),
    },
  ];

  const pendingColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '批次ID', dataIndex: 'batch_id', key: 'batch_id' },
    { title: '字段名', dataIndex: 'field_name', key: 'field_name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color="orange">{v}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PendingItem) => (
        <Button type="primary" size="small" onClick={() => handleConfirmPending(record)}>确认</Button>
      ),
    },
  ];

  return (
    <div>
      <Tabs
        items={[
          {
            key: 'conflicts',
            label: `冲突队列 (${conflicts.length})`,
            children: (
              <Table columns={conflictColumns} dataSource={conflicts} loading={loading} rowKey="id" />
            ),
          },
          {
            key: 'pending',
            label: `待确认项 (${pending.length})`,
            children: (
              <Table columns={pendingColumns} dataSource={pending} loading={loading} rowKey="id" />
            ),
          },
        ]}
      />

      <Modal title="处理冲突" open={resolveModalVisible} onCancel={() => setResolveModalVisible(false)} footer={null} width={700}>
        {selectedConflict && (
          <div>
            <Card size="small" title="旧值" style={{ marginBottom: 16 }}>
              <pre style={{ fontSize: 12 }}>{JSON.stringify(selectedConflict.old_value, null, 2)}</pre>
            </Card>
            <Card size="small" title="新值" style={{ marginBottom: 16 }}>
              <pre style={{ fontSize: 12 }}>{JSON.stringify(selectedConflict.new_value, null, 2)}</pre>
            </Card>
            <Form form={form} layout="vertical" onFinish={handleSubmitResolve}>
              <Form.Item name="resolution_type" label="处理方式" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="apply">应用新值</Select.Option>
                  <Select.Option value="keep">保留旧值</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="notes" label="备注">
                <textarea style={{ width: '100%', height: 80 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">提交</Button>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal title="确认待处理项" open={confirmModalVisible} onCancel={() => setConfirmModalVisible(false)} footer={null} width={700}>
        {selectedPending && (
          <div>
            <Card size="small" title="当前值" style={{ marginBottom: 16 }}>
              <pre style={{ fontSize: 12 }}>{JSON.stringify(selectedPending.current_value, null, 2)}</pre>
            </Card>
            <Card size="small" title="建议值" style={{ marginBottom: 16 }}>
              <pre style={{ fontSize: 12 }}>{JSON.stringify(selectedPending.suggested_value, null, 2)}</pre>
            </Card>
            <Form form={form} layout="vertical" onFinish={handleSubmitConfirm}>
              <Form.Item name="action" label="操作" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="confirmed">接受建议值</Select.Option>
                  <Select.Option value="rejected">保留当前值</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">提交</Button>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Conflicts;
