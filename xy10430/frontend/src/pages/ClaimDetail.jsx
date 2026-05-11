import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Descriptions, 
  Tag, 
  Timeline, 
  Row, 
  Col, 
  Button, 
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Divider,
  Alert,
  Statistic
} from 'antd';
import { 
  ArrowLeftOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  FileTextOutlined,
  EditOutlined
} from '@ant-design/icons';
import { claimApi } from '../services/api';
import moment from 'moment';

const { TextArea } = Input;

function ClaimDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [evidenceModalVisible, setEvidenceModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadClaim();
  }, [id]);

  const loadClaim = async () => {
    setLoading(true);
    try {
      const res = await claimApi.get(id);
      if (res.success) {
        setClaim(res.data);
      }
    } catch (error) {
      console.error('加载索赔详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (values) => {
    try {
      const res = await claimApi.approve(id, values);
      if (res.success) {
        message.success('索赔已批准');
        setApproveModalVisible(false);
        loadClaim();
      }
    } catch (error) {
      message.error('批准失败');
    }
  };

  const handleReject = async (values) => {
    try {
      const res = await claimApi.reject(id, values);
      if (res.success) {
        message.success('索赔已驳回');
        setRejectModalVisible(false);
        loadClaim();
      }
    } catch (error) {
      message.error('驳回失败');
    }
  };

  const handleSaveEvidence = async (values) => {
    try {
      const res = await claimApi.updateEvidence(id, values);
      if (res.success) {
        message.success('证据已保存');
        setEvidenceModalVisible(false);
        loadClaim();
      }
    } catch (error) {
      message.error('保存证据失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      'draft': <Tag color="default">草稿</Tag>,
      'pending_review': <Tag color="orange">待审批</Tag>,
      'approved': <Tag color="green">已批准</Tag>,
      'rejected': <Tag color="red">已驳回</Tag>,
      'paid': <Tag color="blue">已赔付</Tag>,
      'closed': <Tag color="gray">已关闭</Tag>
    };
    return statusMap[status] || status;
  };

  const getActionText = (action) => {
    const map = {
      'submit': '提交申请',
      'approve': '批准',
      'reject': '驳回',
      'rework': '退回修改',
      'pay': '赔付'
    };
    return map[action] || action;
  };

  const getActionColor = (action) => {
    const map = {
      'submit': 'blue',
      'approve': 'green',
      'reject': 'red',
      'rework': 'orange',
      'pay': 'cyan'
    };
    return map[action] || 'gray';
  };

  if (!claim) return <div>加载中...</div>;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/claims')}
        >
          返回列表
        </Button>
        {claim.status === 'pending_review' && (
          <>
            <Button 
              type="primary" 
              icon={<CheckCircleOutlined />}
              onClick={() => setApproveModalVisible(true)}
            >
              批准
            </Button>
            <Button 
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => setRejectModalVisible(true)}
            >
              驳回
            </Button>
          </>
        )}
        <Button 
          icon={<EditOutlined />}
          onClick={() => {
            form.setFieldsValue({ csEvidence: claim.csEvidence });
            setEvidenceModalVisible(true);
          }}
        >
          补充证据
        </Button>
      </Space>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="索赔基本信息">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="索赔单号">
                <strong>{claim.claimNo}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(claim.status)}
              </Descriptions.Item>
              <Descriptions.Item label="运单号">
                <a onClick={() => navigate(`/shipments/${claim.shipmentId}`)}>
                  {claim.shipment?.shipmentNo}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="客户">
                {claim.shipment?.customerName}
              </Descriptions.Item>
              <Descriptions.Item label="货物类型">
                {claim.shipment?.cargoType?.name}
              </Descriptions.Item>
              <Descriptions.Item label="货值">
                ¥{claim.shipment?.cargoValue?.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="索赔类型">
                {claim.claimType === 'overtemp' ? <Tag color="red">超温索赔</Tag> :
                 claim.claimType === 'damaged' ? <Tag color="orange">货损索赔</Tag> :
                 claim.claimType === 'lost' ? <Tag color="purple">丢失索赔</Tag> :
                 <Tag color="blue">其他</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="责任方">
                {claim.responsibleParty || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="责任节点">
                {claim.responsibleNode || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="超温时长">
                {claim.overtempDuration ? `${claim.overtempDuration}分钟` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="索赔金额" span={2}>
                <span style={{ fontSize: 18, fontWeight: 'bold', color: '#ff4d4f' }}>
                  ¥{claim.claimAmount?.toLocaleString()}
                </span>
              </Descriptions.Item>
              {claim.approvedAmount > 0 && (
                <Descriptions.Item label="批准金额" span={2}>
                  <span style={{ fontSize: 18, fontWeight: 'bold', color: '#52c41a' }}>
                    ¥{claim.approvedAmount?.toLocaleString()}
                  </span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="索赔原因" span={2}>
                {claim.claimReason}
              </Descriptions.Item>
              <Descriptions.Item label="超温摘要" span={2}>
                {claim.overtempSummary || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {(claim.isDuplicate || claim.isExemptClaim || claim.exceedsLimit) && (
            <Card title="风险标记" style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {claim.isDuplicate && (
                  <Alert
                    message="重复索赔"
                    description="该运单已存在其他索赔记录，请注意核实。"
                    type="error"
                    showIcon
                  />
                )}
                {claim.isExemptClaim && (
                  <Alert
                    message="签收免责"
                    description="该运单签收时已标记免责，请核实是否符合赔付条件。"
                    type="warning"
                    showIcon
                  />
                )}
                {claim.exceedsLimit && (
                  <Alert
                    message="金额超限"
                    description="索赔金额超过货值的赔偿限额，请核实。"
                    type="warning"
                    showIcon
                  />
                )}
              </Space>
            </Card>
          )}

          <Card title="客服补充证据" style={{ marginTop: 16 }}>
            {claim.csEvidence ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>{claim.csEvidence}</div>
            ) : (
              <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>
                暂无补充证据
                <br />
                <Button 
                  type="link" 
                  onClick={() => {
                    form.setFieldsValue({ csEvidence: '' });
                    setEvidenceModalVisible(true);
                  }}
                >
                  点击添加
                </Button>
              </div>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="金额信息">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Statistic
                title="索赔金额"
                value={claim.claimAmount}
                prefix="¥"
                precision={2}
                valueStyle={{ color: '#ff4d4f' }}
              />
              {claim.approvedAmount > 0 && (
                <Statistic
                  title="批准金额"
                  value={claim.approvedAmount}
                  prefix="¥"
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                />
              )}
              <div style={{ color: '#666' }}>
                <p>货值：¥{claim.shipment?.cargoValue?.toLocaleString()}</p>
                <p>赔偿限额：¥{(claim.shipment?.cargoValue * (claim.shipment?.cargoType?.claimMultiplier || 1)).toLocaleString()}</p>
              </div>
            </Space>
          </Card>

          <Card title="审批历史" style={{ marginTop: 16 }}>
            {claim.approvals && claim.approvals.length > 0 ? (
              <Timeline>
                {claim.approvals.map((approval, index) => (
                  <Timeline.Item
                    key={approval.id}
                    color={getActionColor(approval.action)}
                  >
                    <p><strong>{getActionText(approval.action)}</strong></p>
                    <p style={{ color: '#666' }}>
                      {approval.approverRole} - {approval.approverName}
                    </p>
                    {approval.decision && (
                      <p style={{ color: '#1890ff' }}>{approval.decision}</p>
                    )}
                    {approval.remarks && (
                      <p style={{ color: '#666' }}>备注：{approval.remarks}</p>
                    )}
                    <p style={{ color: '#999', fontSize: 12 }}>
                      {moment(approval.createdAt).format('YYYY-MM-DD HH:mm')}
                    </p>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <p style={{ textAlign: 'center', color: '#999' }}>暂无审批记录</p>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="批准索赔"
        open={approveModalVisible}
        onCancel={() => setApproveModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleApprove}
        >
          <Form.Item
            name="approvedAmount"
            label="批准金额(元)"
            initialValue={claim.claimAmount}
            rules={[{ required: true, message: '请输入批准金额' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item
            name="approverName"
            label="审批人"
            rules={[{ required: true, message: '请输入审批人姓名' }]}
          >
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          <Form.Item
            name="remarks"
            label="审批意见"
          >
            <TextArea rows={3} placeholder="请输入审批意见" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setApproveModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认批准</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="驳回索赔"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleReject}
        >
          <Form.Item
            name="approverName"
            label="审批人"
            rules={[{ required: true, message: '请输入审批人姓名' }]}
          >
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          <Form.Item
            name="remarks"
            label="驳回原因"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <TextArea rows={4} placeholder="请详细说明驳回原因" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setRejectModalVisible(false)}>取消</Button>
              <Button type="primary" danger htmlType="submit">确认驳回</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="补充证据"
        open={evidenceModalVisible}
        onCancel={() => setEvidenceModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveEvidence}
        >
          <Form.Item
            name="csEvidence"
            label="证据说明"
            rules={[{ required: true, message: '请输入证据说明' }]}
          >
            <TextArea 
              rows={6} 
              placeholder="请详细描述补充的证据内容，如：照片编号、视频文件、沟通记录等" 
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setEvidenceModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存证据</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ClaimDetail;
