import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Space, 
  Input, 
  Select, 
  Row, 
  Col, 
  Modal, 
  Form, 
  message, 
  Card, 
  Descriptions,
  List
} from 'antd';
import { SearchOutlined, EyeOutlined, SyncOutlined, PaperClipOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

function AppealsList() {
  const [loading, setLoading] = useState(true);
  const [appeals, setAppeals] = useState([]);
  const [filteredAppeals, setFilteredAppeals] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAppeals();
  }, []);

  useEffect(() => {
    filterAppeals();
  }, [appeals, searchText, statusFilter]);

  const fetchAppeals = async () => {
    try {
      const response = await axios.get('/api/appeals');
      if (response.data.success) {
        setAppeals(response.data.data);
      }
    } catch (error) {
      message.error('获取申诉列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filterAppeals = () => {
    let filtered = [...appeals];
    
    if (searchText) {
      filtered = filtered.filter(a => 
        a.content_title?.includes(searchText) ||
        a.creator_name?.includes(searchText) ||
        a.appeal_reason?.includes(searchText)
      );
    }
    
    if (statusFilter) {
      filtered = filtered.filter(a => a.status === statusFilter);
    }
    
    setFilteredAppeals(filtered);
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: 'orange',
      approved: 'green',
      rejected: 'red',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status) => {
    const textMap = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已驳回',
    };
    return textMap[status] || status;
  };

  const handleReview = async (values) => {
    try {
      const response = await axios.put(`/api/appeals/${selectedAppeal.id}/review`, values);
      if (response.data.success) {
        message.success('审核完成');
        setReviewModalVisible(false);
        form.resetFields();
        fetchAppeals();
      } else {
        message.error(response.data.error || '审核失败');
      }
    } catch (error) {
      message.error(error.response?.data?.error || '审核失败');
    }
  };

  const columns = [
    {
      title: '内容标题',
      dataIndex: 'content_title',
      key: 'content_title',
      ellipsis: true,
      width: 200,
    },
    {
      title: '创作者',
      dataIndex: 'creator_name',
      key: 'creator_name',
      width: 100,
    },
    {
      title: '申诉原因',
      dataIndex: 'appeal_reason',
      key: 'appeal_reason',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)} className="status-tag">
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '审核人',
      dataIndex: 'reviewer',
      key: 'reviewer',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={async () => {
              try {
                const response = await axios.get(`/api/appeals/${record.id}`);
                if (response.data.success) {
                  setSelectedAppeal(response.data.data);
                  setDetailModalVisible(true);
                }
              } catch (error) {
                message.error('获取申诉详情失败');
              }
            }}
          >
            查看详情
          </Button>
          {record.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              onClick={async () => {
                try {
                  const response = await axios.get(`/api/appeals/${record.id}`);
                  if (response.data.success) {
                    setSelectedAppeal(response.data.data);
                    setReviewModalVisible(true);
                  }
                } catch (error) {
                  message.error('获取申诉详情失败');
                }
              }}
            >
              审核
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>申诉管理</h2>
        <Button icon={<SyncOutlined />} onClick={fetchAppeals}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Input
            placeholder="搜索内容标题、创作者、申诉原因"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Select
            style={{ width: '100%' }}
            placeholder="筛选状态"
            value={statusFilter || undefined}
            onChange={setStatusFilter}
            allowClear
          >
            <Option value="pending">待审核</Option>
            <Option value="approved">已通过</Option>
            <Option value="rejected">已驳回</Option>
          </Select>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredAppeals}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="申诉详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedAppeal && (
          <div>
            <Descriptions column={2} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="内容标题" span={2}>
                {selectedAppeal.content_title}
              </Descriptions.Item>
              <Descriptions.Item label="创作者">{selectedAppeal.creator_name}</Descriptions.Item>
              <Descriptions.Item label="申诉原因">{selectedAppeal.appeal_reason}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(selectedAppeal.status)}>
                  {getStatusText(selectedAppeal.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="审核人">{selectedAppeal.reviewer || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核时间">
                {selectedAppeal.reviewed_at ? dayjs(selectedAppeal.reviewed_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="申诉详情" span={2}>
                {selectedAppeal.appeal_details || '-'}
              </Descriptions.Item>
              {selectedAppeal.review_notes && (
                <Descriptions.Item label="审核备注" span={2}>
                  {selectedAppeal.review_notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedAppeal.materials?.length > 0 && (
              <Card 
                size="small" 
                title={
                  <span>
                    <PaperClipOutlined style={{ marginRight: 8 }} />
                    合规材料 ({selectedAppeal.materials.length})
                  </span>
                }
              >
                <List
                  dataSource={selectedAppeal.materials}
                  size="small"
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={<Tag>{item.material_type}</Tag>}
                        description={
                          <div>
                            <div>{item.description || '-'}</div>
                            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                              上传人: {item.uploaded_by || '-'}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="审核申诉"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleReview}
        >
          <Form.Item
            name="status"
            label="审核结果"
            rules={[{ required: true, message: '请选择审核结果' }]}
          >
            <Select placeholder="请选择审核结果">
              <Option value="approved">通过（恢复内容）</Option>
              <Option value="rejected">驳回（维持下架）</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="reviewer"
            label="审核人"
            rules={[{ required: true, message: '请输入审核人姓名' }]}
          >
            <Input placeholder="请输入审核人姓名" />
          </Form.Item>
          <Form.Item
            name="review_notes"
            label="审核备注"
          >
            <TextArea rows={3} placeholder="请输入审核备注" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
              <Button onClick={() => setReviewModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AppealsList;
