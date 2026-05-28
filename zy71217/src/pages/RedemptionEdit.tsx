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
  Modal,
  Table,
  Tag,
  DatePicker,
  Collapse,
  Input as AntInput
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ShopOutlined,
  IdcardOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { detectAnomalies, generateProcessingConclusion } from '../services/validationService';
import { recalculateBalance } from '../services/balanceService';
import { Redemption, ConsumptionRecord, Identification, DisputeNote, ConsumptionType } from '../types';
import { generateId, formatDateTime, maskIdNumber } from '../utils/helpers';
import ProcessingConclusion from '../components/ProcessingConclusion';
import RuleExplanation from '../components/RuleExplanation';

const { Option } = Select;
const { TextArea } = AntInput;

const RedemptionEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isNew = id === 'new';

  const {
    getRedemptionById,
    getConsumptionRecordsByRedemptionId,
    getIdentificationById,
    getDisputeNotesByRedemptionId,
    addRedemption,
    updateRedemption,
    addIdentification,
    updateIdentification,
    addConsumptionRecord,
    updateConsumptionRecord,
    deleteConsumptionRecord,
    addDisputeNote,
    updateDisputeNote,
    addOperationLog,
    batches,
    redemptions,
    identifications,
    currentUser
  } = useAppStore();

  const [formData, setFormData] = useState<Partial<Redemption>>({});
  const [consumptionRecords, setConsumptionRecords] = useState<ConsumptionRecord[]>([]);
  const [identification, setIdentification] = useState<Identification | null>(null);
  const [disputeNotes, setDisputeNotes] = useState<DisputeNote[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [editingConsumption, setEditingConsumption] = useState<ConsumptionRecord | null>(null);
  const [editingDispute, setEditingDispute] = useState<DisputeNote | null>(null);
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [consumptionForm] = Form.useForm();
  const [disputeForm] = Form.useForm();

  const redemption = useMemo(() => {
    if (isNew) return null;
    return getRedemptionById(id || '');
  }, [id, isNew, getRedemptionById]);

  useEffect(() => {
    if (redemption) {
      form.setFieldsValue(redemption);
      setFormData(redemption);
      setConsumptionRecords(getConsumptionRecordsByRedemptionId(redemption.id));
      const ident = getIdentificationById(redemption.identityId);
      if (ident) setIdentification(ident);
      setDisputeNotes(getDisputeNotesByRedemptionId(redemption.id));
    }
  }, [redemption, form, getConsumptionRecordsByRedemptionId, getIdentificationById, getDisputeNotesByRedemptionId]);

  const validationResult = useMemo(() => {
    if (Object.keys(formData).length === 0) return null;
    const tempRedemption: Redemption = {
      id: id || 'temp',
      cardNumber: '',
      cardHolderName: '',
      phone: '',
      initialBalance: 0,
      currentBalance: 0,
      status: 'pending',
      identityId: identification?.id || '',
      hasDispute: false,
      isFrozen: false,
      createdAt: '',
      updatedAt: '',
      createdBy: '',
      ...redemption,
      ...formData
    };
    const allIdentifications = identification
      ? [...identifications.filter(i => i.id !== identification.id), identification]
      : identifications;
    return detectAnomalies(tempRedemption, redemptions, allIdentifications);
  }, [formData, redemptions, identifications, identification, id, redemption]);

  const processingConclusion = useMemo(() => {
    if (!validationResult) return null;
    return generateProcessingConclusion(validationResult);
  }, [validationResult]);

  const balanceCalc = useMemo(() => {
    if (!formData.initialBalance) return null;
    return recalculateBalance(formData.initialBalance, consumptionRecords);
  }, [formData.initialBalance, consumptionRecords]);

  const handleValuesChange = (_: unknown, allValues: Partial<Redemption>) => {
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

  const doSave = (values: Partial<Redemption>) => {
    const now = formatDateTime(new Date());

    if (isNew) {
      const newId = generateId();
      const identityId = generateId();

      const newRedemption: Redemption = {
        id: newId,
        cardNumber: '',
        cardHolderName: '',
        phone: '',
        initialBalance: 0,
        currentBalance: 0,
        status: 'pending',
        identityId,
        hasDispute: false,
        isFrozen: false,
        createdAt: now,
        updatedAt: now,
        createdBy: currentUser,
        ...values
      } as Redemption;

      addRedemption(newRedemption);

      if (identification) {
        addIdentification({
          ...identification,
          id: identityId
        });
      } else {
        addIdentification({
          id: identityId,
          idType: 'id_card',
          idNumber: '',
          verificationStatus: 'pending'
        });
      }

      consumptionRecords.forEach(record => {
        addConsumptionRecord({
          ...record,
          id: generateId(),
          redemptionId: newId
        });
      });

      disputeNotes.forEach(note => {
        addDisputeNote({
          ...note,
          id: generateId(),
          redemptionId: newId
        });
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

      if (identification) {
        updateIdentification(identification.id, identification);
      }

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

  const handleAddConsumption = () => {
    setEditingConsumption(null);
    consumptionForm.resetFields();
    setShowConsumptionModal(true);
  };

  const handleEditConsumption = (record: ConsumptionRecord) => {
    setEditingConsumption(record);
    consumptionForm.setFieldsValue({
      ...record,
      consumeTime: record.consumeTime ? new Date(record.consumeTime) : null
    });
    setShowConsumptionModal(true);
  };

  const handleDeleteConsumption = (recordId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条消费记录吗？',
      onOk: () => {
        setConsumptionRecords(prev => prev.filter(r => r.id !== recordId));
        if (!isNew) {
          deleteConsumptionRecord(recordId);
        }
        message.success('删除成功');
      }
    });
  };

  const handleSaveConsumption = () => {
    consumptionForm.validateFields().then(values => {
      const now = formatDateTime(new Date());
      if (editingConsumption) {
        const updated: ConsumptionRecord = {
          ...editingConsumption,
          ...values,
          consumeTime: values.consumeTime ? formatDateTime(values.consumeTime) : now
        };
        setConsumptionRecords(prev =>
          prev.map(r => r.id === editingConsumption.id ? updated : r)
        );
        if (!isNew) {
          updateConsumptionRecord(editingConsumption.id, updated);
        }
        message.success('更新成功');
      } else {
        const newRecord: ConsumptionRecord = {
          id: generateId(),
          redemptionId: id || '',
          consumeTime: values.consumeTime ? formatDateTime(values.consumeTime) : now,
          ...values
        };
        setConsumptionRecords(prev => [...prev, newRecord]);
        if (!isNew) {
          addConsumptionRecord(newRecord);
        }
        message.success('添加成功');
      }
      setShowConsumptionModal(false);
      consumptionForm.resetFields();
    });
  };

  const handleAddDispute = () => {
    setEditingDispute(null);
    disputeForm.resetFields();
    setShowDisputeModal(true);
  };

  const handleEditDispute = (note: DisputeNote) => {
    setEditingDispute(note);
    disputeForm.setFieldsValue(note);
    setShowDisputeModal(true);
  };

  const handleSaveDispute = () => {
    disputeForm.validateFields().then(values => {
      const now = formatDateTime(new Date());
      if (editingDispute) {
        const updated: DisputeNote = {
          ...editingDispute,
          ...values,
          handleTime: now
        };
        setDisputeNotes(prev =>
          prev.map(n => n.id === editingDispute.id ? updated : n)
        );
        if (!isNew) {
          updateDisputeNote(editingDispute.id, updated);
        }
        message.success('更新成功');
      } else {
        const newNote: DisputeNote = {
          id: generateId(),
          redemptionId: id || '',
          handleTime: now,
          handler: currentUser,
          status: 'open',
          ...values
        };
        setDisputeNotes(prev => [...prev, newNote]);
        if (!isNew) {
          addDisputeNote(newNote);
        }
        message.success('添加成功');
      }
      setShowDisputeModal(false);
      disputeForm.resetFields();
    });
  };

  const consumptionColumns = [
    {
      title: '时间',
      dataIndex: 'consumeTime',
      key: 'consumeTime',
      width: 180
    },
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: ConsumptionType) => {
        const colorMap: Record<ConsumptionType, string> = {
          consume: 'red',
          recharge: 'green',
          refund: 'orange'
        };
        const textMap: Record<ConsumptionType, string> = {
          consume: '消费',
          recharge: '充值',
          refund: '退款'
        };
        return <Tag color={colorMap[type]}>{textMap[type]}</Tag>;
      }
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (val: number, record: ConsumptionRecord) => (
        <span className={`font-mono ${record.type === 'consume' ? 'text-red-600' : 'text-green-600'}`}>
          {record.type === 'consume' ? '-' : '+'}¥{val.toFixed(2)}
        </span>
      )
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (val: string) => val || '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: ConsumptionRecord) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEditConsumption(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDeleteConsumption(record.id)}>删除</Button>
        </Space>
      )
    }
  ];

  const disputeColumns = [
    {
      title: '时间',
      dataIndex: 'handleTime',
      key: 'handleTime',
      width: 180
    },
    {
      title: '处理人',
      dataIndex: 'handler',
      key: 'handler',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          open: 'red',
          resolved: 'green',
          closed: 'default'
        };
        const textMap: Record<string, string> = {
          open: '待处理',
          resolved: '已解决',
          closed: '已关闭'
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      }
    },
    {
      title: '争议内容',
      dataIndex: 'content',
      key: 'content'
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: DisputeNote) => (
        <Button type="link" size="small" onClick={() => handleEditDispute(record)}>编辑</Button>
      )
    }
  ];

  const collapseItems = [
    {
      key: 'consumption',
      label: (
        <span className="flex items-center gap-2">
          <ShopOutlined />
          消费流水
          <Tag color="blue">{consumptionRecords.length} 条</Tag>
        </span>
      ),
      children: (
        <div className="space-y-4">
          {balanceCalc && (
            <Card size="small" className="bg-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">根据消费流水自动计算</div>
                  <div className="text-lg font-bold text-blue-700 mt-1">
                    计算余额：¥{balanceCalc.currentBalance.toFixed(2)}
                  </div>
                </div>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => form.setFieldsValue({ currentBalance: balanceCalc.currentBalance })}
                >
                  应用到当前余额
                </Button>
              </div>
              <div className="mt-2 text-xs text-gray-500 font-mono whitespace-pre-wrap">
                {balanceCalc.calculationProcess}
              </div>
            </Card>
          )}
          <div className="flex justify-end">
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddConsumption}
            >
              添加消费记录
            </Button>
          </div>
          <Table
            rowKey="id"
            columns={consumptionColumns}
            dataSource={consumptionRecords}
            pagination={false}
            size="small"
          />
        </div>
      )
    },
    {
      key: 'identification',
      label: (
        <span className="flex items-center gap-2">
          <IdcardOutlined />
          身份证明
        </span>
      ),
      children: identification ? (
        <div className="space-y-4">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="证件类型">
                <Select
                  value={identification.idType}
                  onChange={val => setIdentification({ ...identification, idType: val })}
                >
                  <Option value="id_card">身份证</Option>
                  <Option value="passport">护照</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="证件号码">
                <Input
                  value={identification.idNumber}
                  onChange={e => setIdentification({ ...identification, idNumber: e.target.value })}
                  placeholder="请输入证件号码"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="验证状态">
                <Select
                  value={identification.verificationStatus}
                  onChange={val => setIdentification({ ...identification, verificationStatus: val })}
                >
                  <Option value="pending">待验证</Option>
                  <Option value="verified">已验证</Option>
                  <Option value="rejected">验证失败</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <div className="pt-8">
                {identification.idNumber && (
                  <span className="text-sm text-gray-500">
                    脱敏显示：{maskIdNumber(identification.idNumber)}
                  </span>
                )}
              </div>
            </Col>
          </Row>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert
            message="未找到身份信息"
            description="点击下方按钮创建身份证明"
            type="info"
            showIcon
          />
          <Button
            type="primary"
            size="small"
            onClick={() => setIdentification({
              id: generateId(),
              idType: 'id_card',
              idNumber: '',
              verificationStatus: 'pending'
            })}
          >
            创建身份证明
          </Button>
        </div>
      )
    },
    {
      key: 'dispute',
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          争议备注
          {disputeNotes.length > 0 && <Tag color="red">{disputeNotes.length} 条</Tag>}
        </span>
      ),
      children: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddDispute}
              danger={!formData.hasDispute}
            >
              添加争议备注
            </Button>
          </div>
          {disputeNotes.length > 0 ? (
            <Table
              rowKey="id"
              columns={disputeColumns}
              dataSource={disputeNotes}
              pagination={false}
              size="small"
            />
          ) : (
            <Alert
              message="暂无争议记录"
              description={formData.hasDispute ? '已标记争议，建议添加争议备注说明' : '如果存在争议，请先标记争议状态并添加备注'}
              type="info"
              showIcon
            />
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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

      {processingConclusion && processingConclusion.status !== 'normal' && (
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

          <Collapse
            items={collapseItems}
            defaultActiveKey={['consumption', 'identification']}
            className="mb-6"
          />

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

      <Modal
        title={editingConsumption ? '编辑消费记录' : '添加消费记录'}
        open={showConsumptionModal}
        onOk={handleSaveConsumption}
        onCancel={() => setShowConsumptionModal(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={consumptionForm} layout="vertical">
          <Form.Item
            name="consumeTime"
            label="消费时间"
            rules={[{ required: true, message: '请选择消费时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="storeName"
            label="门店名称"
            rules={[{ required: true, message: '请输入门店名称' }]}
          >
            <Input placeholder="请输入门店名称" />
          </Form.Item>
          <Form.Item
            name="type"
            label="消费类型"
            rules={[{ required: true, message: '请选择消费类型' }]}
          >
            <Select>
              <Option value="consume">消费</Option>
              <Option value="recharge">充值</Option>
              <Option value="refund">退款</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="amount"
            label="金额（元）"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入金额" />
          </Form.Item>
          <Form.Item
            name="remark"
            label="备注"
          >
            <TextArea rows={3} placeholder="请输入备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingDispute ? '编辑争议备注' : '添加争议备注'}
        open={showDisputeModal}
        onOk={handleSaveDispute}
        onCancel={() => setShowDisputeModal(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={disputeForm} layout="vertical">
          <Form.Item
            name="content"
            label="争议内容"
            rules={[{ required: true, message: '请输入争议内容' }]}
          >
            <TextArea rows={4} placeholder="请详细描述争议内容" />
          </Form.Item>
          <Form.Item
            name="status"
            label="处理状态"
            rules={[{ required: true, message: '请选择处理状态' }]}
          >
            <Select>
              <Option value="open">待处理</Option>
              <Option value="resolved">已解决</Option>
              <Option value="closed">已关闭</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RedemptionEdit;
