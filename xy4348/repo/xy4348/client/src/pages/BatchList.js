import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic,
  Space,
  Tag
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  DeleteOutlined,
  FileTextOutlined,
  WarningOutlined,
  SafetyOutlined,
  CameraOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { batchApi } from '../api';
import dayjs from 'dayjs';

const { TextArea } = Input;

function BatchList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [stats, setStats] = useState({
    totalBatches: 0,
    totalRisks: 0,
    highRiskSegments: 0,
    totalPhotos: 0
  });

  // 加载批次列表
  const loadBatches = async () => {
    setLoading(true);
    try {
      const result = await batchApi.getAll();
      if (result.success) {
        setBatches(result.data);
        
        // 计算统计信息
        let totalRisks = 0;
        let highRiskSegments = 0;
        let totalPhotos = 0;
        
        // 这里简化处理，实际应该从每个批次的详细信息获取
        // 这里假设我们需要重新加载每个批次的统计
        // 为了简化，暂时不显示这些详细统计
      }
    } catch (error) {
      message.error('加载批次列表失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  // 创建新批次
  const handleCreateBatch = async (values) => {
    try {
      const result = await batchApi.create(values);
      if (result.success) {
        message.success('批次创建成功');
        setIsModalVisible(false);
        form.resetFields();
        loadBatches();
        // 跳转到新创建的批次详情页
        navigate(`/batches/${result.data.id}`);
      }
    } catch (error) {
      message.error('创建批次失败: ' + (error.response?.data?.error || error.message));
    }
  };

  // 删除批次
  const handleDeleteBatch = async (id) => {
    try {
      const result = await batchApi.delete(id);
      if (result.success) {
        message.success('批次删除成功');
        loadBatches();
      }
    } catch (error) {
      message.error('删除批次失败: ' + (error.response?.data?.error || error.message));
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '批次名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/batches/${record.id}`)}>
          <Space>
            <FileTextOutlined />
            {text}
          </Space>
        </a>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/batches/${record.id}`)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这个批次吗？"
            description="删除后将无法恢复所有相关数据。"
            onConfirm={() => handleDeleteBatch(record.id)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card className="stat-card">
              <Statistic
                title="勘察批次"
                value={batches.length}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="stat-card">
              <Statistic
                title="风险报告"
                value={stats.totalRisks}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="stat-card">
              <Statistic
                title="高风险路段"
                value={stats.highRiskSegments}
                prefix={<SafetyOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="stat-card">
              <Statistic
                title="照片证据"
                value={stats.totalPhotos}
                prefix={<CameraOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>勘察批次列表</h2>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setIsModalVisible(true)}
        >
          新建批次
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={batches}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <FileTextOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                <p style={{ color: '#999', marginBottom: '16px' }}>暂无勘察批次</p>
                <Button type="primary" onClick={() => setIsModalVisible(true)}>
                  创建第一个批次
                </Button>
              </div>
            )
          }}
        />
      </Card>

      {/* 创建批次模态框 */}
      <Modal
        title="新建勘察批次"
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateBatch}
        >
          <Form.Item
            name="name"
            label="批次名称"
            rules={[{ required: true, message: '请输入批次名称' }]}
          >
            <Input 
              placeholder="例如：2024年春季骑行路线勘察" 
              prefix={<ClockCircleOutlined />}
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述说明"
          >
            <TextArea 
              rows={4} 
              placeholder="描述本次勘察的路线、目的等信息..." 
            />
          </Form.Item>
          <div style={{ 
            padding: '12px', 
            background: '#f6ffed', 
            borderRadius: '6px',
            border: '1px solid #b7eb8f'
          }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#389e0d' }}>
              <strong>提示：</strong>创建批次后，可以上传以下文件：
            </p>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#389e0d' }}>
              <li><strong>GPX 文件</strong> - 骑行路线轨迹数据</li>
              <li><strong>路况 CSV</strong> - 路况问题报告</li>
              <li><strong>照片索引 CSV</strong> - 照片证据索引</li>
            </ul>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default BatchList;
