import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, Upload, Space, message, Tag, Progress } from 'antd';
import { UploadOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { syncAPI, suppliersAPI } from '../api';
import * as XLSX from 'xlsx';

interface SyncBatch {
  id: number;
  batch_id: string;
  supplier_id: number;
  status: string;
  total_items: number;
  processed_items: number;
  success_items: number;
  failed_items: number;
  conflict_items: number;
  idempotency_key: string;
  started_at: string;
  completed_at: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'default',
  processing: 'blue',
  success: 'green',
  failed: 'red',
  partial: 'orange',
  conflict: 'orange',
};

const SyncBatches: React.FC = () => {
  const [data, setData] = useState<SyncBatch[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importedData, setImportedData] = useState<any[]>([]);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchesRes, suppliersRes] = await Promise.all([
        syncAPI.listBatches(),
        suppliersAPI.list(),
      ]);
      setData(batchesRes.data);
      setSuppliers(suppliersRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target?.result, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      setImportedData(jsonData);
      message.success(`成功读取 ${jsonData.length} 条数据`);
    };
    reader.readAsBinaryString(file);
    return false;
  };

  const handleImport = async (values: any) => {
    if (importedData.length === 0) {
      message.error('请先上传数据文件');
      return;
    }

    try {
      const response = await syncAPI.import({
        supplier_id: values.supplier_id,
        idempotency_key: `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        products: importedData,
      });
      message.success(`导入成功! 批次ID: ${response.data.batch_id}`);
      setImportModalVisible(false);
      setImportedData([]);
      fetchData();
    } catch (error) {
      message.error('导入失败');
    }
  };

  const columns = [
    { title: '批次ID', dataIndex: 'batch_id', key: 'batch_id' },
    { title: '供应商ID', dataIndex: 'supplier_id', key: 'supplier_id' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColors[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '进度',
      key: 'progress',
      render: (_: any, record: SyncBatch) => (
        <Progress
          percent={record.total_items > 0 ? Math.round((record.processed_items / record.total_items) * 100) : 0}
          size="small"
        />
      ),
    },
    { title: '总数', dataIndex: 'total_items', key: 'total_items', width: 80 },
    { title: '成功', dataIndex: 'success_items', key: 'success_items', width: 80 },
    { title: '失败', dataIndex: 'failed_items', key: 'failed_items', width: 80 },
    { title: '冲突', dataIndex: 'conflict_items', key: 'conflict_items', width: 80 },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>批量导入</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={data} loading={loading} rowKey="id" />
      <Modal title="批量导入商品" open={importModalVisible} onCancel={() => setImportModalVisible(false)} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={handleImport}>
          <Form.Item name="supplier_id" label="选择供应商" rules={[{ required: true }]}>
            <Select>
              {suppliers.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.supplier_name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="上传数据文件 (Excel/CSV)">
            <Upload beforeUpload={handleFileUpload} accept=".xlsx,.xls,.csv" showUploadList={false}>
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
            {importedData.length > 0 && (
              <p style={{ marginTop: 8, color: 'green' }}>已读取 {importedData.length} 条数据</p>
            )}
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">开始导入</Button>
              <Button onClick={() => { setImportedData([]); form.resetFields(); }}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SyncBatches;
