import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Popconfirm,
  Tag,
  Upload,
  Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, UploadOutlined, StarOutlined, StarFilled } from '@ant-design/icons';
import { testBatchesAPI, trafficModelsAPI, testResultsAPI, monitoringAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

function TestBatches() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [trafficModels, setTrafficModels] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [importType, setImportType] = useState('results');
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    loadTrafficModels();
  }, [pagination.current, pagination.pageSize]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await testBatchesAPI.getList({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setData(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTrafficModels = async () => {
    try {
      const res = await trafficModelsAPI.getList({ pageSize: 100 });
      setTrafficModels(res.data.data);
    } catch (error) {
      console.error('加载流量模型失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      timeRange: record.start_time && record.end_time 
        ? [dayjs(record.start_time), dayjs(record.end_time)] 
        : undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await testBatchesAPI.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSetBaseline = async (record) => {
    try {
      await testBatchesAPI.setBaseline(record.id);
      message.success(`已将「${record.name}」设为基线版本`);
      loadData();
    } catch (error) {
      message.error('设置失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { timeRange, ...rest } = values;
      
      const submitData = {
        ...rest,
        start_time: timeRange?.[0]?.toISOString(),
        end_time: timeRange?.[1]?.toISOString(),
        duration_seconds: timeRange 
          ? (timeRange[1].valueOf() - timeRange[0].valueOf()) / 1000 
          : undefined,
      };
      
      if (editingItem) {
        await testBatchesAPI.update(editingItem.id, submitData);
        message.success('更新成功');
      } else {
        await testBatchesAPI.create(submitData);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadData();
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error('保存失败');
    }
  };

  const handleImport = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        
        if (importType === 'results') {
          const res = await testResultsAPI.batchImport({
            batch_id: selectedBatch,
            results: Array.isArray(jsonData) ? jsonData : [jsonData],
          });
          message.success(res.data.message);
        } else if (importType === 'monitoring') {
          const res = await monitoringAPI.batchImport({
            batch_id: selectedBatch,
            snapshots: Array.isArray(jsonData) ? jsonData : [jsonData],
          });
          message.success(res.data.message);
        }
        
        setImportModalVisible(false);
      } catch (error) {
        message.error('导入失败: ' + (error.message || error.response?.data?.error));
      }
    };
    reader.readAsText(file);
    return false;
  };

  const columns = [
    {
      title: '批次号',
      dataIndex: 'batch_number',
      key: 'batch_number',
      width: 80,
      render: (val, record) => (
        <Space>
          <strong>#</strong>
          <strong>{val}</strong>
          {record.is_baseline && <StarFilled style={{ color: '#faad14' }} />}
        </Space>
      ),
      sorter: (a, b) => a.batch_number - b.batch_number,
    },
    {
      title: '批次名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{text}</span>
          {record.is_baseline && <Tag color="gold">基线</Tag>}
        </Space>
      ),
    },
    {
      title: '流量模型',
      dataIndex: 'traffic_model_name',
      key: 'traffic_model_name',
      render: (val) => val || '-',
    },
    {
      title: '持续时间',
      dataIndex: 'duration_seconds',
      key: 'duration_seconds',
      width: 100,
      render: (val) => {
        if (!val) return '-';
        const mins = Math.floor(val / 60);
        const secs = Math.round(val % 60);
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val) => (
        <Tag color={
          val === 'completed' ? 'success' : 
          val === 'running' ? 'processing' : 
          val === 'failed' ? 'error' : 'default'
        }>
          {val === 'completed' ? '已完成' : 
           val === 'running' ? '进行中' : 
           val === 'failed' ? '失败' : val}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/test-batches/${record.id}`)}>
            详情
          </Button>
          {!record.is_baseline && (
            <Button 
              type="link" 
              size="small" 
              icon={<StarOutlined />} 
              onClick={() => handleSetBaseline(record)}
            >
              设为基线
            </Button>
          )}
          <Button 
            type="link" 
            size="small" 
            icon={<UploadOutlined />} 
            onClick={() => {
              setSelectedBatch(record.id);
              setImportModalVisible(true);
            }}
          >
            导入数据
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个压测批次吗？这将同时删除所有相关的结果数据。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>压测批次管理</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建压测批次
        </Button>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div>
            <strong>导入数据格式说明：</strong>
          </div>
          <Tag color="blue">压测结果 (results.json)</Tag>
          <Tag color="green">监控数据 (monitoring.json)</Tag>
        </div>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
        }}
      />

      <Modal
        title={editingItem ? '编辑压测批次' : '新建压测批次'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="批次名称"
            rules={[{ required: true, message: '请输入批次名称' }]}
          >
            <Input placeholder="例如：2024-05-05 第二轮压测" />
          </Form.Item>
          <Form.Item name="is_baseline" label="设为基线版本" valuePropName="checked">
            <Select>
              <Select.Option value={false}>否</Select.Option>
              <Select.Option value={true}>是 (将取消其他基线)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="traffic_model_id" label="使用的流量模型">
            <Select placeholder="请选择流量模型" allowClear>
              {trafficModels.map(m => (
                <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="timeRange" label="压测时间范围">
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="planning">规划中</Select.Option>
              <Select.Option value="running">进行中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="failed">失败</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="本次压测的相关备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入数据"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={500}
      >
        <div>
          <Form layout="vertical">
            <Form.Item label="导入数据类型">
              <Select value={importType} onChange={setImportType} style={{ width: '100%' }}>
                <Select.Option value="results">压测结果 (JSON)</Select.Option>
                <Select.Option value="monitoring">监控快照 (JSON)</Select.Option>
              </Select>
            </Form.Item>
          </Form>
          
          <Card size="small" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#666' }}>
              <div><strong>压测结果格式示例：</strong></div>
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 8, fontSize: 11, overflow: 'auto' }}>
{`[
  {
    "interface_id": "xxx",
    "total_requests": 10000,
    "success_count": 9950,
    "failed_count": 50,
    "qps": 500,
    "avg_response_time": 150,
    "p95_response_time": 300,
    "p99_response_time": 800,
    "error_rate": 0.5
  }
]`}
              </pre>
            </div>
          </Card>
          
          <Upload
            accept=".json"
            beforeUpload={handleImport}
            showUploadList={false}
          >
            <Button type="primary" icon={<UploadOutlined />} block>
              选择 {importType === 'results' ? '压测结果' : '监控数据'} JSON 文件
            </Button>
          </Upload>
        </div>
      </Modal>
    </div>
  );
}

export default TestBatches;
