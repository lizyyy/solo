import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Typography,
  Popover,
  Tag,
  List
} from 'antd';
import { PlusOutlined, CheckCircleOutlined, WarningOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { CheckStatusTag } from '../components/StatusTag';
import { moldApi } from '../api';
import { MoldInspection } from '../types';

const { Title } = Typography;
const { Option } = Select;

const MoldPage: React.FC = () => {
  const [inspections, setInspections] = useState<MoldInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<MoldInspection | null>(null);
  const [editingItem, setEditingItem] = useState<{ inspectionId: string; itemId: string } | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    loadInspections();
  }, []);

  const loadInspections = async () => {
    setLoading(true);
    try {
      const response = await moldApi.getAll();
      if (response.data.success) {
        setInspections(response.data.data || []);
      }
    } catch (error) {
      message.error('加载点检列表失败');
    } finally {
      setLoading(false);
    }
  };

  const showDetail = async (inspection: MoldInspection) => {
    setSelectedInspection(inspection);
    try {
      const response = await moldApi.validate(inspection.id);
      if (response.data.success) {
        setValidationErrors(response.data.data?.errors || []);
      }
    } catch (error) {
      setValidationErrors([]);
    }
    setDetailModalVisible(true);
  };

  const handleEditItem = (inspectionId: string, itemId: string, item: any) => {
    setEditingItem({ inspectionId, itemId });
    editForm.setFieldsValue({
      result: item.result,
      isPassed: item.isPassed
    });
    setEditModalVisible(true);
  };

  const handleSaveItem = async (values: any) => {
    if (!editingItem) return;
    
    try {
      await moldApi.updateItem(
        editingItem.inspectionId,
        editingItem.itemId,
        {
          ...values,
          checkedBy: '当前用户',
          checkedById: 'current-user'
        }
      );
      message.success('更新成功');
      setEditModalVisible(false);
      loadInspections();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleReview = async (inspectionId: string) => {
    try {
      await moldApi.review(inspectionId, {
        reviewedBy: '当前用户',
        reviewedById: 'current-user',
        remark: '复核通过'
      });
      message.success('复核成功');
      loadInspections();
    } catch (error) {
      message.error('复核失败');
    }
  };

  const columns = [
    {
      title: '模具编码',
      dataIndex: 'moldCode',
      key: 'moldCode',
      width: 120
    },
    {
      title: '模具名称',
      dataIndex: 'moldName',
      key: 'moldName'
    },
    {
      title: '点检项数',
      key: 'itemCount',
      width: 100,
      render: (_: any, record: MoldInspection) => record.items.length
    },
    {
      title: '通过数',
      key: 'passedCount',
      width: 100,
      render: (_: any, record: MoldInspection) => (
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          {record.items.filter(i => i.isPassed === true).length}
        </Space>
      )
    },
    {
      title: '未通过数',
      key: 'failedCount',
      width: 100,
      render: (_: any, record: MoldInspection) => (
        <Space>
          <WarningOutlined style={{ color: '#ff4d4f' }} />
          {record.items.filter(i => i.isPassed === false).length}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: any) => <CheckStatusTag status={status} />
    },
    {
      title: '点检人',
      dataIndex: 'checkedBy',
      key: 'checkedBy',
      width: 100
    },
    {
      title: '复核人',
      dataIndex: 'reviewedBy',
      key: 'reviewedBy',
      width: 100
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: MoldInspection) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
            详情
          </Button>
          {(record.status === 'PASSED' || record.status === 'FAILED') && (
            <Button type="link" size="small" onClick={() => handleReview(record.id)}>
              复核
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>模具点检</Title>

      <Table
        columns={columns}
        dataSource={inspections}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="点检详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedInspection && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <span><strong>模具编码:</strong> {selectedInspection.moldCode}</span>
              <span><strong>模具名称:</strong> {selectedInspection.moldName}</span>
              <CheckStatusTag status={selectedInspection.status} />
            </Space>

            {validationErrors.length > 0 && (
              <div style={{ marginBottom: 16, padding: 12, background: '#fff1f0', borderRadius: 4 }}>
                <div style={{ color: '#ff4d4f', fontWeight: 'bold', marginBottom: 8 }}>
                  <WarningOutlined /> 校验警告:
                </div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {validationErrors.map((error, idx) => (
                    <li key={idx} style={{ color: '#ff4d4f' }}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <Table
              dataSource={selectedInspection.items}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: '点检项目',
                  dataIndex: 'name',
                  key: 'name'
                },
                {
                  title: '标准',
                  dataIndex: 'standard',
                  key: 'standard'
                },
                {
                  title: '检验结果',
                  dataIndex: 'result',
                  key: 'result',
                  render: (text) => text || '-'
                },
                {
                  title: '是否通过',
                  dataIndex: 'isPassed',
                  key: 'isPassed',
                  width: 100,
                  render: (isPassed) => {
                    if (isPassed === true) return <Tag color="success">是</Tag>;
                    if (isPassed === false) return <Tag color="error">否</Tag>;
                    return '-';
                  }
                },
                {
                  title: '检验人',
                  dataIndex: 'checkedBy',
                  key: 'checkedBy',
                  width: 100,
                  render: (text) => text || '-'
                },
                {
                  title: '检验时间',
                  dataIndex: 'checkedAt',
                  key: 'checkedAt',
                  width: 180,
                  render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  render: (_, record) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleEditItem(selectedInspection.id, record.id, record)}
                    >
                      编辑
                    </Button>
                  )
                }
              ]}
            />
          </div>
        )}
      </Modal>

      <Modal
        title="编辑点检项"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => editForm.submit()}
        width={500}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveItem}
        >
          <Form.Item label="检验结果" name="result" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="是否通过" name="isPassed" rules={[{ required: true }]}>
            <Select>
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MoldPage;
