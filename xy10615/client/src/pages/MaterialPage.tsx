import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  message,
  Typography,
  Tag,
  Progress
} from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { KittingStatusTag } from '../components/StatusTag';
import { materialApi } from '../api';
import { MaterialKitting, MaterialItem } from '../types';

const { Title } = Typography;

const MaterialPage: React.FC = () => {
  const [kittings, setKittings] = useState<MaterialKitting[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedKitting, setSelectedKitting] = useState<MaterialKitting | null>(null);
  const [editingItem, setEditingItem] = useState<{ kittingId: string; itemId: string; item: MaterialItem } | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();

  useEffect(() => {
    loadKittings();
  }, []);

  const loadKittings = async () => {
    setLoading(true);
    try {
      const response = await materialApi.getAll();
      if (response.data.success) {
        setKittings(response.data.data || []);
      }
    } catch (error) {
      message.error('加载物料齐套列表失败');
    } finally {
      setLoading(false);
    }
  };

  const showDetail = (kitting: MaterialKitting) => {
    setSelectedKitting(kitting);
    setDetailModalVisible(true);
  };

  const handleEditItem = (kittingId: string, itemId: string, item: MaterialItem) => {
    setEditingItem({ kittingId, itemId, item });
    editForm.setFieldsValue({
      actualQty: item.actualQty
    });
    setEditModalVisible(true);
  };

  const handleSaveItem = async (values: any) => {
    if (!editingItem) return;
    
    try {
      await materialApi.updateItem(
        editingItem.kittingId,
        editingItem.itemId,
        {
          ...values,
          checkedBy: '当前用户',
          checkedById: 'current-user'
        }
      );
      message.success('更新成功');
      setEditModalVisible(false);
      loadKittings();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const calculateProgress = (items: MaterialItem[]) => {
    const completeItems = items.filter(i => i.status === 'COMPLETE').length;
    return items.length > 0 ? Math.round((completeItems / items.length) * 100) : 0;
  };

  const columns = [
    {
      title: '物料项数',
      key: 'itemCount',
      width: 100,
      render: (_: any, record: MaterialKitting) => record.items.length
    },
    {
      title: '齐套率',
      key: 'progress',
      width: 200,
      render: (_: any, record: MaterialKitting) => (
        <Progress percent={calculateProgress(record.items)} size="small" />
      )
    },
    {
      title: '齐套数',
      key: 'completeCount',
      width: 100,
      render: (_: any, record: MaterialKitting) => record.items.filter(i => i.status === 'COMPLETE').length
    },
    {
      title: '缺失数',
      key: 'missingCount',
      width: 100,
      render: (_: any, record: MaterialKitting) => record.items.filter(i => i.status === 'MISSING').length
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: any) => <KittingStatusTag status={status} />
    },
    {
      title: '确认人',
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
      width: 120,
      render: (_: any, record: MaterialKitting) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>物料齐套</Title>

      <Table
        columns={columns}
        dataSource={kittings}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="齐套详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedKitting && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <span><strong>状态:</strong> <KittingStatusTag status={selectedKitting.status} /></span>
              <span><strong>齐套率:</strong> {calculateProgress(selectedKitting.items)}%</span>
            </Space>

            <Table
              dataSource={selectedKitting.items}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: '物料编码',
                  dataIndex: 'materialCode',
                  key: 'materialCode',
                  width: 120
                },
                {
                  title: '物料名称',
                  dataIndex: 'materialName',
                  key: 'materialName'
                },
                {
                  title: '需求数量',
                  dataIndex: 'requiredQty',
                  key: 'requiredQty',
                  width: 100
                },
                {
                  title: '实际数量',
                  dataIndex: 'actualQty',
                  key: 'actualQty',
                  width: 100
                },
                {
                  title: '单位',
                  dataIndex: 'unit',
                  key: 'unit',
                  width: 80
                },
                {
                  title: '库位',
                  dataIndex: 'location',
                  key: 'location',
                  width: 100
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 120,
                  render: (status) => <KittingStatusTag status={status} />
                },
                {
                  title: '确认人',
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
                      onClick={() => handleEditItem(selectedKitting.id, record.id, record)}
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
        title="编辑物料数量"
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
          <Form.Item label="物料信息">
            <div>
              <p><strong>编码:</strong> {editingItem?.item?.materialCode}</p>
              <p><strong>名称:</strong> {editingItem?.item?.materialName}</p>
              <p><strong>需求数量:</strong> {editingItem?.item?.requiredQty}</p>
            </div>
          </Form.Item>
          <Form.Item label="实际数量" name="actualQty" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaterialPage;
