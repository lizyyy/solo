import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, List, Button, Tag, Modal, Input, message, Descriptions,
  Space, Badge, Empty, Spin
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import {
  getMyPendingApprovals, approveOffer, rejectOffer
} from '../services/api';
import { getOfferStatusTag, formatCurrency, formatDate } from '../utils/constants';

function MyApprovals() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [comment, setComment] = useState('');

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const response = await getMyPendingApprovals();
      if (response.success) {
        setOffers(response.offers);
      }
    } catch (error) {
      console.error('Failed to load approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleApprove = async () => {
    if (!selectedOffer) return;
    try {
      setActionLoading(true);
      await approveOffer(selectedOffer.id, comment);
      message.success('审批通过');
      setApproveModalVisible(false);
      setComment('');
      setSelectedOffer(null);
      loadApprovals();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedOffer) return;
    if (!comment.trim()) {
      message.error('拒绝时必须填写原因');
      return;
    }
    try {
      setActionLoading(true);
      await rejectOffer(selectedOffer.id, comment);
      message.success('已拒绝');
      setRejectModalVisible(false);
      setComment('');
      setSelectedOffer(null);
      loadApprovals();
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const openApproveModal = (offer) => {
    setSelectedOffer(offer);
    setComment('');
    setApproveModalVisible(true);
  };

  const openRejectModal = (offer) => {
    setSelectedOffer(offer);
    setComment('');
    setRejectModalVisible(true);
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <Card title={
        <Space>
          <ClockCircleOutlined />
          我的待审批
          <Badge count={offers.length} showZero />
        </Space>
      }>
        {offers.length === 0 ? (
          <Empty description="暂无待审批的 Offer" />
        ) : (
          <List
            dataSource={offers}
            renderItem={(offer) => {
              const statusTag = getOfferStatusTag(offer.status);
              return (
                <List.Item
                  actions={[
                    <Button
                      key="view"
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => navigate(`/offers/${offer.id}`)}
                    >
                      查看详情
                    </Button>,
                    <Button
                      key="approve"
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => openApproveModal(offer)}
                    >
                      通过
                    </Button>,
                    <Button
                      key="reject"
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => openRejectModal(offer)}
                    >
                      拒绝
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span style={{ fontWeight: 600, fontSize: 16 }}>
                          {offer.candidate?.name}
                        </span>
                        <Tag color={statusTag.color}>{statusTag.label}</Tag>
                        <Tag color="blue">v{offer.version}</Tag>
                      </Space>
                    }
                    description={
                      <div style={{ marginTop: 8 }}>
                        <Descriptions column={4} size="small">
                          <Descriptions.Item label="职位">
                            {offer.candidate?.position}
                          </Descriptions.Item>
                          <Descriptions.Item label="部门">
                            {offer.candidate?.department || '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="基本工资">
                            {formatCurrency(offer.base_salary)}
                          </Descriptions.Item>
                          <Descriptions.Item label="入职日期">
                            {formatDate(offer.start_date)}
                          </Descriptions.Item>
                        </Descriptions>
                        {offer.change_reason && (
                          <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                            <strong>变更原因：</strong>{offer.change_reason}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      <Modal
        title="审批通过"
        open={approveModalVisible}
        onOk={handleApprove}
        onCancel={() => {
          setApproveModalVisible(false);
          setComment('');
          setSelectedOffer(null);
        }}
        confirmLoading={actionLoading}
        okText="确认通过"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          确认审批通过此 Offer？
        </div>
        {selectedOffer && (
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="候选人">
              {selectedOffer.candidate?.name}
            </Descriptions.Item>
            <Descriptions.Item label="职位">
              {selectedOffer.candidate?.position}
            </Descriptions.Item>
            <Descriptions.Item label="薪资">
              {formatCurrency(selectedOffer.base_salary)}/月
            </Descriptions.Item>
            <Descriptions.Item label="入职日期">
              {formatDate(selectedOffer.start_date)}
            </Descriptions.Item>
          </Descriptions>
        )}
        <Input.TextArea
          rows={3}
          placeholder="审批意见（可选）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Modal>

      <Modal
        title="拒绝 Offer"
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => {
          setRejectModalVisible(false);
          setComment('');
          setSelectedOffer(null);
        }}
        confirmLoading={actionLoading}
        okText="确认拒绝"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 16, color: '#faad14' }}>
          拒绝后此 Offer 将失效，请填写拒绝原因：
        </div>
        <Input.TextArea
          rows={4}
          placeholder="请填写拒绝原因（必填）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Modal>
    </div>
  );
}

export default MyApprovals;
