import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Typography,
  Tooltip,
  Popconfirm,
  message,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  BulbOutlined,
  HistoryOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { artworkAPI, lightingAPI } from '../utils/api';

const { Title } = Typography;
const { Option } = Select;

function ArtworkListPage() {
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [lightingModalVisible, setLightingModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [currentArtwork, setCurrentArtwork] = useState(null);
  const [currentLighting, setCurrentLighting] = useState(null);
  const [artworkHistory, setArtworkHistory] = useState([]);
  const [form] = Form.useForm();
  const [lightingForm] = Form.useForm();

  const fetchArtworks = async () => {
    setLoading(true);
    try {
      const response = await artworkAPI.getAll();
      setArtworks(response.data);
    } catch (error) {
      message.error('获取作品列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtworks();
  }, []);

  const handleEdit = async (artwork) => {
    setCurrentArtwork(artwork);
    form.setFieldsValue(artwork);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (values) => {
    try {
      await artworkAPI.update(currentArtwork.id, {
        ...values,
        change_reason: '手动编辑修正',
      });
      message.success('作品信息已更新');
      setEditModalVisible(false);
      fetchArtworks();
    } catch (error) {
      message.error('更新失败：' + (error.response?.data?.detail || '未知错误'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await artworkAPI.delete(id);
      message.success('作品已删除');
      fetchArtworks();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleLighting = async (artwork) => {
    setCurrentArtwork(artwork);
    try {
      const response = await lightingAPI.get(artwork.id);
      setCurrentLighting(response.data);
      if (response.data) {
        lightingForm.setFieldsValue(response.data);
      }
    } catch {
      setCurrentLighting(null);
    }
    setLightingModalVisible(true);
  };

  const handleSaveLighting = async (values) => {
    try {
      if (currentLighting) {
        await lightingAPI.update(currentLighting.id, values);
      } else {
        await lightingAPI.create(currentArtwork.id, values);
      }
      message.success('灯光方案已保存');
      setLightingModalVisible(false);
    } catch (error) {
      message.error('保存失败：' + (error.response?.data?.detail || '未知错误'));
    }
  };

  const handleToggleLightingLock = async (lighting, lock) => {
    try {
      if (lock) {
        await lightingAPI.lock(lighting.id);
        message.success('灯光方案已锁定');
      } else {
        await lightingAPI.unlock(lighting.id);
        message.success('灯光方案已解锁');
      }
      const response = await lightingAPI.get(currentArtwork.id);
      setCurrentLighting(response.data);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleViewHistory = async (artwork) => {
    setCurrentArtwork(artwork);
    try {
      const response = await artworkAPI.getHistory(artwork.id);
      setArtworkHistory(response.data);
    } catch {
      setArtworkHistory([]);
    }
    setHistoryModalVisible(true);
  };

  const columns = [
    {
      title: '作品编号',
      dataIndex: 'artwork_id',
      key: 'artwork_id',
      width: 120,
    },
    {
      title: '作品名称',
      dataIndex: 'title',
      key: 'title',
      width: 180,
    },
    {
      title: '艺术家',
      dataIndex: 'artist',
      key: 'artist',
      width: 120,
    },
    {
      title: '尺寸',
      key: 'dimensions',
      width: 150,
      render: (_, record) => (
        <span>
          {record.width} × {record.height}
          {record.depth ? ` × ${record.depth}` : ''} {record.unit}
        </span>
      ),
    },
    {
      title: '展墙位置',
      dataIndex: 'wall_location',
      key: 'wall_location',
      width: 120,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.needs_confirmation) {
          return <Tag color="orange">待确认</Tag>;
        }
        if (record.status === 'confirmed') {
          return <Tag color="green">已确认</Tag>;
        }
        return <Tag color="blue">待处理</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="灯光方案">
            <Button
              type="text"
              icon={<BulbOutlined />}
              onClick={() => handleLighting(record)}
            />
          </Tooltip>
          <Tooltip title="历史记录">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => handleViewHistory(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定删除此作品？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: '版本',
      dataIndex: 'version_number',
      key: 'version_number',
      width: 80,
    },
    {
      title: '修改字段',
      dataIndex: 'field_cn',
      key: 'field_cn',
      width: 120,
    },
    {
      title: '原值',
      dataIndex: 'old_value',
      key: 'old_value',
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
    },
    {
      title: '修改原因',
      dataIndex: 'change_reason',
      key: 'change_reason',
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
    },
  ];

  return (
    <div>
      <Title level={2}>作品列表</Title>
      
      <Table
        columns={columns}
        dataSource={artworks}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="编辑作品信息"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveEdit}
        >
          <Form.Item name="title" label="作品名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="artist" label="艺术家" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="width" label="宽度" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="height" label="高度" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="unit" label="单位" style={{ flex: 1 }}>
              <Select>
                <Option value="cm">厘米 (cm)</Option>
                <Option value="m">米 (m)</Option>
                <Option value="mm">毫米 (mm)</Option>
                <Option value="inch">英寸 (inch)</Option>
              </Select>
            </Form.Item>
          </Space>
          <Form.Item name="wall_location" label="展墙位置">
            <Input placeholder="例如：A墙、主展厅西墙" />
          </Form.Item>
          <Form.Item name="change_reason" label="修改原因">
            <Input.TextArea rows={2} placeholder="请填写修改原因" />
          </Form.Item>
          <Form.Item>
            <Space style={{ float: 'right' }}>
              <Button onClick={() => setEditModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <BulbOutlined />
            灯光方案 - {currentArtwork?.title}
            {currentLighting?.is_locked && (
              <Tag color="red" icon={<LockOutlined />}>已锁定</Tag>
            )}
          </Space>
        }
        open={lightingModalVisible}
        onCancel={() => setLightingModalVisible(false)}
        footer={null}
        width={500}
      >
        {currentLighting && (
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            {currentLighting.is_locked ? (
              <Tooltip title="灯光方案被锁定时无法修改">
                <Button
                  icon={<UnlockOutlined />}
                  onClick={() => handleToggleLightingLock(currentLighting, false)}
                >
                  解锁灯光方案
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="锁定后无法随意修改，防止被覆盖">
                <Button
                  type="primary"
                  icon={<LockOutlined />}
                  onClick={() => handleToggleLightingLock(currentLighting, true)}
                >
                  锁定灯光方案
                </Button>
              </Tooltip>
            )}
          </div>
        )}
        <Form
          form={lightingForm}
          layout="vertical"
          onFinish={handleSaveLighting}
        >
          <Form.Item
            name="light_type"
            label="灯光类型"
            rules={[{ required: true, message: '请选择灯光类型' }]}
          >
            <Select placeholder="请选择灯光类型">
              <Option value="spotlight">聚光灯</Option>
              <Option value="floodlight">泛光灯</Option>
              <Option value="tracklight">轨道灯</Option>
              <Option value="wallwasher">洗墙灯</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="intensity"
            label="灯光强度 (%)"
            rules={[{ required: true, message: '请输入灯光强度' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="color_temp" label="色温 (K)">
            <InputNumber placeholder="例如：3000" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="angle" label="照射角度">
            <InputNumber placeholder="0-360" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="灯光调整说明、特殊要求等" />
          </Form.Item>
          <Form.Item>
            <Space style={{ float: 'right' }}>
              <Button onClick={() => setLightingModalVisible(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                disabled={currentLighting?.is_locked}
              >
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <HistoryOutlined />
            历史记录 - {currentArtwork?.title}
          </Space>
        }
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {artworkHistory.length > 0 ? (
          <Table
            columns={historyColumns}
            dataSource={artworkHistory}
            rowKey="id"
            pagination={false}
            size="small"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            暂无历史记录
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ArtworkListPage;
