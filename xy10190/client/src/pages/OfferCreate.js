import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Form, Input, Select, InputNumber, DatePicker, Transfer, Button, message, Space, Row, Col, Steps, Alert } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getCandidates, getApprovers, createOffer, getOffer } from '../services/api';

function OfferCreate() {
  const navigate = useNavigate();
  const { parentId } = useParams();
  const [form] = Form.useForm();
  const [candidates, setCandidates] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [targetKeys, setTargetKeys] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [parentOffer, setParentOffer] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [candidatesResp, approversResp] = await Promise.all([
        getCandidates(),
        getApprovers()
      ]);
      
      if (candidatesResp.success) {
        setCandidates(candidatesResp.candidates);
      }
      if (approversResp.success) {
        setApprovers(approversResp.approvers);
      }

      if (parentId) {
        const offerResp = await getOffer(parentId);
        if (offerResp.success && offerResp.offer) {
          setParentOffer(offerResp.offer);
          form.setFieldsValue({
            candidate_id: offerResp.offer.candidate_id,
            base_salary: Number(offerResp.offer.base_salary),
            bonus: Number(offerResp.offer.bonus),
            benefits: offerResp.offer.benefits,
            start_date: dayjs(offerResp.offer.start_date),
            probation_period: offerResp.offer.probation_period,
            work_location: offerResp.offer.work_location,
            change_reason: ''
          });
          const currentApprovers = offerResp.offer.approver_ids || [];
          setTargetKeys(currentApprovers);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (submitForApproval = false) => {
    try {
      const values = await form.validateFields();
      
      if (targetKeys.length === 0) {
        message.error('请至少选择一名审批人');
        return;
      }

      setSubmitting(true);

      const data = {
        ...values,
        start_date: values.start_date.format('YYYY-MM-DD'),
        approver_ids: targetKeys
      };

      if (parentId) {
        data.parent_offer_id = parentId;
      }

      const response = await createOffer(data);
      
      if (response.success) {
        if (submitForApproval) {
          message.success('Offer 已创建并提交审批');
        } else {
          message.success('Offer 已保存为草稿');
        }
        navigate(`/offers/${response.offer.id}`);
      }
    } catch (error) {
      if (error.errorFields) {
        message.error('请检查表单填写是否正确');
      }
      console.error('Failed to create offer:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const approverDataSource = approvers.map(a => ({
    key: a.id,
    title: `${a.name} - ${a.department}`,
    description: a.role
  }));

  const steps = [
    { title: '填写 Offer 信息' },
    { title: '选择审批人' },
    { title: '提交审批' }
  ];

  return (
    <div className="page-container">
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ marginBottom: 16 }}
          >
            返回
          </Button>
          <h2 style={{ margin: 0 }}>
            {parentOffer ? `新建 Offer 版本 (基于 v${parentOffer.version})` : '新建 Offer'}
          </h2>
        </div>

        {parentOffer && (
          <Alert
            message="基于已有 Offer 创建新版本"
            description="新版本将保留原 Offer 的基本信息，您可以修改薪资、入职日期等内容后重新走审批流程。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Steps current={0} items={steps} style={{ marginBottom: 32 }} />

        <Form
          form={form}
          layout="vertical"
          className="form-container"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="candidate_id"
                label="候选人"
                rules={[{ required: true, message: '请选择候选人' }]}
              >
                <Select
                  placeholder="选择候选人"
                  options={candidates.map(c => ({
                    value: c.id,
                    label: `${c.name} - ${c.position}`
                  }))}
                  disabled={!!parentOffer}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="start_date"
                label="入职日期"
                rules={[{ required: true, message: '请选择入职日期' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="base_salary"
                label="基本工资 (元/月)"
                rules={[
                  { required: true, message: '请输入基本工资' },
                  { type: 'number', min: 0, message: '薪资必须为正数' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入基本工资"
                  min={0}
                  step={100}
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\¥\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="bonus"
                label="年度奖金 (元)"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入年度奖金"
                  min={0}
                  step={1000}
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\¥\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="probation_period"
                label="试用期 (月)"
                initialValue={3}
              >
                <Select
                  options={[
                    { value: 1, label: '1 个月' },
                    { value: 2, label: '2 个月' },
                    { value: 3, label: '3 个月' },
                    { value: 6, label: '6 个月' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="work_location"
                label="工作地点"
              >
                <Input placeholder="请输入工作地点" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="benefits"
            label="其他福利"
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入其他福利信息，如五险一金、年假、股票等"
            />
          </Form.Item>

          {parentOffer && (
            <Form.Item
              name="change_reason"
              label="变更原因"
              rules={[{ required: true, message: '请填写变更原因' }]}
            >
              <Input.TextArea
                rows={2}
                placeholder="请说明创建新版本的原因，如薪资调整、入职时间变更等"
              />
            </Form.Item>
          )}

          <div className="card-title">审批流程</div>
          <Form.Item
            label="选择审批人（按顺序审批）"
            required
          >
            <Transfer
              dataSource={approverDataSource}
              titles={['可选审批人', '已选审批人']}
              targetKeys={targetKeys}
              onChange={setTargetKeys}
              render={item => ({
                label: item.title,
                value: item.key
              })}
              listStyle={{ width: 300, height: 200 }}
              showSearch
              searchPlaceholder="搜索审批人"
            />
            {targetKeys.length > 0 && (
              <div style={{ marginTop: 12, color: '#666' }}>
                审批顺序：
                {targetKeys.map((key, index) => {
                  const approver = approvers.find(a => a.id === key);
                  return (
                    <span key={key}>
                      {index > 0 && ' → '}
                      <strong>{approver?.name}</strong>
                    </span>
                  );
                })}
              </div>
            )}
          </Form.Item>

          <Form.Item style={{ marginTop: 32, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate(-1)}>
                取消
              </Button>
              <Button
                icon={<SaveOutlined />}
                loading={submitting}
                onClick={() => handleSave(false)}
              >
                保存草稿
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitting}
                onClick={() => handleSave(true)}
              >
                提交审批
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default OfferCreate;
