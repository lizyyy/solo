import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Select,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  message,
  Divider,
  List,
  Alert,
  Spin
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  StopOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { sampleApi, approvalApi, complianceApi, maskingApi } from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

const statusColors = {
  pending: 'default',
  processing: 'processing',
  success: 'success',
  failed: 'error',
  needs_approval: 'warning',
  approved: 'success',
  rejected: 'error'
};

const statusLabels = {
  pending: '待处理',
  processing: '处理中',
  success: '成功',
  failed: '失败',
  needs_approval: '待审批',
  approved: '已审批',
  rejected: '已拒绝'
};

const fieldTypeLabels = {
  phone: '手机号',
  email: '邮箱',
  id_card: '身份证',
  name: '姓名',
  address: '地址',
  bank_card: '银行卡',
  general: '通用'
};

function SampleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sample, setSample] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [complianceRecords, setComplianceRecords] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [strategy, setStrategy] = useState('mask');
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sampleRes, approvalsRes, complianceRes, strategiesRes] = await Promise.all([
        sampleApi.getSample(id),
        approvalApi.getSampleApprovals(id),
        complianceApi.getSampleRecords(id),
        maskingApi.getStrategies()
      ]);
      setSample(sampleRes.data);
      setApprovals(approvalsRes.data);
      setComplianceRecords(complianceRes.data);
      setStrategies(strategiesRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleProcess = async () => {
    try {
      const config = { strategy };
      await sampleApi.processSample(id, config);
      message.success('处理成功');
      fetchData();
    } catch (error) {
      message.error('处理失败');
    }
  };

  const handleApproval = async (values) => {
    try {
      await approvalApi.processApproval(id, values);
      message.success('审批成功');
      setApprovalModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('审批失败');
    }
  };

  if (loading && !sample) {
    return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', padding: 50 }} />;
  }

  if (!sample) {
    return <div>数据不存在</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回列表
        </Button>
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="样例详情" extra={<Tag color={statusColors[sample.status]}>{statusLabels[sample.status]}</Tag>}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label="字段名称">{sample.field_name}</Descriptions.Item>
            <Descriptions.Item label="字段类型">{fieldTypeLabels[sample.field_type] || sample.field_type}</Descriptions.Item>
            <Descriptions.Item label="原始值" span={2}>
              <code style={{ background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>
                {sample.original_value}
              </code>
            </Descriptions.Item>
            <Descriptions.Item label="脱敏值" span={2}>
              <code style={{ background: '#e6f7ff', padding: '2px 8px', borderRadius: 4 }}>
                {sample.masked_value || '-'}
              </code>
            </Descriptions.Item>
            <Descriptions.Item label="是否脏数据">
              {sample.is_dirty ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="脱敏策略">{sample.strategy}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{new Date(sample.created_at).toLocaleString()}</Descriptions.Item>
            {sample.processed_at && (
              <Descriptions.Item label="处理时间">
                {new Date(sample.processed_at).toLocaleString()}
                {sample.processed_by && ` (处理人: ${sample.processed_by})`}
              </Descriptions.Item>
            )}
          </Descriptions>

          {sample.error_message && (
            <Alert
              message="错误详情"
              description={sample.error_message}
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>

        <Card title="操作区">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <h4 style={{ marginBottom: 8 }}>脱敏处理</h4>
              <Space>
                <Select
                  value={strategy}
                  onChange={setStrategy}
                  style={{ width: 200 }}
                >
                  {strategies.map(s => (
                    <Option key={s.id} value={s.id}>{s.name}</Option>
                  ))}
                </Select>
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleProcess}>
                  执行脱敏
                </Button>
              </Space>
            </div>

            {sample.status === 'needs_approval' && (
              <div>
                <h4 style={{ marginBottom: 8 }}>例外审批</h4>
                <Button type="primary" onClick={() => setApprovalModalVisible(true)}>
                  进行审批
                </Button>
              </div>
            )}
          </Space>
        </Card>

        {approvals.length > 0 && (
          <Card title="审批记录">
            <List
              dataSource={approvals}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    avatar={item.action === 'approve' ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} /> : <StopOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />}
                    title={
                      <Space>
                        <Tag color={item.action === 'approve' ? 'success' : 'error'}>
                          {item.action === 'approve' ? '通过' : '拒绝'}
                        </Tag>
                        <span>审批人：{item.approver}</span>
                        <span style={{ color: '#999' }}>{new Date(item.approved_at).toLocaleString()}</span>
                      </Space>
                    }
                    description={
                      <div>
                        <div><strong>原因：</strong>{item.reason}</div>
                        {item.comments && <div><strong>备注：</strong>{item.comments}</div>}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

        {complianceRecords.length > 0 && (
          <Card title="合规记录">
            <List
              dataSource={complianceRecords}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<FileTextOutlined style={{ color: '#1890ff', fontSize: 24 }} />}
                    title={
                      <Space>
                        <Tag color={statusColors[item.status]}>{statusLabels[item.status]}</Tag>
                        {item.has_watermark && <Tag color="blue">包含水印</Tag>}
                      </Space>
                    }
                    description={
                      <div>
                        <div><strong>原始值：</strong>{item.original_value}</div>
                        <div><strong>脱敏值：</strong>{item.masked_value}</div>
                        <div><strong>脱敏策略：</strong>{item.strategy}</div>
                        {item.approved_by && (
                          <div><strong>审批人：</strong>{item.approved_by} ({new Date(item.approved_at).toLocaleString()})</div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}
      </Space>

      <Modal
        title="例外审批"
        open={approvalModalVisible}
        onCancel={() => setApprovalModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleApproval}>
          <Form.Item
            label="审批动作"
            name="action"
            rules={[{ required: true, message: '请选择审批动作' }]}
          >
            <Select placeholder="请选择审批动作">
              <Option value="approve">通过</Option>
              <Option value="reject">拒绝</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="审批原因"
            name="reason"
            rules={[{ required: true, message: '请输入审批原因' }]}
          >
            <TextArea rows={3} placeholder="请输入审批原因" />
          </Form.Item>
          <Form.Item label="备注" name="comments">
            <TextArea rows={2} placeholder="请输入备注（可选）" />
          </Form.Item>
          <Form.Item name="approver" initialValue="当前用户" hidden>
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              提交审批
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default SampleDetail;
