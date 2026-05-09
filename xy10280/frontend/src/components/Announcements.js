import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Space, Button, Modal, Form, Input, Select, message,
  DatePicker, Empty, Alert, Popconfirm, Timeline
} from 'antd';
import {
  PlusOutlined, EditOutlined, SendOutlined, ReloadOutlined,
  FileTextOutlined, EyeOutlined
} from '@ant-design/icons';
import { announcementsAPI, routesAPI, stationsAPI } from '../services/api';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [annData, routesData, stationsData] = await Promise.all([
        announcementsAPI.getAll(),
        routesAPI.getAll(),
        stationsAPI.getAll(),
      ]);
      setAnnouncements(annData);
      setRoutes(routesData);
      setStations(stationsData);
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStatusMap = (status) => {
    const map = {
      draft: { color: 'default', text: '草稿' },
      published: { color: 'green', text: '已发布' },
      archived: { color: 'gray', text: '已归档' },
    };
    return map[status] || { color: 'default', text: status };
  };

  const handleAdd = () => {
    setEditingAnnouncement(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingAnnouncement(record);
    form.setFieldsValue({
      ...record,
      effective_date: record.effective_date ? moment(record.effective_date) : null,
    });
    setModalVisible(true);
  };

  const handleView = (record) => {
    setSelectedAnnouncement(record);
    setDetailModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingAnnouncement) {
        await announcementsAPI.update(editingAnnouncement.id, {
          ...values,
          effective_date: values.effective_date?.format('YYYY-MM-DD'),
        });
        message.success('更新成功');
      } else {
        await announcementsAPI.create({
          ...values,
          effective_date: values.effective_date?.format('YYYY-MM-DD'),
          created_by: '系统管理员',
        });
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handlePublish = async (id) => {
    try {
      await announcementsAPI.publish(id);
      message.success('发布成功');
      loadData();
    } catch (error) {
      message.error('发布失败');
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => {
        const map = {
          adjustment: { color: 'orange', text: '线路调整' },
          withdrawal: { color: 'red', text: '站点撤销' },
          notice: { color: 'blue', text: '运营通知' },
        };
        const t = map[type] || { color: 'default', text: type };
        return <Tag color={t.color}>{t.text}</Tag>;
      },
    },
    { title: '生效日期', dataIndex: 'effective_date', key: 'effective_date', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const s = getStatusMap(status);
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '创建人', dataIndex: 'created_by', key: 'created_by', width: 100 },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>预览</Button>
          {record.status === 'draft' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Popconfirm title="确认发布该公告？" onConfirm={() => handlePublish(record.id)}>
                <Button type="link" size="small" type="primary" icon={<SendOutlined />}>发布</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const draftCount = announcements.filter(a => a.status === 'draft').length;
  const publishedCount = announcements.filter(a => a.status === 'published').length;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>调整公告管理</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建公告
          </Button>
        </Space>
      </div>

      {draftCount > 0 && (
        <Alert
          message={`有 ${draftCount} 个草稿待发布`}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card
        title={`公告列表 (已发布: ${publishedCount}, 草稿: ${draftCount})`}
      >
        <Table
          columns={columns}
          dataSource={announcements}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: <Empty description="暂无公告，点击上方按钮创建第一条公告" />,
          }}
        />
      </Card>

      <Modal
        title={editingAnnouncement ? '编辑公告' : '新建公告'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入公告标题" />
          </Form.Item>
          <Form.Item name="type" label="公告类型" rules={[{ required: true, message: '请选择类型' }]} initialValue="adjustment">
            <Select>
              <Option value="adjustment">线路调整</Option>
              <Option value="withdrawal">站点撤销</Option>
              <Option value="notice">运营通知</Option>
            </Select>
          </Form.Item>
          <Form.Item name="effective_date" label="生效日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="affected_routes" label="影响线路">
            <Select mode="tags" placeholder="选择或输入受影响的线路">
              {routes.map(route => (
                <Option key={route.id} value={route.name}>{route.name} ({route.code})</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="affected_stations" label="影响站点">
            <Select mode="tags" placeholder="选择或输入受影响的站点">
              {stations.map(station => (
                <Option key={station.id} value={station.name}>{station.name} ({station.code})</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="content" label="公告内容" rules={[{ required: true, message: '请输入内容' }]}>
            <TextArea
              rows={6}
              placeholder={`请输入公告内容，建议格式：

亲爱的各位同事：

因运营优化需要，公司班车将做如下调整：

一、调整内容
1. 线路调整：XXX
2. 站点变更：XXX

二、生效时间
XXXX年XX月XX日起

三、温馨提示
如有疑问，请联系行政部。

特此通知。
行政部`}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="公告预览"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedAnnouncement && (
          <div style={{ padding: 24, background: '#fff', minHeight: 400 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ marginBottom: 8 }}>{selectedAnnouncement.title}</h2>
              <div style={{ color: '#999' }}>
                <Tag color={getStatusMap(selectedAnnouncement.status).color}>
                  {getStatusMap(selectedAnnouncement.status).text}
                </Tag>
                <span style={{ marginLeft: 16 }}>生效日期: {selectedAnnouncement.effective_date}</span>
                <span style={{ marginLeft: 16 }}>创建人: {selectedAnnouncement.created_by}</span>
              </div>
            </div>

            {(selectedAnnouncement.affected_routes || selectedAnnouncement.affected_stations) && (
              <Alert
                message="影响范围"
                description={
                  <div>
                    {selectedAnnouncement.affected_routes && (
                      <div><strong>线路：</strong>{selectedAnnouncement.affected_routes}</div>
                    )}
                    {selectedAnnouncement.affected_stations && (
                      <div><strong>站点：</strong>{selectedAnnouncement.affected_stations}</div>
                    )}
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}

            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {selectedAnnouncement.content}
            </div>

            <div style={{ marginTop: 48, textAlign: 'right' }}>
              <div>行政部</div>
              <div>{selectedAnnouncement.published_at || selectedAnnouncement.created_at?.substring(0, 10)}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Announcements;
