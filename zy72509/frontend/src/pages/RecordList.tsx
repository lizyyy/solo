import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  Switch,
  message,
  Popconfirm,
  Upload,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  UploadOutlined,
  ExportOutlined,
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  getRecords,
  createRecord,
  updateRecord,
  confirmRecord,
  rejectRecord,
  sendToAlgorithmReview,
  importExcel,
  exportExcel,
} from '../api';
import { AnnotationRecord, ReviewStatus, statusText, statusColor } from '../types';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

function RecordList() {
  const [records, setRecords] = useState<AnnotationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | undefined>();
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AnnotationRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<AnnotationRecord | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await getRecords({
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: statusFilter,
        keyword,
      });
      setRecords(result.records);
      setTotal(result.total);
    } catch (e) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize, statusFilter, keyword]);

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    setPagination({
      current: newPagination.current || 1,
      pageSize: newPagination.pageSize || 10,
    });
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: AnnotationRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
    });
    setModalOpen(true);
  };

  const handleView = (record: AnnotationRecord) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingRecord) {
        await updateRecord(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await createRecord(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await confirmRecord(id);
      message.success('已确认');
      fetchData();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectRecord(id);
      message.success('已驳回');
      fetchData();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleAlgorithmReview = async (id: string) => {
    try {
      await sendToAlgorithmReview(id);
      message.success('已发送算法复核');
      fetchData();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const result = await importExcel(file);
      message.success(
        `导入完成：成功 ${result.success} 条，重复 ${result.duplicates} 条，错误 ${result.errors} 条`
      );
      if (result.errorDetails.length > 0) {
        Modal.error({
          title: '导入错误详情',
          content: (
          <div>
            {result.errorDetails.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
          </div>
        ),
        });
      }
      fetchData();
    } catch (e) {
      message.error('导入失败');
    }
    return false;
  };

  const handleExport = () => {
    exportExcel();
    message.success('导出任务已开始');
  };

  const columns: ColumnsType<AnnotationRecord> = [
    {
      title: '会话ID',
      dataIndex: 'session_id',
      key: 'session_id',
      width: 150,
      ellipsis: true,
    },
    {
      title: '用户问题',
      dataIndex: 'user_query',
      key: 'user_query',
      ellipsis: true,
      width: 200,
    },
    {
      title: '标注员留言',
      dataIndex: 'annotator_comment',
      key: 'annotator_comment',
      ellipsis: true,
      width: 200,
    },
    {
      title: '模型输出',
      dataIndex: 'model_output',
      key: 'model_output',
      ellipsis: true,
      width: 200,
    },
    {
      title: '是否拦截',
      dataIndex: 'is_intercepted',
      key: 'is_intercepted',
      width: 100,
      render: (val) => val ? '是' : '否',
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      key: 'review_status',
      width: 120,
      render: (status: ReviewStatus) => (
        <Tag color={statusColor[status] as any}>
          {statusText[status]}
        </Tag>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '导入来源',
      dataIndex: 'imported_from',
      key: 'imported_from',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.review_status === ReviewStatus.CONFLICT && (
            <>
              <Popconfirm
                title="确认通过？"
                onConfirm={() => handleConfirm(record.id)}
              >
                <Button type="link" size="small" style={{ color: '#52c41a' }}>
                  确认
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认驳回？"
                onConfirm={() => handleReject(record.id)}
              >
                <Button type="link" size="small" style={{ color: '#ff4d4f' }}>
                  驳回
                </Button>
              </Popconfirm>
            </>
          )}
          <Popconfirm
            title="发送给算法同事复核？"
            description="主要用于手机号漏遮等需要算法处理的问题"
            onConfirm={() => handleAlgorithmReview(record.id)}
          >
            <Button type="link" size="small" style={{ color: '#722ed1' }}>
              算法复核
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Search
            placeholder="搜索会话ID、用户问题、标注员留言"
            style={{ width: 300 }}
            allowClear
            onSearch={(value) => {
              setKeyword(value);
              setPagination(p => ({ ...p, current: 1 }));
            }}
          />
          <Select
            placeholder="筛选状态"
            style={{ width: 150 }}
            allowClear
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPagination(p => ({ ...p, current: 1 }));
            }}
          >
            {Object.entries(statusText).map(([key, text]) => (
              <Option key={key} value={key}>{text}</Option>
            ))}
          </Select>
        </Space>
        <Space>
          <Upload
            beforeUpload={handleImport}
            showUploadList={false}
            accept=".xlsx,.xls"
          >
            <Button icon={<UploadOutlined />}>导入Excel</Button>
          </Upload>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建记录
          </Button>
        </Space>
      </Space>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 1400 }}
      />

      <Modal
        title={editingRecord ? '编辑记录' : '新建记录'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="session_id" label="会话ID" rules={[{ required: true }]}>
            <Input placeholder="请输入会话ID" />
          </Form.Item>
          <Form.Item name="user_query" label="用户问题" rules={[{ required: true }]}>
            <TextArea rows={2} placeholder="请输入用户问题" />
          </Form.Item>
          <Form.Item name="annotator_comment" label="标注员留言">
            <TextArea rows={3} placeholder="请输入标注员留言" />
          </Form.Item>
          <Form.Item name="model_output" label="模型输出片段">
            <TextArea rows={3} placeholder="请输入模型输出片段" />
          </Form.Item>
          <Form.Item name="phone_number" label="手机号">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item name="is_intercepted" label="是否拦截" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="记录详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={700}
      >
        {detailRecord && (
          <div style={{ lineHeight: 2 }}>
            <p><strong>会话ID：</strong>{detailRecord.session_id}</p>
            <p><strong>用户问题：</strong>{detailRecord.user_query}</p>
            <p><strong>标注员留言：</strong>{detailRecord.annotator_comment || '-'}</p>
            <p><strong>模型输出：</strong>{detailRecord.model_output || '-'}</p>
            <p><strong>手机号：</strong>{detailRecord.phone_number || '-'}</p>
            <p><strong>是否拦截：</strong>{detailRecord.is_intercepted ? '是' : '否'}</p>
            <p><strong>审核状态：</strong>
              <Tag color={statusColor[detailRecord.review_status] as any}>
                {statusText[detailRecord.review_status]}
              </Tag>
            </p>
            {detailRecord.conflict_evidence && (
              <div>
                <p><strong>冲突证据：</strong></p>
                <ul>
                  {JSON.parse(detailRecord.conflict_evidence).map((e: string, i: number) => (
                    <li key={i} style={{ color: '#fa8c16' }}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <p><strong>版本：</strong>{detailRecord.version}</p>
            <p><strong>导入来源：</strong>{detailRecord.imported_from}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default RecordList;
