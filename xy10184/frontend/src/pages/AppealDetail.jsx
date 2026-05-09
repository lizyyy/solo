import { useEffect, useState } from 'react';
import { 
  Card, Descriptions, Tag, Button, Space, Timeline, List, Modal, Form,
  Input, Select, Upload, Typography, message, Popconfirm, Divider, Row, Col
} from 'antd';
import { 
  ArrowLeftOutlined, UploadOutlined, DownloadOutlined, EditOutlined,
  CheckOutlined, CloseOutlined, InboxOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { appealApi, attachmentApi, exportApi } from '../api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

const STATUS_COLORS = {
  pending: 'default',
  processing: 'blue',
  reviewing: 'orange',
  completed: 'green',
  rejected: 'red'
};

const STATUS_NAMES = {
  pending: '待处理',
  processing: '处理中',
  reviewing: '待复核',
  completed: '已通过',
  rejected: '已驳回'
};

const CONTENT_TYPE_NAMES = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
  link: '链接',
  other: '其他'
};

export default function AppealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isOperator, isReviewer } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [appeal, setAppeal] = useState(null);
  const [history, setHistory] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [constants, setConstants] = useState({});
  const [processingModalVisible, setProcessingModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [processingForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    loadConstants();
    loadDetail();
  }, [id]);

  const loadConstants = async () => {
    try {
      const { data } = await appealApi.getConstants();
      setConstants(data);
    } catch (err) {
      console.error('加载常量失败', err);
    }
  };

  const loadDetail = async () => {
    setLoading(true);
    try {
      const { data } = await appealApi.getDetail(id);
      setAppeal(data.appeal);
      setHistory(data.history);
      setAttachments(data.attachments);
    } catch (err) {
      console.error('加载申诉详情失败', err);
    } finally {
      setLoading(false);
    }
  };

  const canEdit = () => {
    if (!appeal) return false;
    if (['completed', 'rejected'].includes(appeal.status)) return false;
    if (isAdmin()) return true;
    if (isOperator() && appeal.operator_id === user.id) return true;
    return false;
  };

  const canSubmitReview = () => {
    if (!appeal) return false;
    if (appeal.status !== 'processing') return false;
    if (isAdmin()) return true;
    if (isOperator() && appeal.operator_id === user.id) return true;
    return false;
  };

  const canReview = () => {
    if (!appeal) return false;
    if (appeal.status !== 'reviewing') return false;
    return isReviewer();
  };

  const handleSubmitReview = async (values) => {
    try {
      await appealApi.submitReview(id, values);
      message.success('提交复核成功');
      setProcessingModalVisible(false);
      processingForm.resetFields();
      loadDetail();
    } catch (err) {
      message.error('提交复核失败');
    }
  };

  const handleReview = async (action) => {
    try {
      const values = await reviewForm.validateFields();
      await appealApi.review(id, { action, remark: values.remark });
      message.success(`复核${action === 'approve' ? '通过' : '驳回'}成功`);
      setReviewModalVisible(false);
      reviewForm.resetFields();
      loadDetail();
    } catch (err) {
      message.error('复核操作失败');
    }
  };

  const handleEdit = async (values) => {
    try {
      await appealApi.update(id, values);
      message.success('更新成功');
      setEditModalVisible(false);
      editForm.resetFields();
      loadDetail();
    } catch (err) {
      message.error('更新失败');
    }
  };

  const handleUploadChange = (info) => {
    if (info.file.status === 'done') {
      message.success(`${info.file.name} 上传成功`);
      loadDetail();
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败`);
    }
  };

  const handleDeleteAttachment = (attachmentId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确认要删除该附件吗？',
      onOk: async () => {
        try {
          await attachmentApi.delete(attachmentId);
          message.success('删除成功');
          loadDetail();
        } catch (err) {
          message.error('删除失败');
        }
      }
    });
  };

  const uploadProps = {
    name: 'file',
    multiple: true,
    action: `/api/attachments/${id}/upload`,
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    beforeUpload: () => {
      if (!canEdit()) {
        message.error('无权限上传附件');
        return false;
      }
      return true;
    },
    onChange: handleUploadChange
  };

  if (loading && !appeal) {
    return <div style={{ textAlign: 'center', padding: 50 }}>加载中...</div>;
  }

  if (!appeal) {
    return <div style={{ textAlign: 'center', padding: 50 }}>申诉不存在</div>;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/appeals')}>
          返回列表
        </Button>
        <Title level={3} style={{ margin: 0 }}>申诉详情</Title>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card 
            title="基本信息"
            extra={
              <Space>
                {canEdit() && (
                  <Button 
                    icon={<EditOutlined />}
                    onClick={() => {
                      editForm.setFieldsValue(appeal);
                      setEditModalVisible(true);
                    }}
                  >
                    编辑
                  </Button>
                )}
                <Button 
                  icon={<DownloadOutlined />}
                  onClick={() => exportApi.exportAppealDetail(id)}
                >
                  导出
                </Button>
              </Space>
            }
          >
            <Descriptions column={2} bordered>
              <Descriptions.Item label="申诉编号" span={1}>
                <Tag>{appeal.appeal_no}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态" span={1}>
                <Tag color={STATUS_COLORS[appeal.status]}>
                  {STATUS_NAMES[appeal.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>
                {appeal.title}
              </Descriptions.Item>
              <Descriptions.Item label="内容类型" span={1}>
                {CONTENT_TYPE_NAMES[appeal.content_type] || appeal.content_type}
              </Descriptions.Item>
              <Descriptions.Item label="来源平台" span={1}>
                {appeal.source_platform || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="来源ID" span={2}>
                {appeal.source_id || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="申诉内容" span={2}>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{appeal.content}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="操作员" span={1}>
                {appeal.operator_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="复核员" span={1}>
                {appeal.reviewer_name || '-'}
              </Descriptions.Item>
              {appeal.result && (
                <Descriptions.Item label="处理结果" span={2}>
                  <Tag color={appeal.result === 'pass' ? 'green' : 'red'}>
                    {appeal.result === 'pass' ? '建议通过' : '建议驳回'}
                  </Tag>
                </Descriptions.Item>
              )}
              {appeal.result_reason && (
                <Descriptions.Item label="结果说明" span={2}>
                  {appeal.result_reason}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间" span={1}>
                {new Date(appeal.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间" span={1}>
                {new Date(appeal.updated_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="状态流转记录" style={{ marginTop: 16 }}>
            <Timeline
              items={history.map((h, index) => ({
                key: h.id,
                color: index === history.length - 1 ? 'blue' : undefined,
                children: (
                  <div>
                    <Text strong>{h.action}</Text>
                    {h.remark && <Text type="secondary"> - {h.remark}</Text>}
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {h.operator_name} · {new Date(h.created_at).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                )
              }))}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card 
            title="操作" 
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {canSubmitReview() && (
                <Button 
                  type="primary" 
                  block
                  onClick={() => setProcessingModalVisible(true)}
                >
                  提交复核
                </Button>
              )}
              {canReview() && (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button 
                    type="primary" 
                    block
                    icon={<CheckOutlined />}
                    onClick={() => setReviewModalVisible(true)}
                  >
                    复核处理
                  </Button>
                </Space>
              )}
              {!canSubmitReview() && !canReview() && (
                <Text type="secondary">当前状态下无可执行操作</Text>
              )}
            </Space>
          </Card>

          <Card title="证据附件">
            {canEdit() && (
              <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
                <p className="ant-upload-hint">支持单个或批量上传</p>
              </Dragger>
            )}
            
            {attachments.length > 0 ? (
              <List
                dataSource={attachments}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <a 
                        key="download"
                        href={attachmentApi.download(item.id)}
                      >
                        下载
                      </a>,
                      canEdit() && item.uploaded_by === user.id && (
                        <a 
                          key="delete"
                          onClick={() => handleDeleteAttachment(item.id)}
                        >
                          删除
                        </a>
                      )
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={item.original_name}
                      description={
                        <Text type="secondary">
                          {item.uploaded_by_name} · {new Date(item.created_at).toLocaleString('zh-CN')}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无附件</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="提交复核"
        open={processingModalVisible}
        onCancel={() => setProcessingModalVisible(false)}
        onOk={() => processingForm.submit()}
        destroyOnClose
      >
        <Form
          form={processingForm}
          layout="vertical"
          onFinish={handleSubmitReview}
        >
          <Form.Item
            name="result"
            label="处理结果"
            rules={[{ required: true, message: '请选择处理结果' }]}
          >
            <Select placeholder="请选择">
              <Select.Option value="pass">建议通过</Select.Option>
              <Select.Option value="reject">建议驳回</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="result_reason"
            label="结果说明"
          >
            <TextArea rows={4} placeholder="请输入处理结果说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="复核处理"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setReviewModalVisible(false)}>
            取消
          </Button>,
          <Button 
            key="reject" 
            danger
            icon={<CloseOutlined />}
            onClick={() => handleReview('reject')}
          >
            复核驳回
          </Button>,
          <Button 
            key="approve" 
            type="primary" 
            icon={<CheckOutlined />}
            onClick={() => handleReview('approve')}
          >
            复核通过
          </Button>
        ]}
        destroyOnClose
      >
        <Form
          form={reviewForm}
          layout="vertical"
        >
          <Form.Item
            name="remark"
            label="复核意见"
          >
            <TextArea rows={4} placeholder="请输入复核意见（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑申诉信息"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => editForm.submit()}
        width={600}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEdit}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item
            name="content"
            label="申诉内容"
            rules={[{ required: true, message: '请输入申诉内容' }]}
          >
            <TextArea rows={4} placeholder="请详细描述申诉内容" />
          </Form.Item>
          <Form.Item
            name="content_type"
            label="内容类型"
            rules={[{ required: true, message: '请选择内容类型' }]}
          >
            <Select placeholder="请选择内容类型">
              {constants.content_types?.map((ct) => (
                <Select.Option key={ct.value} value={ct.value}>
                  {ct.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="source_platform" label="来源平台">
            <Input placeholder="如：抖音、微博等" />
          </Form.Item>
          <Form.Item name="source_id" label="来源ID">
            <Input placeholder="原始内容ID或链接" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
