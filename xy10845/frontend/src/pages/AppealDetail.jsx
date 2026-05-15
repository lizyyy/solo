import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Timeline,
  Row,
  Col,
  List,
  Modal,
  Input,
  Select,
  message,
  Divider
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

const statusMap = {
  pending: { text: '待处理', color: 'orange' },
  reviewing: { text: '审核中', color: 'blue' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  escalated: { text: '已升级', color: 'purple' }
};

const actionIconMap = {
  create: <UserOutlined style={{ color: '#1890ff' }} />,
  assign: <UserOutlined style={{ color: '#52c41a' }} />,
  approve: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  reject: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  escalate: <ExclamationCircleOutlined style={{ color: '#722ed1' }} />
};

function AppealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [disposalNote, setDisposalNote] = useState('');
  const [selectedReviewer, setSelectedReviewer] = useState('');

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/appeals/${id}`);
      if (response.data.success) {
        setDetail(response.data.data);
      }
    } catch (error) {
      message.error('获取申诉详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewers = async () => {
    try {
      const response = await axios.get('/api/reviewers');
      if (response.data.success) {
        setReviewers(response.data.data);
      }
    } catch (error) {
      console.error('获取审核员列表失败');
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchReviewers();
  }, [id]);

  const handleAction = async (actionType) => {
    try {
      const operatorId = 'admin';
      const operatorName = '管理员';
      let url = '';
      let data = { operatorId, operatorName };

      switch (actionType) {
        case 'assign':
          url = `/api/appeals/${id}/assign`;
          if (selectedReviewer) {
            data.reviewerId = selectedReviewer;
          }
          break;
        case 'approve':
          url = `/api/appeals/${id}/approve`;
          data.disposalNote = disposalNote;
          break;
        case 'reject':
          url = `/api/appeals/${id}/reject`;
          data.disposalNote = disposalNote;
          break;
        case 'escalate':
          url = `/api/appeals/${id}/escalate`;
          break;
        default:
          return;
      }

      const response = await axios.post(url, data);
      if (response.data.success) {
        message.success('操作成功');
        setModalVisible(false);
        setDisposalNote('');
        setSelectedReviewer('');
        fetchDetail();
      }
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setModalVisible(true);
  };

  if (!detail) {
    return <div>加载中...</div>;
  }

  const { appeal, content, auditTags, modelReasons, auditTrail } = detail;
  const statusCfg = statusMap[appeal.status] || { text: appeal.status, color: 'default' };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回列表
        </Button>
      </Space>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="申诉基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2}>
              <Descriptions.Item label="申诉ID">{appeal.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusCfg.color}>{statusCfg.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申诉人">{appeal.submitter_name}</Descriptions.Item>
              <Descriptions.Item label="联系方式">{appeal.submitter_contact || '-'}</Descriptions.Item>
              <Descriptions.Item label="申诉理由" span={2}>
                {appeal.appeal_reason}
              </Descriptions.Item>
              <Descriptions.Item label="证据材料" span={2}>
                {appeal.evidence_materials || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="审核员">{appeal.assignee_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="处置结果">{appeal.disposal_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="处置备注" span={2}>
                {appeal.disposal_note || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {dayjs(appeal.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="操作" style={{ marginBottom: 16 }}>
            <Space>
              {appeal.status === 'pending' && (
                <Button type="primary" onClick={() => openModal('assign')}>
                  分派审核
                </Button>
              )}
              {appeal.status === 'reviewing' && (
                <>
                  <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => openModal('approve')}>
                    通过申诉
                  </Button>
                  <Button danger icon={<CloseCircleOutlined />} onClick={() => openModal('reject')}>
                    驳回申诉
                  </Button>
                  <Button icon={<ExclamationCircleOutlined />} onClick={() => openModal('escalate')}>
                    升级处理
                  </Button>
                </>
              )}
            </Space>
          </Card>

          <Card title="审核时间线">
            <Timeline className="appeal-timeline">
              {auditTrail.map((item, index) => (
                <Timeline.Item
                  key={index}
                  dot={actionIconMap[item.action] || <UserOutlined />}
                >
                  <p>
                    <strong>{item.operator_name || '系统'}</strong>
                    <span style={{ color: '#999', marginLeft: 8 }}>
                      {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </span>
                  </p>
                  <p>{item.remark}</p>
                  {item.old_status && item.new_status && (
                    <p>
                      状态变更: {statusMap[item.old_status]?.text} → {statusMap[item.new_status]?.text}
                    </p>
                  )}
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="内容信息" style={{ marginBottom: 16 }}>
            <Descriptions column={1}>
              <Descriptions.Item label="内容ID">{content.id}</Descriptions.Item>
              <Descriptions.Item label="内容类型">{content.content_type}</Descriptions.Item>
              <Descriptions.Item label="内容状态">
                <Tag>{content.content_status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="作者">{content.author_name}</Descriptions.Item>
              <Descriptions.Item label="拦截时间">
                {dayjs(content.block_time).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="内容摘要" span={1}>
                {content.content_text}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="模型拦截原因" style={{ marginBottom: 16 }}>
            <List
              dataSource={modelReasons}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color="red">{item.reason_code}</Tag>
                        <Tag color="orange">风险: {item.risk_level}</Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <p>模型版本: {item.model_version}</p>
                        <p>详细原因: {item.reason_detail}</p>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="审核标签">
            <List
              dataSource={auditTags}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Tag color="blue">{item.tag_name}</Tag>
                    <span>置信度: {(item.confidence * 100).toFixed(1)}%</span>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={
          modalType === 'assign' ? '分派审核' :
          modalType === 'approve' ? '通过申诉' :
          modalType === 'reject' ? '驳回申诉' : '升级处理'
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => handleAction(modalType)}
      >
        {modalType === 'assign' && (
          <Select
            placeholder="选择审核员（留空则自动分派）"
            style={{ width: '100%' }}
            allowClear
            value={selectedReviewer}
            onChange={setSelectedReviewer}
          >
            {reviewers.map(r => (
              <Option key={r.id} value={r.id}>{r.name} ({r.department})</Option>
            ))}
          </Select>
        )}
        {(modalType === 'approve' || modalType === 'reject') && (
          <TextArea
            rows={4}
            placeholder="请输入处置备注"
            value={disposalNote}
            onChange={(e) => setDisposalNote(e.target.value)}
          />
        )}
        {modalType === 'escalate' && (
          <p>确认将此申诉升级至高级审核团队？</p>
        )}
      </Modal>
    </div>
  );
}

export default AppealDetail;
