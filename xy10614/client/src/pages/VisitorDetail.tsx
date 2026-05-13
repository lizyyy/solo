import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Descriptions, Button, Space, Card, Steps, Tag, message, Modal, Input, Form, Divider, Row, Col, Radio } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, CarOutlined, QrcodeOutlined, ExportOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { visitorAPI } from '../api';
import { VisitorRecord, VisitorStatus, TimelineEvent } from '../types';

function VisitorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [visitor, setVisitor] = useState<VisitorRecord | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hostConfirmModal, setHostConfirmModal] = useState(false);
  const [plateVerifyModal, setPlateVerifyModal] = useState(false);
  const [qrCodeModal, setQrCodeModal] = useState(false);
  const [manualReviewModal, setManualReviewModal] = useState(false);
  const [form] = Form.useForm();
  const [plateForm] = Form.useForm();
  const [qrForm] = Form.useForm();
  const [reviewForm] = Form.useForm();

  const fetchVisitor = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [visitorData, timelineData] = await Promise.all([
        visitorAPI.getById(id),
        visitorAPI.getTimeline(id),
      ]);
      setVisitor(visitorData);
      setTimeline(timelineData);
    } catch (error) {
      message.error('获取访客详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitor();
  }, [id]);

  const handleHostConfirm = async (values: any) => {
    try {
      await visitorAPI.hostConfirm(
        id!,
        values.confirmed,
        'host',
        '被访人',
        values.rejectReason
      );
      message.success(values.confirmed ? '确认成功' : '已拒绝');
      setHostConfirmModal(false);
      form.resetFields();
      fetchVisitor();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handlePlateVerify = async (values: any) => {
    try {
      await visitorAPI.verifyPlate(id!, values.plateNumber, 'security', '安保人员');
      message.success('车牌校验完成');
      setPlateVerifyModal(false);
      plateForm.resetFields();
      fetchVisitor();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleGenerateQRCode = async () => {
    try {
      const result = await visitorAPI.generateQRCode(id!, 'admin', '管理员');
      message.success(`二维码生成成功：${result.qrcode}`);
      fetchVisitor();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleScanQRCode = async (values: any) => {
    try {
      await visitorAPI.scanQRCode(id!, values.qrcode, 'security', '安保人员');
      message.success('二维码扫描成功');
      setQrCodeModal(false);
      qrForm.resetFields();
      fetchVisitor();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleCheckout = async () => {
    try {
      await visitorAPI.checkout(id!, 'manual', 'security', '安保人员');
      message.success('离园核销成功');
      fetchVisitor();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleManualReview = async (values: any) => {
    try {
      await visitorAPI.manualReview(
        id!,
        values.approved,
        'admin',
        '管理员',
        values.reason
      );
      message.success(values.approved ? '人工复核通过' : '人工复核拒绝');
      setManualReviewModal(false);
      reviewForm.resetFields();
      fetchVisitor();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const statusMap: Record<VisitorStatus, { text: string; color: string }> = {
    [VisitorStatus.PENDING_HOST_CONFIRM]: { text: '待被访人确认', color: 'orange' },
    [VisitorStatus.HOST_CONFIRMED]: { text: '被访人已确认', color: 'blue' },
    [VisitorStatus.HOST_REJECTED]: { text: '被访人拒绝', color: 'red' },
    [VisitorStatus.PLATE_ENTERED]: { text: '车牌已入园', color: 'green' },
    [VisitorStatus.PLATE_REJECTED]: { text: '车牌校验失败', color: 'red' },
    [VisitorStatus.QRCODE_SCANNED]: { text: '二维码已扫描', color: 'cyan' },
    [VisitorStatus.CHECKED_OUT]: { text: '已离园', color: 'purple' },
    [VisitorStatus.BLOCKED]: { text: '已拦截', color: 'red' },
    [VisitorStatus.MANUAL_REVIEW]: { text: '待人工复核', color: 'orange' },
    [VisitorStatus.COMPLETED]: { text: '已完成', color: 'green' },
  };

  if (!visitor) {
    return <div>加载中...</div>;
  }

  const { text: statusText, color: statusColor } = statusMap[visitor.status] || { text: visitor.status, color: 'default' };

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>

      <Card title="访客基本信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="访客姓名">{visitor.visitorName}</Descriptions.Item>
          <Descriptions.Item label="访客手机号">{visitor.visitorPhone}</Descriptions.Item>
          <Descriptions.Item label="身份证号">{visitor.visitorIdCard || '-'}</Descriptions.Item>
          <Descriptions.Item label="车牌号">{visitor.visitorPlate || '-'}</Descriptions.Item>
          <Descriptions.Item label="访客单位">{visitor.visitorCompany || '-'}</Descriptions.Item>
          <Descriptions.Item label="来访事由">{visitor.visitReason}</Descriptions.Item>
          <Descriptions.Item label="被访人">{visitor.hostName}</Descriptions.Item>
          <Descriptions.Item label="被访人手机号">{visitor.hostPhone}</Descriptions.Item>
          <Descriptions.Item label="被访部门">{visitor.hostDepartment}</Descriptions.Item>
          <Descriptions.Item label="预约日期">{visitor.expectedVisitDate}</Descriptions.Item>
          <Descriptions.Item label="预约时间">{visitor.expectedVisitTime}</Descriptions.Item>
          <Descriptions.Item label="当前状态">
            <Tag color={statusColor}>{statusText}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="操作面板" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            {visitor.status === VisitorStatus.PENDING_HOST_CONFIRM && (
              <Button type="primary" block onClick={() => setHostConfirmModal(true)}>
                <UserOutlined /> 被访人确认
              </Button>
            )}
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            {(visitor.status === VisitorStatus.HOST_CONFIRMED || visitor.status === VisitorStatus.MANUAL_REVIEW) && (
              <Button type="primary" block onClick={() => setPlateVerifyModal(true)}>
                <CarOutlined /> 车牌入园校验
              </Button>
            )}
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            {(visitor.status === VisitorStatus.HOST_CONFIRMED || visitor.status === VisitorStatus.MANUAL_REVIEW) && (
              <Button block onClick={handleGenerateQRCode}>
                <QrcodeOutlined /> 生成门禁二维码
              </Button>
            )}
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            {visitor.status === VisitorStatus.PLATE_ENTERED && (
              <Button type="primary" block onClick={() => setQrCodeModal(true)}>
                <QrcodeOutlined /> 扫描门禁二维码
              </Button>
            )}
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            {(visitor.status === VisitorStatus.QRCODE_SCANNED || visitor.status === VisitorStatus.MANUAL_REVIEW) && (
              <Button type="primary" block onClick={handleCheckout}>
                <ExportOutlined /> 离园核销
              </Button>
            )}
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            {visitor.status === VisitorStatus.MANUAL_REVIEW && (
              <Button type="primary" danger block onClick={() => setManualReviewModal(true)}>
                人工复核
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      <Card title="操作时间线">
        <Steps
          direction="vertical"
          items={timeline.map((event, index) => ({
            title: event.event,
            description: (
              <div>
                <div>{dayjs(event.time).format('YYYY-MM-DD HH:mm:ss')}</div>
                {event.operator && <div>操作人：{event.operator}</div>}
                {event.details && <div>详情：{event.details}</div>}
              </div>
            ),
            status: 'finish',
          }))}
        />
      </Card>

      <Modal
        title="被访人确认"
        open={hostConfirmModal}
        onCancel={() => setHostConfirmModal(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleHostConfirm}>
          <Form.Item
            label="确认结果"
            name="confirmed"
            rules={[{ required: true, message: '请选择确认结果' }]}
          >
            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item name="confirmed" noStyle>
                <Radio.Group>
                  <Radio value={true}>
                    <CheckOutlined style={{ color: '#52c41a' }} /> 确认同意
                  </Radio>
                  <Radio value={false}>
                    <CloseOutlined style={{ color: '#ff4d4f' }} /> 拒绝
                  </Radio>
                </Radio.Group>
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item
            label="拒绝原因"
            name="rejectReason"
          >
            <Input.TextArea placeholder="请输入拒绝原因（仅拒绝时填写）" rows={3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setHostConfirmModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="车牌入园校验"
        open={plateVerifyModal}
        onCancel={() => setPlateVerifyModal(false)}
        footer={null}
      >
        <Form form={plateForm} layout="vertical" onFinish={handlePlateVerify}>
          <Form.Item
            label="车牌号"
            name="plateNumber"
            rules={[{ required: true, message: '请输入车牌号' }]}
          >
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <div style={{ color: '#666', marginBottom: 16, fontSize: 12 }}>
            提示：如果车牌号与预约时不一致，将进入人工复核流程
          </div>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setPlateVerifyModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">校验</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="扫描门禁二维码"
        open={qrCodeModal}
        onCancel={() => setQrCodeModal(false)}
        footer={null}
      >
        <Form form={qrForm} layout="vertical" onFinish={handleScanQRCode}>
          <Form.Item
            label="二维码"
            name="qrcode"
            rules={[{ required: true, message: '请输入二维码' }]}
          >
            <Input placeholder="请输入二维码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setQrCodeModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">扫描</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="人工复核"
        open={manualReviewModal}
        onCancel={() => setManualReviewModal(false)}
        footer={null}
      >
        <Form form={reviewForm} layout="vertical" onFinish={handleManualReview}>
          <Form.Item
            label="复核结果"
            name="approved"
            rules={[{ required: true, message: '请选择复核结果' }]}
          >
            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item name="approved" noStyle>
                <Radio.Group>
                  <Radio value={true}>
                    <CheckOutlined style={{ color: '#52c41a' }} /> 通过
                  </Radio>
                  <Radio value={false}>
                    <CloseOutlined style={{ color: '#ff4d4f' }} /> 拒绝
                  </Radio>
                </Radio.Group>
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item
            label="原因说明"
            name="reason"
          >
            <Input.TextArea placeholder="请输入原因说明" rows={3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setManualReviewModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default VisitorDetail;
