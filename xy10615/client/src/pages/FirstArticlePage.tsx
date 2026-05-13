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
  Tag
} from 'antd';
import { PlusOutlined, CheckCircleOutlined, WarningOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { InspectionStatusTag } from '../components/StatusTag';
import { firstArticleApi } from '../api';
import { FirstArticleInspection, FirstArticleItem } from '../types';

const { Title } = Typography;
const { Option } = Select;

const FirstArticlePage: React.FC = () => {
  const [inspections, setInspections] = useState<FirstArticleInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<FirstArticleInspection | null>(null);
  const [editingItem, setEditingItem] = useState<{ inspectionId: string; itemId: string; item: FirstArticleItem } | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();

  useEffect(() => {
    loadInspections();
  }, []);

  const loadInspections = async () => {
    setLoading(true);
    try {
      const response = await firstArticleApi.getAll();
      if (response.data.success) {
        setInspections(response.data.data || []);
      }
    } catch (error) {
      message.error('加载首件检验列表失败');
    } finally {
      setLoading(false);
    }
  };

  const showDetail = (inspection: FirstArticleInspection) => {
    setSelectedInspection(inspection);
    setDetailModalVisible(true);
  };

  const handleEditItem = (inspectionId: string, itemId: string, item: FirstArticleItem) => {
    setEditingItem({ inspectionId, itemId, item });
    editForm.setFieldsValue({
      result: item.result,
      measuredValue: item.measuredValue,
      isPassed: item.isPassed
    });
    setEditModalVisible(true);
  };

  const handleSaveItem = async (values: any) => {
    if (!editingItem) return;
    
    try {
      await firstArticleApi.updateItem(
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
      await firstArticleApi.review(inspectionId, {
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
      title: '序列号',
      dataIndex: 'serialNo',
      key: 'serialNo',
      width: 150
    },
    {
      title: '检验项数',
      key: 'itemCount',
      width: 100,
      render: (_: any, record: FirstArticleInspection) => record.items.length
    },
    {
      title: '通过数',
      key: 'passedCount',
      width: 100,
      render: (_: any, record: FirstArticleInspection) => (
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
      render: (_: any, record: FirstArticleInspection) => (
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
      render: (status: any) => <InspectionStatusTag status={status} />
    },
    {
      title: '检验人',
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
      render: (_: any, record: FirstArticleInspection) => (
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
      <Title level={3} style={{ marginBottom: 16 }}>首件检验</Title>

      <Table
        columns={columns}
        dataSource={inspections}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="检验详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedInspection && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <span><strong>序列号:</strong> {selectedInspection.serialNo}</span>
              <InspectionStatusTag status={selectedInspection.status} />
            </Space>

            <Table
              dataSource={selectedInspection.items}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: '检验项目',
                  dataIndex: 'name',
                  key: 'name'
                },
                {
                  title: '标准',
                  dataIndex: 'standard',
                  key: 'standard'
                },
                {
                  title: '测量值',
                  dataIndex: 'measuredValue',
                  key: 'measuredValue',
                  render: (text) => text || '-'
                },
                {
                  title: '结果',
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
        title="编辑检验项"
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
          <Form.Item label="检验项目">
            <div>
              <p><strong>名称:</strong> {editingItem?.item?.name}</p>
              <p><strong>标准:</strong> {editingItem?.item?.standard}</p>
            </div>
          </Form.Item>
          <Form.Item label="测量值" name="measuredValue">
            <Input />
          </Form.Item>
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

export default FirstArticlePage;
