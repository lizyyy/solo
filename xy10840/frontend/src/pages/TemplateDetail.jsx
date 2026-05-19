import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Tag,
  Descriptions,
  Tabs,
  Timeline,
  List,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  message,
  Row,
  Col,
  Statistic,
  Divider,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  RollbackOutlined,
  SendOutlined,
  ExportOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  CheckCircleOutlined,
  BugOutlined,
  BarChartOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { templateApi } from '../api';

const { TextArea } = Input;

const statusMap = {
  draft: { label: '草稿', color: 'default' },
  pending_approval: { label: '待审批', color: 'warning' },
  approved: { label: '已批准', color: 'processing' },
  gray: { label: '灰度中', color: 'blue' },
  published: { label: '已发布', color: 'success' },
  rejected: { label: '已驳回', color: 'error' },
};

function TemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState(null);
  const [versions, setVersions] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [grayRecords, setGrayRecords] = useState([]);
  const [effectRecords, setEffectRecords] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [grayModalVisible, setGrayModalVisible] = useState(false);
  const [effectModalVisible, setEffectModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [approvalForm] = Form.useForm();
  const [grayForm] = Form.useForm();
  const [effectForm] = Form.useForm();
  const [rejectForm] = Form.useForm();

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await templateApi.getTemplateDetail(id);
      setTemplate(res.data.template);
      setVersions(res.data.versions);
      setApprovals(res.data.approvals);
      setGrayRecords(res.data.gray_records);
      setEffectRecords(res.data.effect_records);
      setTimeline(res.data.timeline);
    } catch (error) {
      message.error('获取模板详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleSubmit = async () => {
    try {
      await templateApi.submitForApproval(id, { approver: '审批人' });
      message.success('提交审批成功');
      fetchDetail();
    } catch (error) {
      message.error(error.response?.data?.error || '提交失败');
    }
  };

  const handleApprove = async (values) => {
    try {
      await templateApi.approve(id, values);
      message.success('审批通过');
      setApprovalModalVisible(false);
      approvalForm.resetFields();
      fetchDetail();
    } catch (error) {
      message.error(error.response?.data?.error || '审批失败');
    }
  };

  const handleReject = async (values) => {
    try {
      await templateApi.reject(id, values);
      message.success('已驳回');
      setRejectModalVisible(false);
      rejectForm.resetFields();
      fetchDetail();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleStartGray = async (values) => {
    try {
      await templateApi.startGray(id, values);
      message.success('灰度发布已启动');
      setGrayModalVisible(false);
      grayForm.resetFields();
      fetchDetail();
    } catch (error) {
      message.error(error.response?.data?.error || '启动失败');
    }
  };

  const handleRollback = async () => {
    try {
      await templateApi.rollback(id, { reason: '效果不达标' });
      message.success('已回滚');
      fetchDetail();
    } catch (error) {
      message.error(error.response?.data?.error || '回滚失败');
    }
  };

  const handlePublish = async () => {
    try {
      await templateApi.publish(id);
      message.success('发布成功');
      fetchDetail();
    } catch (error) {
      message.error(error.response?.data?.error || '发布失败');
    }
  };

  const handleCreateVersion = async (values) => {
    try {
      const variables = values.variables ? values.variables.split(',').map(v => ({
        name: v.trim(),
        type: 'string',
        required: true,
      })) : [];

      await templateApi.createVersion(id, {
        ...values,
        variables,
        created_by: '当前用户',
      });
      message.success('创建新版本成功');
      setVersionModalVisible(false);
      form.resetFields();
      fetchDetail();
    } catch (error) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const handleAddEffect = async (values) => {
    try {
      await templateApi.addEffectRecord(id, values);
      message.success('添加效果记录成功');
      setEffectModalVisible(false);
      effectForm.resetFields();
      fetchDetail();
    } catch (error) {
      message.error(error.response?.data?.error || '添加失败');
    }
  };

  const handleExport = () => {
    templateApi.exportSingleTemplate(id);
    message.success('导出任务已开始');
  };

  const getTimelineIcon = (type) => {
    switch (type) {
      case 'version':
        return <FileTextOutlined style={{ color: '#1890ff' }} />;
      case 'approval':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'gray':
        return <CloudUploadOutlined style={{ color: '#1890ff' }} />;
      case 'effect':
        return <BarChartOutlined style={{ color: '#722ed1' }} />;
      default:
        return <ScheduleOutlined />;
    }
  };

  const getActionButtons = () => {
    if (!template) return null;
    const buttons = [];

    buttons.push(
      <Button key="new-version" icon={<EditOutlined />} onClick={() => setVersionModalVisible(true)}>
        新建版本
      </Button>
    );

    if (template.status === 'draft' || template.status === 'rejected') {
      buttons.push(
        <Button key="submit" type="primary" icon={<SendOutlined />} onClick={handleSubmit}>
          提交审批
        </Button>
      );
    }

    if (template.status === 'pending_approval') {
      buttons.push(
        <Button key="approve" type="primary" icon={<CheckOutlined />} onClick={() => setApprovalModalVisible(true)}>
          通过
        </Button>
      );
      buttons.push(
        <Button key="reject" danger icon={<CloseOutlined />} onClick={() => setRejectModalVisible(true)}>
          驳回
        </Button>
      );
    }

    if (template.status === 'approved') {
      buttons.push(
        <Button key="gray" type="primary" icon={<CloudUploadOutlined />} onClick={() => setGrayModalVisible(true)}>
          开始灰度
        </Button>
      );
    }

    if (template.status === 'gray') {
      buttons.push(
        <Button key="rollback" danger icon={<RollbackOutlined />} onClick={handleRollback}>
          灰度回滚
        </Button>
      );
      buttons.push(
        <Button key="publish" type="primary" icon={<CheckOutlined />} onClick={handlePublish}>
          正式发布
        </Button>
      );
      buttons.push(
        <Button key="add-effect" icon={<BarChartOutlined />} onClick={() => setEffectModalVisible(true)}>
          记录效果
        </Button>
      );
    }

    buttons.push(
      <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>
        导出报告
      </Button>
    );

    return buttons;
  };

  const tabItems = [
    {
      key: 'content',
      label: '提示词内容',
      children: (
        <div className="detail-tab-content">
          {versions.length > 0 && (
            <Card
              title={`当前版本 v${versions[0].version}`}
              className="version-card"
              extra={<Tag color="blue">最新版本</Tag>}
            >
              <Descriptions column={1}>
                <Descriptions.Item label="创建人">{versions[0].created_by}</Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {dayjs(versions[0].created_at).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="变更说明">{versions[0].changelog}</Descriptions.Item>
                <Descriptions.Item label="变量">
                  <Space wrap>
                    {versions[0].variables?.map((v, i) => (
                      <Tag key={i} color={v.required ? 'red' : 'default'}>
                        {v.name} ({v.type})
                      </Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
              <Divider>提示词内容</Divider>
              <div className="code-block">{versions[0].content}</div>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'versions',
      label: '版本历史',
      children: (
        <div className="detail-tab-content">
          <List
            dataSource={versions}
            renderItem={(v) => (
              <List.Item>
                <Card size="small" style={{ width: '100%' }}>
                  <Descriptions column={3} size="small">
                    <Descriptions.Item label="版本">v{v.version}</Descriptions.Item>
                    <Descriptions.Item label="创建人">{v.created_by}</Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {dayjs(v.created_at).format('YYYY-MM-DD HH:mm')}
                    </Descriptions.Item>
                    <Descriptions.Item label="变更说明" span={3}>{v.changelog}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      key: 'approvals',
      label: '审批记录',
      children: (
        <div className="detail-tab-content">
          <List
            dataSource={approvals}
            renderItem={(a) => (
              <List.Item>
                <Card size="small" style={{ width: '100%' }}>
                  <Descriptions column={3} size="small">
                    <Descriptions.Item label="版本">v{a.version}</Descriptions.Item>
                    <Descriptions.Item label="审批人">{a.approver}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'error' : 'warning'}>
                        {a.status === 'approved' ? '通过' : a.status === 'rejected' ? '驳回' : '待审批'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="审批时间" span={2}>
                      {a.approved_at ? dayjs(a.approved_at).format('YYYY-MM-DD HH:mm') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="意见" span={3}>{a.opinion || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      key: 'gray',
      label: '灰度记录',
      children: (
        <div className="detail-tab-content">
          <List
            dataSource={grayRecords}
            renderItem={(g) => (
              <List.Item>
                <Card size="small" style={{ width: '100%' }}>
                  <Descriptions column={3} size="small">
                    <Descriptions.Item label="版本">v{g.version}</Descriptions.Item>
                    <Descriptions.Item label="灰度流量">{g.traffic_percent}%</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={g.status === 'active' ? 'processing' : g.rolled_back ? 'error' : 'success'}>
                        {g.status === 'active' ? '进行中' : g.rolled_back ? '已回滚' : '已完成'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="开始时间">
                      {g.start_time ? dayjs(g.start_time).format('YYYY-MM-DD HH:mm') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="结束时间">
                      {g.end_time ? dayjs(g.end_time).format('YYYY-MM-DD HH:mm') : '-'}
                    </Descriptions.Item>
                    {g.rollback_reason && (
                      <Descriptions.Item label="回滚原因" span={3}>{g.rollback_reason}</Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      key: 'effect',
      label: '效果对比',
      children: (
        <div className="detail-tab-content">
          {effectRecords.length > 0 ? (
            <Row gutter={16}>
              {effectRecords.map((e, i) => (
                <Col key={i} span={8}>
                  <Card>
                    <Statistic
                      title={e.metric_name}
                      value={e.metric_value}
                      suffix={`/ ${e.baseline_value || '-'}`}
                      valueStyle={{
                        color: e.baseline_value && e.metric_value > e.baseline_value ? '#3f8600' : '#cf1322',
                      }}
                    />
                    <p style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                      样本量: {e.sample_size || '-'} | 记录时间: {dayjs(e.recorded_at).format('MM-DD HH:mm')}
                    </p>
                    {e.notes && <p style={{ marginTop: 8, fontSize: 12 }}>{e.notes}</p>}
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无效果记录
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'timeline',
      label: '时间线',
      children: (
        <div className="detail-tab-content" style={{ paddingLeft: 20 }}>
          <Timeline>
            {timeline.map((item, i) => (
              <Timeline.Item key={i} dot={getTimelineIcon(item.type)}>
                <p>
                  <strong>{item.message}</strong>
                  <Tag style={{ marginLeft: 8 }}>v{item.version}</Tag>
                </p>
                <p style={{ color: '#666', fontSize: 12 }}>
                  <UserOutlined style={{ marginRight: 4 }} />
                  {item.user || 'system'} | {dayjs(item.time).format('YYYY-MM-DD HH:mm')}
                </p>
                {item.changelog && <p>变更说明: {item.changelog}</p>}
                {item.opinion && <p>审批意见: {item.opinion}</p>}
              </Timeline.Item>
            ))}
          </Timeline>
        </div>
      ),
    },
  ];

  if (!template) {
    return <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginRight: 16 }}>
            返回
          </Button>
          <h2 style={{ margin: 0 }}>{template.name}</h2>
          <Tag color={statusMap[template.status]?.color} style={{ marginLeft: 16 }}>
            {statusMap[template.status]?.label}
          </Tag>
        </div>
        <Space>{getActionButtons()}</Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={4}>
          <Descriptions.Item label="模板ID">{template.template_id}</Descriptions.Item>
          <Descriptions.Item label="适用场景">
            <Tag color="blue">{template.scenario}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="当前版本">v{template.current_version}</Descriptions.Item>
          <Descriptions.Item label="创建人">{template.created_by}</Descriptions.Item>
          <Descriptions.Item label="创建时间" span={2}>
            {dayjs(template.created_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间" span={2}>
            {dayjs(template.updated_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={4}>{template.description}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="新建版本"
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateVersion}>
          <Form.Item
            name="content"
            label="提示词内容"
            rules={[{ required: true, message: '请输入提示词内容' }]}
          >
            <TextArea rows={8} placeholder="使用 {variable_name} 格式定义变量" />
          </Form.Item>
          <Form.Item name="variables" label="变量列表">
            <Input placeholder="用逗号分隔，例如: customer_question, order_info" />
          </Form.Item>
          <Form.Item name="changelog" label="变更说明" rules={[{ required: true, message: '请输入变更说明' }]}>
            <Input placeholder="例如: 优化回复语气" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="审批通过"
        open={approvalModalVisible}
        onCancel={() => setApprovalModalVisible(false)}
        onOk={() => approvalForm.submit()}
      >
        <Form form={approvalForm} layout="vertical" onFinish={handleApprove}>
          <Form.Item name="opinion" label="审批意见">
            <TextArea rows={4} placeholder="请输入审批意见" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="驳回审批"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        onOk={() => rejectForm.submit()}
      >
        <Form form={rejectForm} layout="vertical" onFinish={handleReject}>
          <Form.Item name="opinion" label="驳回原因" rules={[{ required: true, message: '请输入驳回原因' }]}>
            <TextArea rows={4} placeholder="请输入驳回原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="开始灰度发布"
        open={grayModalVisible}
        onCancel={() => setGrayModalVisible(false)}
        onOk={() => grayForm.submit()}
      >
        <Form form={grayForm} layout="vertical" onFinish={handleStartGray} initialValues={{ traffic_percent: 10 }}>
          <Form.Item
            name="traffic_percent"
            label="灰度流量百分比"
            rules={[{ required: true, message: '请输入灰度流量百分比' }]}
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
          <Form.Item name="created_by" label="操作人">
            <Input placeholder="请输入操作人姓名" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="记录效果数据"
        open={effectModalVisible}
        onCancel={() => setEffectModalVisible(false)}
        onOk={() => effectForm.submit()}
      >
        <Form form={effectForm} layout="vertical" onFinish={handleAddEffect}>
          <Form.Item name="metric_name" label="指标名称" rules={[{ required: true }]}>
            <Input placeholder="例如: 准确率" />
          </Form.Item>
          <Form.Item name="metric_value" label="当前值" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="baseline_value" label="基准值">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sample_size" label="样本量">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default TemplateDetail;
