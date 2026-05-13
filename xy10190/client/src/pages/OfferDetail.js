import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Space, Divider, Modal, Input, message,
  Timeline, Row, Col, Steps, Popconfirm, Spin, Alert
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DownloadOutlined, SendOutlined,
  RollbackOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined
} from '@ant-design/icons';
import {
  getOffer, submitOffer, withdrawOffer, redraftOffer, acceptOffer, rejectOfferByCandidate,
  downloadOfferPDF
} from '../services/api';
import { getOfferStatusTag, formatCurrency, formatDate, formatDateTime } from '../utils/constants';

function OfferDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [redraftModalVisible, setRedraftModalVisible] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [redraftReason, setRedraftReason] = useState('');

  const loadOffer = async () => {
    setLoading(true);
    try {
      const response = await getOffer(id);
      if (response.success) {
        setOffer(response.offer);
      }
    } catch (error) {
      console.error('Failed to load offer:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffer();
  }, [id]);

  const handleSubmit = async () => {
    try {
      setActionLoading(true);
      await submitOffer(id);
      message.success('Offer 已提交审批');
      loadOffer();
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      setActionLoading(true);
      await withdrawOffer(id, withdrawReason);
      message.success('Offer 已撤回');
      setWithdrawModalVisible(false);
      setWithdrawReason('');
      loadOffer();
    } catch (error) {
      console.error('Failed to withdraw:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      setActionLoading(true);
      await acceptOffer(id);
      message.success('候选人已确认接受');
      loadOffer();
    } catch (error) {
      console.error('Failed to accept:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectByCandidate = async () => {
    if (!rejectReason.trim()) {
      message.error('请填写拒绝原因');
      return;
    }
    try {
      setActionLoading(true);
      await rejectOfferByCandidate(id, rejectReason);
      message.success('已记录候选人拒绝');
      setRejectModalVisible(false);
      setRejectReason('');
      loadOffer();
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRedraft = async () => {
    try {
      setActionLoading(true);
      await redraftOffer(id, redraftReason);
      message.success('Offer 已重新变为草稿，可以编辑后重新提交审批');
      setRedraftModalVisible(false);
      setRedraftReason('');
      loadOffer();
    } catch (error) {
      console.error('Failed to redraft:', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !offer) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const statusTag = getOfferStatusTag(offer.status);
  const approverIds = offer.approver_ids || [];
  const approvalRecords = offer.approval_records || [];

  const getApprovalStepStatus = (index) => {
    if (index < offer.current_approver_index) {
      const record = approvalRecords[index];
      return record?.action === 'approve' ? 'finish' : 'error';
    }
    if (index === offer.current_approver_index && offer.status === 'pending_approval') {
      return 'process';
    }
    return 'wait';
  };

  const getActionButtons = () => {
    const buttons = [];

    if (offer.status === 'draft') {
      buttons.push(
        <Button
          key="submit"
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          loading={actionLoading}
        >
          提交审批
        </Button>
      );
    }

    if (offer.status === 'pending_approval' || offer.status === 'approved') {
      buttons.push(
        <Button
          key="withdraw"
          icon={<RollbackOutlined />}
          onClick={() => setWithdrawModalVisible(true)}
          loading={actionLoading}
        >
          撤回
        </Button>
      );
    }

    if (offer.status === 'approved') {
      buttons.push(
        <Popconfirm
          key="accept"
          title="确认候选人已接受 Offer？"
          onConfirm={handleAccept}
          okText="确认"
          cancelText="取消"
          disabled={offer.is_accepted}
        >
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={actionLoading}
            disabled={offer.is_accepted}
          >
            确认接受
          </Button>
        </Popconfirm>
      );
      
      if (!offer.is_accepted) {
        buttons.push(
          <Button
            key="reject"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => setRejectModalVisible(true)}
            loading={actionLoading}
          >
            候选人拒绝
          </Button>
        );
      }

      buttons.push(
        <Button
          key="new-version"
          type="primary"
          ghost
          icon={<ReloadOutlined />}
          onClick={() => navigate(`/offers/new/${offer.id}`)}
        >
          新建版本
        </Button>
      );
    }

    if (offer.status === 'withdrawn' || offer.status === 'rejected' || offer.status === 'rejected_by_candidate') {
      buttons.push(
        <Button
          key="redraft"
          icon={<EditOutlined />}
          onClick={() => setRedraftModalVisible(true)}
          loading={actionLoading}
        >
          重新编辑
        </Button>
      );
      buttons.push(
        <Button
          key="new-version"
          type="primary"
          ghost
          icon={<ReloadOutlined />}
          onClick={() => navigate(`/offers/new/${offer.id}`)}
        >
          新建版本
        </Button>
      );
    }

    if (offer.status === 'approved' || offer.status === 'rejected' || offer.status === 'withdrawn') {
      if (offer.status === 'approved') {
        buttons.push(
          <Button
            key="pdf"
            icon={<DownloadOutlined />}
            onClick={() => downloadOfferPDF(offer.id)}
          >
            下载 PDF
          </Button>
        );
      }
    }

    return buttons;
  };

  return (
    <div className="page-container">
      <Card>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/offers')}
              style={{ marginBottom: 8 }}
            >
              返回列表
            </Button>
            <h2 style={{ margin: 0 }}>
              Offer 详情
              <Tag style={{ marginLeft: 12 }} color={statusTag.color}>
                {statusTag.label}
              </Tag>
              {offer.is_accepted && (
                <Tag color="success">已接受</Tag>
              )}
            </h2>
          </div>
          <Space>{getActionButtons()}</Space>
        </div>

        {offer.change_reason && (
          <Alert
            message="变更说明"
            description={offer.change_reason}
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Row gutter={[24, 24]}>
          <Col span={16}>
            <Card title="基本信息" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="版本">
                  <Tag color="blue">v{offer.version}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="候选人">
                  {offer.candidate?.name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="职位">
                  {offer.candidate?.position || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="部门">
                  {offer.candidate?.department || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="联系电话">
                  {offer.candidate?.phone || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="邮箱">
                  {offer.candidate?.email || '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Divider />

            <Card title="薪酬福利" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="基本工资">
                  <span style={{ color: '#1890ff', fontWeight: 600 }}>
                    {formatCurrency(offer.base_salary)} / 月
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="年度奖金">
                  {formatCurrency(offer.bonus)}
                </Descriptions.Item>
                <Descriptions.Item label="入职日期">
                  {formatDate(offer.start_date)}
                </Descriptions.Item>
                <Descriptions.Item label="试用期">
                  {offer.probation_period} 个月
                </Descriptions.Item>
                <Descriptions.Item label="工作地点" span={2}>
                  {offer.work_location || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="其他福利" span={2}>
                  {offer.benefits || '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Divider />

            <Card title="审批流程" size="small">
              <Steps
                direction="vertical"
                current={offer.current_approver_index}
                status={offer.status === 'rejected' ? 'error' : offer.status === 'approved' ? 'finish' : 'process'}
                items={approverIds.map((approverId, index) => {
                  const approver = offer.approvers?.[index];
                  const record = approvalRecords[index];
                  const status = getApprovalStepStatus(index);
                  let description = `${approver?.department || ''} ${approver?.role || ''}`;
                  if (record?.comment) {
                    description += ` - ${record.comment}`;
                  }
                  return {
                    title: `${index + 1}. ${approver?.name || '审批人' + (index + 1)}`,
                    description,
                    status,
                    subTitle: record ? formatDateTime(record.created_at) : null
                  };
                })}
              />
            </Card>
          </Col>

          <Col span={8}>
            <Card title="版本历史" size="small">
              <Timeline
                items={(offer.versions || []).map((v, index) => ({
                  color: v.id === offer.id ? 'blue' : 'gray',
                  children: (
                    <div>
                      <div style={{ fontWeight: v.id === offer.id ? 600 : 400 }}>
                        v{v.version}
                        {v.id === offer.id && <Tag color="blue" style={{ marginLeft: 8 }}>当前</Tag>}
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {getOfferStatusTag(v.status).label}
                      </div>
                      {v.change_reason && (
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                          {v.change_reason}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                        {formatDateTime(v.created_at)}
                      </div>
                    </div>
                  )
                }))}
              />
            </Card>

            <Divider />

            <Card title="其他信息" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="创建人">
                  {offer.creator?.name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {formatDateTime(offer.created_at)}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {formatDateTime(offer.updated_at)}
                </Descriptions.Item>
                {offer.accepted_at && (
                  <Descriptions.Item label="接受时间">
                    {formatDateTime(offer.accepted_at)}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </Card>

      <Modal
        title="撤回 Offer"
        open={withdrawModalVisible}
        onOk={handleWithdraw}
        onCancel={() => setWithdrawModalVisible(false)}
        confirmLoading={actionLoading}
        okText="确认撤回"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          确定要撤回这个 Offer 吗？撤回后需要重新走审批流程。
        </div>
        <Input.TextArea
          rows={3}
          placeholder="请填写撤回原因（可选）"
          value={withdrawReason}
          onChange={(e) => setWithdrawReason(e.target.value)}
        />
      </Modal>

      <Modal
        title="候选人拒绝 Offer"
        open={rejectModalVisible}
        onOk={handleRejectByCandidate}
        onCancel={() => setRejectModalVisible(false)}
        confirmLoading={actionLoading}
        okText="确认"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          请填写候选人拒绝的原因：
        </div>
        <Input.TextArea
          rows={3}
          placeholder="拒绝原因"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

      <Modal
        title="重新编辑 Offer"
        open={redraftModalVisible}
        onOk={handleRedraft}
        onCancel={() => setRedraftModalVisible(false)}
        confirmLoading={actionLoading}
        okText="确认重新编辑"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          确定要将此 Offer 重新变为草稿吗？之前的审批记录将被清除，您可以修改内容后重新提交审批。
        </div>
        <Input.TextArea
          rows={3}
          placeholder="请填写重新编辑的原因（可选）"
          value={redraftReason}
          onChange={(e) => setRedraftReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}

export default OfferDetail;
