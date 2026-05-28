import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  Row,
  Col,
  message,
  Divider,
  Switch,
  Alert,
  Modal
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { detectAnomalies, generateProcessingConclusion } from '../services/validationService';
import { Redemption, RedemptionStatus } from '../types';
import { generateId, formatDateTime } from '../utils/helpers';
import ProcessingConclusion from '../components/ProcessingConclusion';
import RuleExplanation from '../components/RuleExplanation';

const { Option } = Select;

const RedemptionEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isNew = id === 'new';

  const {
    getRedemptionById,
    addRedemption,
    updateRedemption,
    addIdentification,
    addOperationLog,
    batches,
    redemptions,
    currentUser
  } = useAppStore();

  const [formData, setFormData] = useState<any>({});
  const [showRules, setShowRules] = useState(false);

  const redemption = useMemo(() => {
    if (isNew) return null;
    return getRedemptionById(id || '');
  }, [id, isNew, getRedemptionById]);

  useEffect(() => {
    if (redemption) {
      form.setFieldsValue(redemption);
      setFormData(redemption);
    }
  }, [redemption, form]);

  const validationResult = useMemo(() => {
    if (Object.keys(formData).length === 0) return null;
    const tempRedemption: Redemption = {
      ...redemption,
      ...formData,
      id: id || 'temp'
    } as Redemption;
    return detectAnomalies(tempRedemption, redemptions);
  }, [formData, redemptions, id, redemption]);

  const processingConclusion = useMemo(() => {
    if (!validationResult) return null;
    return generateProcessingConclusion(validationResult);
  }, [validationResult]);

  const handleValuesChange = (_: any, allValues: any) => {
    setFormData(allValues);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (validationResult && validationResult.errors.length > 0) {
        Modal.confirm({
          title: '存在异常问题',
          content: '当前数据存在异常问题，确定要保存吗？建议先处理异常后再保存。',
          okText: '继续保存',
          okType: 'danger',
          cancelText: '返回修改',
          onOk: () => {
            doSave(values);
          }
        });
      } else {
        doSave(values);
      }
    } catch (error) {
      message.error('请检查表单填写是否正确');
    }
  };

  const doSave = (values: any) => {
    const now = formatDateTime(new Date());

    if (isNew) {
      const newId = generateId();
      const identityId = generateId();

      const newRedemption: Redemption = {
        ...values,
        id: newId,
        identityId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        createdBy: currentUser
      };

      addRedemption(newRedemption);
      addIdentification({
        id: identityId,
        idType: 'id_card',
        idNumber: '',
        verificationStatus: 'pending'
      });
      addOperationLog({
        id: generateId(),
        redemptionId: newId,
        operationType: 'create',
        operator: currentUser,
        operateTime: now,
        beforeData: '{}',
        afterData: JSON.stringify(newRedemption),
        remark: '新建兑付登记'
      });

      message.success('创建成功');
      navigate(`/redemption/${newId}`);
    } else {
      const beforeData = JSON.stringify(redemption);
      updateRedemption(id!, values);
      addOperationLog({
        id: generateId(),
        redemptionId: id!,
        operationType: 'update',
        operator: currentUser,
        operateTime: now,
        beforeData,
        afterData: JSON.stringify({ ...redemption, ...values }),
        remark: '更新兑付信息'
      });

      message.success('保存成功');
      navigate(`/redemption/${id}`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(isNew ? '/' : `/redemption/${id}`)}
        >
          {isNew ? '返回列表' : '返回详情'}
        </Button>
        <Button
          type="link"
          icon={<InfoCircleOutlined />}
          onClick={() => setShowRules(!showRules)}
        >
          {showRules ? '隐藏规则说明' : '查看规则说明'}
        </Button>
      </div>

      {showRules && (
        <Card title="业务规则说明" size="small">
          <RuleExplanation />
        </Card>
      )}

      {processingConclusion && (processingConclusion.status !== 'normal') && (
        <ProcessingConclusion conclusion={processingConclusion} />
      )}

      <Card title={
        <span style={{ fontFamily: 'Noto Serif SC, serif' }}>
          {isNew ? '新增兑付登记' : '编辑兑付登记'}
        </span>
      }>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={handleValuesChange}
          initialValues={{
            hasDispute: false,
            isFrozen: false,
            status: 'pending'
          }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="cardNumber"
                label="会员卡号"
                rules={[{ required: true, message: '请输入会员卡号' }]}
                validateStatus={validationResult?.errors.some(e => e.code === 'DUPLICATE_REGISTRATION') ? 'error' : ''}
                help={validationResult?.errors.find(e => e.code === 'DUPLICATE_REGISTRATION')?.message}
              >
                <Input placeholder="请输入会员卡号" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cardHolderName"
                label="持卡人姓名"
                rules={[{ required: true, message: '请输入持卡人姓名' }]}
              >
                <Input placeholder="请输入持卡人姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="联系电话"
                rules={[{ required: true, message: '请输入联系电话' }]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select>
                  <Option value="pending">待处理</Option>
                  <Option value="processing">处理中</Option>
                  <Option value="completed">已完成</Option>
                  <Option value="frozen">已冻结</Option>
                  <Option value="disputed">有争议</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="initialBalance"
                label="初始余额（元）"
                rules={[{ required: true, message: '请输入初始余额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入初始余额"
                  precision={2}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="currentBalance"
                label="当前余额（元）"
                rules={[{ required: true, message: '请输入当前余额' }]}
                validateStatus={validationResult?.errors.some(e => e.code === 'NEGATIVE_BALANCE') ? 'error' : ''}
                help={validationResult?.errors.find(e => e.code === 'NEGATIVE_BALANCE')?.message}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入当前余额"
                  precision={2}
                  className={validationResult?.errors.some(e => e.code === 'NEGATIVE_BALANCE') ? 'border-red-500' : ''}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="batchId"
                label="所属批次"
              >
                <Select allowClear placeholder="请选择批次">
                  {batches.map(b => (
                    <Option key={b.id} value={b.id}>{b.batchNo} - {b.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="hasDispute"
                label="标记争议"
                valuePropName="checked"
              >
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isFrozen"
                label="冻结兑付"
                valuePropName="checked"
                validateStatus={validationResult?.warnings.some(w => w.code === 'DISPUTE_NOT_FROZEN') ? 'warning' : ''}
                help={validationResult?.warnings.find(w => w.code === 'DISPUTE_NOT_FROZEN')?.message}
              >
                <Switch checkedChildren="已冻结" unCheckedChildren="正常" />
              </Form.Item>
            </Col>
          </Row>

          {formData.hasDispute && !formData.isFrozen && (
            <Alert
              message="建议冻结"
              description="存在争议的兑付记录建议先冻结，待争议解决后再继续处理"
              type="warning"
              showIcon
              className="mb-4"
            />
          )}

          <Divider />

          <div className="flex justify-end">
            <Space size="large">
              <Button onClick={() => navigate(isNew ? '/' : `/redemption/${id}`)}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                size="large"
              >
                保存
              </Button>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default RedemptionEdit;
