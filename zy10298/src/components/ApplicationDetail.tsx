import { useState } from 'react';
import {
  Drawer,
  Steps,
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Table,
  Form,
  Input,
  InputNumber,
  Radio,
  message,
  Alert,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import type { BoothApplication, MaterialItem } from '../types';
import { useBoothStore } from '../store/boothStore';

interface ApplicationDetailProps {
  application: BoothApplication | null;
  open: boolean;
  onClose: () => void;
}

const { Step } = Steps;
const { TextArea } = Input;

const ApplicationDetail = ({ application, open, onClose }: ApplicationDetailProps) => {
  const {
    approveApplication,
    rejectApplication,
    approveMaterial,
    rejectMaterial,
    approveElectricity,
    rejectElectricity,
    confirmDeposit,
    confirmSetup,
    completeTeardown,
    processDeduction,
    getStatusText,
    getStatusColor,
  } = useBoothStore();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState<'info' | 'material' | 'electricity' | 'deposit' | 'teardown'>('info');

  if (!application) return null;

  const steps = [
    { title: '申请审核', status: application.currentStep >= 1 ? 'finish' : 'wait' },
    { title: '材料审核', status: application.currentStep >= 2 ? 'finish' : 'wait' },
    { title: '电力审核', status: application.currentStep >= 3 ? 'finish' : 'wait' },
    { title: '押金缴纳', status: application.currentStep >= 4 ? 'finish' : 'wait' },
    { title: '搭建确认', status: application.currentStep >= 5 ? 'finish' : 'wait' },
    { title: '活动进行', status: application.currentStep >= 6 ? 'finish' : 'wait' },
    { title: '撤场验收', status: application.currentStep >= 7 ? 'finish' : 'wait' },
    { title: '完成', status: application.currentStep >= 9 ? 'finish' : 'wait' },
  ];

  const hasAnyIssue = application.hasScheduleConflict || 
    application.hasMaterialIssue || 
    application.hasElectricityIssue || 
    application.hasDepositIssue || 
    application.hasTeardownIssue;

  const handleApprove = () => {
    approveApplication(application.id);
    message.success('申请已通过');
  };

  const handleReject = () => {
    form.validateFields().then(values => {
      rejectApplication(application.id, values.rejectReason);
      message.success('申请已拒绝');
      form.resetFields();
    });
  };

  const handleApproveMaterial = (materialId: string) => {
    approveMaterial(application.id, materialId);
    message.success('材料已通过审核');
  };

  const handleRejectMaterial = (materialId: string) => {
    form.validateFields().then(values => {
      rejectMaterial(application.id, materialId, values.materialRejectReason);
      message.success('材料已拒绝');
      form.resetFields();
    });
  };

  const handleApproveElectricity = () => {
    form.validateFields().then(values => {
      approveElectricity(application.id, values.approvedPower);
      message.success('电力已通过审核');
      form.resetFields();
    });
  };

  const handleRejectElectricity = () => {
    form.validateFields().then(values => {
      rejectElectricity(application.id, values.electricityRejectReason);
      message.success('电力申请已拒绝');
      form.resetFields();
    });
  };

  const handleConfirmDeposit = () => {
    confirmDeposit(application.id);
    message.success('押金已确认');
  };

  const handleConfirmSetup = () => {
    confirmSetup(application.id);
    message.success('搭建已确认');
  };

  const handleTeardownPass = () => {
    completeTeardown(application.id, true);
    message.success('撤场验收通过');
  };

  const handleTeardownFail = () => {
    form.validateFields().then(values => {
      completeTeardown(application.id, false, values.damageDescription, values.repairCost);
      message.success('撤场验收未通过');
      form.resetFields();
    });
  };

  const handleProcessDeduction = () => {
    form.validateFields().then(values => {
      processDeduction(application.id, values.deductionAmount, values.deductionReason);
      message.success('扣款已处理，押金已退还');
      form.resetFields();
    });
  };

  const materialColumns = [
    { title: '材料名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '消防认证', dataIndex: 'fireCertified', key: 'fireCertified', render: (v: boolean) => v ? '是' : '否' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        if (status === 'approved') return <Tag color="green">已通过</Tag>;
        if (status === 'rejected') return <Tag color="red">已拒绝</Tag>;
        return <Tag color="orange">待审核</Tag>;
      },
    },
    {
      title: '审核备注',
      dataIndex: 'reviewRemark',
      key: 'reviewRemark',
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: MaterialItem) => {
        if (record.status !== 'pending') return null;
        return (
          <Space>
            <Button size="small" type="primary" onClick={() => handleApproveMaterial(record.id)}>
              通过
            </Button>
            <Button size="small" danger onClick={() => {
              setActiveTab('material');
              form.setFieldsValue({ currentMaterialId: record.id });
            }}>
              拒绝
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <Drawer
      title={
        <Space>
          <span>展位申请详情 - {application.applicationNo}</span>
          <Tag color={getStatusColor(application.status)}>{getStatusText(application.status)}</Tag>
          {hasAnyIssue && <Tag icon={<WarningOutlined />} color="error">存在异常</Tag>}
        </Space>
      }
      width={900}
      open={open}
      onClose={onClose}
      extra={
        <Button onClick={onClose}>关闭</Button>
      }
    >
      <Card style={{ marginBottom: 16 }}>
        <Steps current={application.currentStep - 1} items={steps} size="small" />
      </Card>

      {hasAnyIssue && (
        <Alert
          message="异常提醒"
          description={
            <Space direction="vertical">
              {application.hasScheduleConflict && <div><WarningOutlined style={{ color: '#f5222d' }} /> 档期与其他申请冲突</div>}
              {application.hasMaterialIssue && <div><WarningOutlined style={{ color: '#f5222d' }} /> 材料存在审核问题</div>}
              {application.hasElectricityIssue && <div><WarningOutlined style={{ color: '#f5222d' }} /> 电力申请存在问题</div>}
              {application.hasDepositIssue && <div><WarningOutlined style={{ color: '#f5222d' }} /> 押金退款待处理</div>}
              {application.hasTeardownIssue && <div><WarningOutlined style={{ color: '#f5222d' }} /> 撤场验收未通过</div>}
            </Space>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        tabList={[
          { key: 'info', tab: '基本信息' },
          { key: 'material', tab: '材料审核' },
          { key: 'electricity', tab: '电力申请' },
          { key: 'deposit', tab: '押金管理' },
          { key: 'teardown', tab: '撤场验收' },
        ]}
        activeTabKey={activeTab}
        onTabChange={(key) => setActiveTab(key as any)}
      >
        {activeTab === 'info' && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="申请编号">{application.applicationNo}</Descriptions.Item>
              <Descriptions.Item label="品牌名称">{application.brandName}</Descriptions.Item>
              <Descriptions.Item label="展位编号">{application.boothCode}</Descriptions.Item>
              <Descriptions.Item label="展位名称">{application.boothName}</Descriptions.Item>
              <Descriptions.Item label="展位位置">{application.boothLocation}</Descriptions.Item>
              <Descriptions.Item label="活动目的">{application.purpose}</Descriptions.Item>
              <Descriptions.Item label="活动开始日期">{application.startDate}</Descriptions.Item>
              <Descriptions.Item label="活动结束日期">{application.endDate}</Descriptions.Item>
              <Descriptions.Item label="预计搭建日期">{application.estimatedSetupDate}</Descriptions.Item>
              <Descriptions.Item label="预计撤场日期">{application.estimatedTeardownDate}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{application.createdAt}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{application.updatedAt}</Descriptions.Item>
            </Descriptions>

            {application.status === 'pending_approval' && (
              <div style={{ marginTop: 16 }}>
                <Divider>审核操作</Divider>
                <Form form={form} layout="vertical">
                  <Form.Item name="rejectReason" label="拒绝原因（如拒绝请填写）">
                    <TextArea rows={3} placeholder="请填写拒绝原因..." />
                  </Form.Item>
                  <Space>
                    <Button type="primary" onClick={handleApprove}>
                      <CheckCircleOutlined /> 通过申请
                    </Button>
                    <Button danger onClick={handleReject}>
                      <CloseCircleOutlined /> 拒绝申请
                    </Button>
                  </Space>
                </Form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'material' && (
          <div>
            <Table
              columns={materialColumns}
              dataSource={application.materials}
              rowKey="id"
              pagination={false}
              size="small"
            />
            
            {application.materials.some(m => m.status === 'pending') && (
              <div style={{ marginTop: 16 }}>
                <Divider>拒绝材料</Divider>
                <Form form={form} layout="vertical">
                  <Form.Item name="currentMaterialId" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name="materialRejectReason" label="拒绝原因">
                    <TextArea rows={3} placeholder="请填写拒绝原因..." />
                  </Form.Item>
                  <Button danger onClick={() => {
                    const currentMaterialId = form.getFieldValue('currentMaterialId');
                    if (currentMaterialId) {
                      handleRejectMaterial(currentMaterialId);
                    }
                  }}>
                    确认拒绝材料
                  </Button>
                </Form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'electricity' && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="申请电力">{application.electricity.appliedPower} kW</Descriptions.Item>
              <Descriptions.Item label="审核状态">
                {application.electricity.status === 'approved' && <Tag color="green">已通过</Tag>}
                {application.electricity.status === 'rejected' && <Tag color="red">已拒绝</Tag>}
                {application.electricity.status === 'exceeded' && <Tag color="red">超额</Tag>}
                {(application.electricity.status === 'pending' || application.electricity.status === 'exceeded') && <Tag color="orange">待审核</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="批准电力">{application.electricity.approvedPower ? `${application.electricity.approvedPower} kW` : '-'}</Descriptions.Item>
              <Descriptions.Item label="审核备注">{application.electricity.reviewRemark || '-'}</Descriptions.Item>
            </Descriptions>

            {(application.electricity.status === 'pending' || application.electricity.status === 'exceeded') && (
              <div style={{ marginTop: 16 }}>
                <Divider>电力审核</Divider>
                <Form form={form} layout="vertical">
                  <Form.Item name="approvedPower" label="批准电力 (kW)" rules={[{ required: true, message: '请输入批准电力' }]}>
                    <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入批准电力..." />
                  </Form.Item>
                  <Form.Item name="electricityRejectReason" label="拒绝原因（如拒绝请填写）">
                    <TextArea rows={3} placeholder="请填写拒绝原因..." />
                  </Form.Item>
                  <Space>
                    <Button type="primary" onClick={handleApproveElectricity}>
                      <CheckCircleOutlined /> 通过电力申请
                    </Button>
                    <Button danger onClick={handleRejectElectricity}>
                      <CloseCircleOutlined /> 拒绝电力申请
                    </Button>
                  </Space>
                </Form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'deposit' && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="押金金额">¥{application.deposit.amount.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {application.deposit.status === 'paid' && <Tag color="green">已缴纳</Tag>}
                {application.deposit.status === 'refunded' && <Tag color="green">已退还</Tag>}
                {application.deposit.status === 'refund_pending' && <Tag color="orange">待退款</Tag>}
                {application.deposit.status === 'unpaid' && <Tag color="orange">未缴纳</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="缴纳时间">{application.deposit.paidAt || '-'}</Descriptions.Item>
              <Descriptions.Item label="退还时间">{application.deposit.refundedAt || '-'}</Descriptions.Item>
              {application.deposit.deductionAmount && (
                <>
                  <Descriptions.Item label="扣款金额">¥{application.deposit.deductionAmount.toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="扣款原因">{application.deposit.deductionReason || '-'}</Descriptions.Item>
                </>
              )}
            </Descriptions>

            {application.deposit.status === 'unpaid' && (
              <div style={{ marginTop: 16 }}>
                <Button type="primary" onClick={handleConfirmDeposit}>
                  <DollarOutlined /> 确认押金已缴纳
                </Button>
              </div>
            )}

            {application.deposit.status === 'refund_pending' && application.teardown.status === 'failed' && (
              <div style={{ marginTop: 16 }}>
                <Divider>扣款处理</Divider>
                <Form form={form} layout="vertical">
                  <Form.Item 
                    name="deductionAmount" 
                    label="扣款金额 (¥)" 
                    rules={[{ required: true, message: '请输入扣款金额' }]}
                  >
                    <InputNumber min={0} max={application.deposit.amount} style={{ width: '100%' }} placeholder="请输入扣款金额..." />
                  </Form.Item>
                  <Form.Item name="deductionReason" label="扣款原因" rules={[{ required: true, message: '请输入扣款原因' }]}>
                    <TextArea rows={3} placeholder="请填写扣款原因，如：地面划痕修复费用..." />
                  </Form.Item>
                  <Button type="primary" onClick={handleProcessDeduction}>
                    处理扣款并退还剩余押金
                  </Button>
                </Form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'teardown' && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="验收状态">
                {application.teardown.status === 'passed' && <Tag color="green">已通过</Tag>}
                {application.teardown.status === 'failed' && <Tag color="red">未通过</Tag>}
                {application.teardown.status === 'inspecting' && <Tag color="blue">验收中</Tag>}
                {application.teardown.status === 'pending' && <Tag color="default">未开始</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="地面划痕">{application.teardown.groundScratches ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="损坏描述">{application.teardown.damageDescription || '-'}</Descriptions.Item>
              <Descriptions.Item label="修复费用">{application.teardown.repairCost ? `¥${application.teardown.repairCost.toLocaleString()}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="验收时间">{application.teardown.inspectedAt || '-'}</Descriptions.Item>
              <Descriptions.Item label="验收人">{application.teardown.inspector || '-'}</Descriptions.Item>
            </Descriptions>

            {application.status === 'teardown_pending' && application.teardown.status !== 'passed' && (
              <div style={{ marginTop: 16 }}>
                <Divider>撤场验收</Divider>
                <Form form={form} layout="vertical">
                  <Form.Item label="验收结果">
                    <Radio.Group>
                      <Radio value="pass">验收通过</Radio>
                      <Radio value="fail">验收未通过</Radio>
                    </Radio.Group>
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.验收结果 !== curr.验收结果}>
                    {() => {
                      const radioValue = form.getFieldValue('验收结果');
                      if (radioValue === 'fail') {
                        return (
                          <>
                            <Form.Item name="damageDescription" label="损坏描述" rules={[{ required: true, message: '请描述损坏情况' }]}>
                              <TextArea rows={3} placeholder="请描述损坏情况，如：展位角落有划痕..." />
                            </Form.Item>
                            <Form.Item name="repairCost" label="预估修复费用 (¥)" rules={[{ required: true, message: '请输入预估修复费用' }]}>
                              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入预估修复费用..." />
                            </Form.Item>
                          </>
                        );
                      }
                      return null;
                    }}
                  </Form.Item>
                  <Space>
                    <Button type="primary" onClick={handleTeardownPass}>
                      <CheckCircleOutlined /> 验收通过
                    </Button>
                    <Button danger onClick={handleTeardownFail}>
                      <CloseCircleOutlined /> 验收未通过
                    </Button>
                  </Space>
                </Form>
              </div>
            )}

            {application.status === 'setup_confirmed' && (
              <div style={{ marginTop: 16 }}>
                <Button type="primary" onClick={handleConfirmSetup}>
                  确认搭建完成，开始使用
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </Drawer>
  );
};

export default ApplicationDetail;
