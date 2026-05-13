import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Card, 
  Descriptions, 
  Tag, 
  Timeline, 
  List, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Space, 
  message, 
  Row, 
  Col,
  Divider
} from 'antd';
import { 
  ArrowLeftOutlined, 
  FileTextOutlined, 
  PaperClipOutlined, 
  UserOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

function ComplaintDetail({ complaintId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [complaint, setComplaint] = useState(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [evidenceModalVisible, setEvidenceModalVisible] = useState(false);
  const [appealModalVisible, setAppealModalVisible] = useState(false);
  const [statusForm] = Form.useForm();
  const [evidenceForm] = Form.useForm();
  const [appealForm] = Form.useForm();

  useEffect(() => {
    fetchComplaintDetail();
  }, [complaintId]);

  const fetchComplaintDetail = async () => {
    try {
      const response = await axios.get(`/api/complaints/${complaintId}`);
      if (response.data.success) {
        setComplaint(response.data.data);
      }
    } catch (error) {
      message.error('获取投诉详情失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: 'orange',
      reviewing: 'blue',
      takedown: 'red',
      rejected: 'gray',
      appealed: 'purple',
      reinstated: 'green',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status) => {
    const textMap = {
      pending: '待处理',
      reviewing: '审核中',
      takedown: '已下架',
      rejected: '已驳回',
      appealed: '已申诉',
      reinstated: '已恢复',
    };
    return textMap[status] || status;
  };

  const handleStatusChange = async (values) => {
    try {
      const response = await axios.put(`/api/complaints/${complaintId}/status`, values);
      if (response.data.success) {
        message.success('状态更新成功');
        setStatusModalVisible(false);
        statusForm.resetFields();
        fetchComplaintDetail();
      } else {
        message.error(response.data.error || '更新失败');
      }
    } catch (error) {
      message.error(error.response?.data?.error || '更新失败');
    }
  };

  const handleAddEvidence = async (values) => {
    try {
      const response = await axios.post(`/api/complaints/${complaintId}/evidences`, values);
      if (response.data.success) {
        message.success('证据添加成功');
        setEvidenceModalVisible(false);
        evidenceForm.resetFields();
        fetchComplaintDetail();
      } else {
        message.error(response.data.error || '添加失败');
      }
    } catch (error) {
      message.error(error.response?.data?.error || '添加失败');
    }
  };

  const handleCreateAppeal = async (values) => {
    try {
      const fullValues = {
        ...values,
        complaint_id: complaintId,
        creator_id: complaint.creator_id,
      };
      const response = await axios.post('/api/appeals', fullValues);
      if (response.data.success) {
        message.success('申诉提交成功');
        setAppealModalVisible(false);
        appealForm.resetFields();
        fetchComplaintDetail();
      } else {
        message.error(response.data.error || '提交失败');
      }
    } catch (error) {
      message.error(error.response?.data?.error || '提交失败');
    }
  };

  if (loading || !complaint) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
          返回列表
        </Button>
      </div>

      <Card title="投诉详情" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="内容标题" span={2}>
            {complaint.content_title}
          </Descriptions.Item>
          <Descriptions.Item label="创作者">{complaint.creator_name}</Descriptions.Item>
          <Descriptions.Item label="权利人">{complaint.holder_name}</Descriptions.Item>
          <Descriptions.Item label="投诉原因">{complaint.complaint_reason}</Descriptions.Item>
          <Descriptions.Item label="当前状态">
            <Tag color={getStatusColor(complaint.current_status)}>
              {getStatusText(complaint.current_status)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="处理人">{complaint.handler || '-'}</Descriptions.Item>
          <Descriptions.Item label="处理时间">
            {complaint.handled_at ? dayjs(complaint.handled_at).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(complaint.created_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="详细说明" span={2}>
            {complaint.complaint_details || '-'}
          </Descriptions.Item>
        </Descriptions>

        <div style={{ marginTop: 16 }}>
          <Space>
            <Button type="primary" onClick={() => setStatusModalVisible(true)}>
              变更状态
            </Button>
            <Button onClick={() => setEvidenceModalVisible(true)}>
              添加证据
            </Button>
            {complaint.current_status === 'takedown' && (
              <Button onClick={() => setAppealModalVisible(true)}>
                提交申诉
              </Button>
            )}
          </Space>
        </div>
      </Card>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card 
            title={
              <span>
                <PaperClipOutlined style={{ marginRight: 8 }} />
                投诉证据 ({complaint.evidences?.length || 0})
              </span>
            } 
            style={{ marginBottom: 16 }}
          >
            {complaint.evidences?.length > 0 ? (
              <List
                dataSource={complaint.evidences}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Tag>{item.evidence_type}</Tag>}
                      description={
                        <div>
                          <div>{item.description || '-'}</div>
                          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                            上传人: {item.uploaded_by || '-'} | 
                            时间: {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                暂无证据
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card 
            title={
              <span>
                <ClockCircleOutlined style={{ marginRight: 8 }} />
                状态历史
              </span>
            } 
            style={{ marginBottom: 16 }}
          >
            {complaint.statusHistory?.length > 0 ? (
              <Timeline>
                {complaint.statusHistory.map((item, index) => (
                  <Timeline.Item key={index} color={getStatusColor(item.status)}>
                    <div>
                      <Tag color={getStatusColor(item.status)}>
                        {getStatusText(item.status)}
                      </Tag>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        处理人: {item.handler || '系统'} | 
                        时间: {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                      </div>
                      {item.notes && (
                        <div style={{ marginTop: 4 }}>备注: {item.notes}</div>
                      )}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                暂无状态变更记录
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="变更投诉状态"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        footer={null}
      >
        <Form
          form={statusForm}
          layout="vertical"
          onFinish={handleStatusChange}
        >
          <Form.Item
            name="status"
            label="目标状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择要变更的状态">
              <Option value="reviewing">审核中</Option>
              <Option value="takedown">已下架</Option>
              <Option value="rejected">已驳回</Option>
              <Option value="reinstated">已恢复</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="handler"
            label="处理人"
            rules={[{ required: true, message: '请输入处理人' }]}
          >
            <Input placeholder="请输入处理人姓名" />
          </Form.Item>
          <Form.Item
            name="notes"
            label="处理备注"
          >
            <TextArea rows={3} placeholder="请输入处理备注" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
              <Button onClick={() => setStatusModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加投诉证据"
        open={evidenceModalVisible}
        onCancel={() => setEvidenceModalVisible(false)}
        footer={null}
      >
        <Form
          form={evidenceForm}
          layout="vertical"
          onFinish={handleAddEvidence}
        >
          <Form.Item
            name="evidence_type"
            label="证据类型"
            rules={[{ required: true, message: '请输入证据类型' }]}
          >
            <Input placeholder="如：对比图、版权证明、截图等" />
          </Form.Item>
          <Form.Item
            name="evidence_url"
            label="证据文件"
          >
            <Input placeholder="请输入文件URL（模拟）" />
          </Form.Item>
          <Form.Item
            name="description"
            label="证据描述"
          >
            <TextArea rows={3} placeholder="请简要描述该证据" />
          </Form.Item>
          <Form.Item
            name="uploaded_by"
            label="上传人"
            rules={[{ required: true, message: '请输入上传人' }]}
          >
            <Input placeholder="请输入上传人姓名" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => setEvidenceModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="提交创作者申诉"
        open={appealModalVisible}
        onCancel={() => setAppealModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={appealForm}
          layout="vertical"
          onFinish={handleCreateAppeal}
        >
          <Form.Item
            name="appeal_reason"
            label="申诉原因"
            rules={[{ required: true, message: '请输入申诉原因' }]}
          >
            <Input placeholder="如：合理使用、已获得授权等" />
          </Form.Item>
          <Form.Item
            name="appeal_details"
            label="申诉详情"
            rules={[{ required: true, message: '请输入申诉详情' }]}
          >
            <TextArea rows={4} placeholder="请详细说明申诉理由，包括具体情况、相关证明等" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交申诉
              </Button>
              <Button onClick={() => setAppealModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ComplaintDetail;
