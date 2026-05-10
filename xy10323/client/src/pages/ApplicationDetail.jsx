import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Typography,
  Timeline,
  Tabs,
  Divider,
  Row,
  Col,
  Statistic,
  Checkbox,
  Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WalletOutlined,
  AuditOutlined,
  CalendarOutlined,
  ClockOutlined,
  HistoryOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { applicationApi } from '../services/api.js';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const ApplicationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [refundCheck, setRefundCheck] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [problemModalVisible, setProblemModalVisible] = useState(false);
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [rectifyModalVisible, setRectifyModalVisible] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [refundCalculation, setRefundCalculation] = useState(null);
  
  const [inspectionForm] = Form.useForm();
  const [problemForm] = Form.useForm();
  const [feeForm] = Form.useForm();
  const [rectifyForm] = Form.useForm();
  const [refundForm] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [detailsRes, checkRes] = await Promise.all([
        applicationApi.getById(id),
        applicationApi.checkRefund(id)
      ]);
      setData(detailsRes.data);
      setRefundCheck(checkRes.data);
    } catch (error) {
      message.error('获取详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAddInspection = async (values) => {
    try {
      await applicationApi.addInspection(id, {
        ...values,
        inspection_date: values.inspection_date.format('YYYY-MM-DD')
      });
      message.success('巡检记录添加成功');
      setInspectionModalVisible(false);
      inspectionForm.resetFields();
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || '添加失败');
    }
  };

  const handleAddProblem = async (values) => {
    try {
      await applicationApi.addInspectionProblem(selectedInspection.id, {
        ...values,
        operator: '当前用户'
      });
      message.success('问题记录添加成功');
      setProblemModalVisible(false);
      problemForm.resetFields();
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || '添加失败');
    }
  };

  const handleRectify = async (values) => {
    try {
      await applicationApi.rectifyProblem(selectedProblem.id, {
        ...values,
        rectification_date: values.rectification_date.format('YYYY-MM-DD')
      });
      message.success('整改完成');
      setRectifyModalVisible(false);
      rectifyForm.resetFields();
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleAddFee = async (values) => {
    try {
      await applicationApi.addFee(id, {
        ...values,
        due_date: values.due_date?.format('YYYY-MM-DD') || null,
        operator: '当前用户'
      });
      message.success('欠费记录添加成功');
      setFeeModalVisible(false);
      feeForm.resetFields();
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || '添加失败');
    }
  };

  const handlePayFee = async (feeId) => {
    Modal.confirm({
      title: '确认结清欠费',
      content: '确定要标记此欠费为已结清吗？',
      onOk: async () => {
        try {
          await applicationApi.payFee(feeId, {
            paid_date: dayjs().format('YYYY-MM-DD'),
            operator: '当前用户'
          });
          message.success('欠费已结清');
          fetchData();
        } catch (error) {
          message.error('操作失败');
        }
      }
    });
  };

  const calculateRefund = async () => {
    const values = refundForm.getFieldsValue();
    try {
      const result = await applicationApi.calculateRefund(id, {
        deduction_items: values.deduction_items || [],
        offset_fees: values.offset_fees || false
      });
      setRefundCalculation(result.data);
    } catch (error) {
      message.error('计算失败');
    }
  };

  const handleCreateRefund = async (values) => {
    try {
      const deductionItems = [];
      if (values.deduction_items?.length > 0) {
        values.deduction_items.forEach(item => {
          if (item.item_type && item.description && item.amount > 0) {
            deductionItems.push(item);
          }
        });
      }

      await applicationApi.createRefund(id, {
        refund_date: values.refund_date.format('YYYY-MM-DD'),
        approver: values.approver,
        remarks: values.remarks,
        deduction_reason: values.deduction_reason,
        deduction_items: deductionItems,
        offset_fees: values.offset_fees || false
      });
      
      message.success('退款审批成功');
      setRefundModalVisible(false);
      refundForm.resetFields();
      setRefundCalculation(null);
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || '审批失败');
    }
  };

  if (!data) {
    return <div style={{ textAlign: 'center', padding: 50 }}>加载中...</div>;
  }

  const { application, inspections, problems, fees, refunds, timeline } = data;

  const inspectionColumns = [
    {
      title: '巡检日期',
      dataIndex: 'inspection_date',
      key: 'inspection_date',
      width: 120
    },
    {
      title: '巡检人',
      dataIndex: 'inspector',
      key: 'inspector',
      width: 100
    },
    {
      title: '整体状况',
      dataIndex: 'overall_condition',
      key: 'overall_condition'
    },
    {
      title: '问题数',
      key: 'problems',
      width: 100,
      render: (_, record) => (
        <Space>
          <Tag color={record.unrectified_count > 0 ? 'red' : 'default'}>
            待整改: {record.unrectified_count}
          </Tag>
          <Tag>总数: {record.problem_count}</Tag>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={() => {
            setSelectedInspection(record);
            setProblemModalVisible(true);
          }}
        >
          添加问题
        </Button>
      )
    }
  ];

  const problemColumns = [
    {
      title: '问题类型',
      dataIndex: 'problem_type',
      key: 'problem_type',
      width: 120
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      width: 100
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (s) => {
        const color = s === 'critical' ? 'red' : s === 'high' ? 'orange' : 'default';
        return <Tag color={color}>{s === 'critical' ? '严重' : s === 'high' ? '高' : '一般'}</Tag>;
      }
    },
    {
      title: '预估费用',
      dataIndex: 'estimated_cost',
      key: 'estimated_cost',
      width: 100,
      render: (v) => v > 0 ? `¥${v.toFixed(2)}` : '-'
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        record.is_rectified 
          ? <Tag color="green" icon={<CheckCircleOutlined />}>已整改</Tag>
          : <Tag color="orange" icon={<ClockCircleOutlined />}>待整改</Tag>
      )
    },
    {
      title: '整改日期',
      dataIndex: 'rectification_date',
      key: 'rectification_date',
      width: 110
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        !record.is_rectified && (
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            onClick={() => {
              setSelectedProblem(record);
              setRectifyModalVisible(true);
            }}
          >
            整改完成
          </Button>
        )
      )
    }
  ];

  const feeColumns = [
    {
      title: '费用类型',
      dataIndex: 'fee_type',
      key: 'fee_type',
      width: 180
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (v) => `¥${v.toFixed(2)}`
    },
    {
      title: '到期日期',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        record.is_paid
          ? <Tag color="green" icon={<CheckCircleOutlined />}>已结清</Tag>
          : <Tag color="red" icon={<ExclamationCircleOutlined />}>未结清</Tag>
      )
    },
    {
      title: '结清日期',
      dataIndex: 'paid_date',
      key: 'paid_date',
      width: 110
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        !record.is_paid && (
          <Button
            type="link"
            onClick={() => handlePayFee(record.id)}
          >
            标记结清
          </Button>
        )
      )
    }
  ];

  const refundColumns = [
    {
      title: '退款单号',
      dataIndex: 'refund_no',
      key: 'refund_no',
      width: 140
    },
    {
      title: '押金总额',
      dataIndex: 'total_deposit',
      key: 'total_deposit',
      width: 100,
      render: (v) => `¥${v.toFixed(2)}`
    },
    {
      title: '扣款金额',
      dataIndex: 'deduction_amount',
      key: 'deduction_amount',
      width: 100,
      render: (v) => v > 0 ? <span style={{ color: '#ff4d4f' }}>-¥{v.toFixed(2)}</span> : '-'
    },
    {
      title: '物业费抵扣',
      dataIndex: 'fee_offset_amount',
      key: 'fee_offset_amount',
      width: 110,
      render: (v) => v > 0 ? <span style={{ color: '#faad14' }}>-¥{v.toFixed(2)}</span> : '-'
    },
    {
      title: '实际退款',
      dataIndex: 'actual_refund',
      key: 'actual_refund',
      width: 100,
      render: (v) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>¥{v.toFixed(2)}</span>
    },
    {
      title: '退款日期',
      dataIndex: 'refund_date',
      key: 'refund_date',
      width: 110
    },
    {
      title: '审批人',
      dataIndex: 'approver',
      key: 'approver',
      width: 100
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        record.status === 'approved'
          ? <Tag color="green">已通过</Tag>
          : <Tag color="orange">待审批</Tag>
      )
    }
  ];

  const getRefundAlert = () => {
    if (!refundCheck) return null;
    
    if (!refundCheck.canRefund) {
      return (
        <Alert
          message="无法申请退款"
          description={refundCheck.reason}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      );
    }
    
    if (refundCheck.hasUnpaidFees) {
      return (
        <Alert
          message="存在未结清物业费"
          description={`该业主有 ${refundCheck.unpaidFeeCount} 笔未结清物业费，总计 ¥${refundCheck.unpaidFeeAmount?.toFixed(2)}。退款时可选择从押金中抵扣。`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      );
    }
    
    return (
      <Alert
        message="可以申请退款"
        description="所有条件均已满足，可以进行退款审批。"
        type="success"
        showIcon
        style={{ marginBottom: 16 }}
      />
    );
  };

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card
        title={<Title level={4} style={{ margin: 0 }}>申请详情 - {application.application_no}</Title>}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            <Button
              type="primary"
              icon={<AuditOutlined />}
              onClick={() => setRefundModalVisible(true)}
              disabled={!refundCheck?.canRefund || application.status === 'completed'}
            >
              退款审批
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={4} bordered>
          <Descriptions.Item label="申请编号">{application.application_no}</Descriptions.Item>
          <Descriptions.Item label="房间号">{application.room_no}</Descriptions.Item>
          <Descriptions.Item label="业主姓名">{application.owner_name}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{application.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="押金金额">
            <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#1890ff' }}>
              ¥{application.deposit_amount.toFixed(2)}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="申请日期">{application.application_date}</Descriptions.Item>
          <Descriptions.Item label="状态">
            {application.status === 'completed' 
              ? <Tag color="green">已完成退款</Tag> 
              : <Tag color="orange">待处理</Tag>
            }
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {application.created_at?.replace('T', ' ').substring(0, 19)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {getRefundAlert()}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="概览" key="overview">
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="巡检次数"
                  value={inspections.length}
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="待整改问题"
                  value={problems.filter(p => !p.is_rectified).length}
                  valueStyle={{ color: problems.filter(p => !p.is_rectified).length > 0 ? '#ff4d4f' : '#52c41a' }}
                  prefix={<ClockOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="未结清欠费"
                  value={fees.filter(f => !f.is_paid).length}
                  valueStyle={{ color: fees.filter(f => !f.is_paid).length > 0 ? '#ff4d4f' : '#52c41a' }}
                  prefix={<WalletOutlined />}
                  suffix={fees.filter(f => !f.is_paid).length > 0 
                    ? `(¥${fees.filter(f => !f.is_paid).reduce((sum, f) => sum + f.amount, 0).toFixed(2)})`
                    : ''
                  }
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已退款次数"
                  value={refunds.length}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="巡检记录" key="inspections">
          <Card
            title="巡检记录"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setInspectionModalVisible(true)}
              >
                新增巡检
              </Button>
            }
          >
            <Table
              columns={inspectionColumns}
              dataSource={inspections}
              rowKey="id"
              pagination={false}
            />
            
            <Divider />
            
            <Title level={5}>巡检问题</Title>
            <Table
              columns={problemColumns}
              dataSource={problems}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>

        <TabPane tab="物业费" key="fees">
          <Card
            title="物业费记录"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setFeeModalVisible(true)}
              >
                新增欠费
              </Button>
            }
          >
            <Table
              columns={feeColumns}
              dataSource={fees}
              rowKey="id"
              pagination={false}
              summary={(pageData) => {
                const unpaid = pageData.filter(f => !f.is_paid);
                const unpaidTotal = unpaid.reduce((sum, f) => sum + f.amount, 0);
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={1}>
                      <Text strong>合计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong style={{ color: '#ff4d4f' }}>
                        未结清: ¥{unpaidTotal.toFixed(2)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={4} />
                  </Table.Summary.Row>
                );
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="退款记录" key="refunds">
          <Card title="退款记录">
            <Table
              columns={refundColumns}
              dataSource={refunds}
              rowKey="id"
              pagination={false}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: '0 24px' }}>
                    <p><Text strong>扣款原因:</Text> {record.deduction_reason || '无'}</p>
                    <p><Text strong>备注:</Text> {record.remarks || '无'}</p>
                    {record.deduction_details && (
                      <p><Text strong>扣款明细:</Text> {record.deduction_details}</p>
                    )}
                  </div>
                )
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="操作时间线" key="timeline">
          <Card title="操作时间线">
            <Timeline>
              {timeline.map((item, index) => (
                <Timeline.Item
                  key={item.id}
                  color={
                    item.action_type.includes('审批') ? 'green' :
                    item.action_type.includes('问题') || item.action_type.includes('暂停') ? 'red' :
                    item.action_type.includes('整改') || item.action_type.includes('结清') ? 'blue' :
                    'gray'
                  }
                >
                  <p>
                    <Text strong>{item.action_type}</Text>
                    <Text type="secondary" style={{ marginLeft: 12 }}>
                      操作人: {item.operator}
                    </Text>
                  </p>
                  <p>{item.action_details}</p>
                  <p>
                    <Text type="secondary">
                      {item.created_at?.replace('T', ' ').substring(0, 19)}
                    </Text>
                  </p>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title="新增巡检记录"
        open={inspectionModalVisible}
        onCancel={() => {
          setInspectionModalVisible(false);
          inspectionForm.resetFields();
        }}
        onOk={() => inspectionForm.submit()}
        width={500}
      >
        <Form
          form={inspectionForm}
          layout="vertical"
          onFinish={handleAddInspection}
        >
          <Form.Item
            label="巡检日期"
            name="inspection_date"
            rules={[{ required: true, message: '请选择巡检日期' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="巡检人"
            name="inspector"
            rules={[{ required: true, message: '请输入巡检人' }]}
          >
            <Input placeholder="如：李巡检" />
          </Form.Item>
          <Form.Item
            label="整体状况描述"
            name="overall_condition"
          >
            <Input.TextArea rows={3} placeholder="整体装修状况描述..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加巡检问题"
        open={problemModalVisible}
        onCancel={() => {
          setProblemModalVisible(false);
          problemForm.resetFields();
        }}
        onOk={() => problemForm.submit()}
        width={500}
      >
        <Form
          form={problemForm}
          layout="vertical"
          onFinish={handleAddProblem}
        >
          <Form.Item
            label="问题类型"
            name="problem_type"
            rules={[{ required: true, message: '请选择问题类型' }]}
          >
            <Select placeholder="选择问题类型">
              <Option value="墙体破损">墙体破损</Option>
              <Option value="地面损坏">地面损坏</Option>
              <Option value="门窗损坏">门窗损坏</Option>
              <Option value="水电问题">水电问题</Option>
              <Option value="清洁问题">清洁问题</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="问题描述"
            name="description"
            rules={[{ required: true, message: '请输入问题描述' }]}
          >
            <Input.TextArea rows={3} placeholder="详细描述问题情况..." />
          </Form.Item>
          <Form.Item
            label="位置"
            name="location"
          >
            <Input placeholder="如：客厅、主卧等" />
          </Form.Item>
          <Form.Item
            label="严重程度"
            name="severity"
            rules={[{ required: true, message: '请选择严重程度' }]}
            initialValue="normal"
          >
            <Select>
              <Option value="normal">一般</Option>
              <Option value="high">高</Option>
              <Option value="critical">严重</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="预估修复费用"
            name="estimated_cost"
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              addonAfter="元"
              placeholder="预估修复费用"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="标记整改完成"
        open={rectifyModalVisible}
        onCancel={() => {
          setRectifyModalVisible(false);
          rectifyForm.resetFields();
        }}
        onOk={() => rectifyForm.submit()}
        width={400}
      >
        <Form
          form={rectifyForm}
          layout="vertical"
          onFinish={handleRectify}
        >
          <Form.Item
            label="整改日期"
            name="rectification_date"
            rules={[{ required: true, message: '请选择整改日期' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="整改人"
            name="rectifier"
            rules={[{ required: true, message: '请输入整改人' }]}
          >
            <Input placeholder="如：装修队、业主等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增物业费欠费"
        open={feeModalVisible}
        onCancel={() => {
          setFeeModalVisible(false);
          feeForm.resetFields();
        }}
        onOk={() => feeForm.submit()}
        width={500}
      >
        <Form
          form={feeForm}
          layout="vertical"
          onFinish={handleAddFee}
        >
          <Form.Item
            label="费用类型"
            name="fee_type"
            rules={[{ required: true, message: '请输入费用类型' }]}
          >
            <Input placeholder="如：2024年上半年物业费、水费等" />
          </Form.Item>
          <Form.Item
            label="金额"
            name="amount"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              addonAfter="元"
              placeholder="欠费金额"
            />
          </Form.Item>
          <Form.Item
            label="到期日期"
            name="due_date"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="退款审批"
        open={refundModalVisible}
        onCancel={() => {
          setRefundModalVisible(false);
          refundForm.resetFields();
          setRefundCalculation(null);
        }}
        onOk={() => refundForm.submit()}
        width={700}
        footer={[
          <Button key="back" onClick={() => {
            setRefundModalVisible(false);
            refundForm.resetFields();
            setRefundCalculation(null);
          }}>
            取消
          </Button>,
          <Button key="calc" onClick={calculateRefund}>
            扣款试算
          </Button>,
          <Button key="submit" type="primary" onClick={() => refundForm.submit()}>
            确认审批
          </Button>
        ]}
      >
        <Form
          form={refundForm}
          layout="vertical"
          onFinish={handleCreateRefund}
          initialValues={{
            refund_date: dayjs(),
            offset_fees: refundCheck?.hasUnpaidFees || false
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="退款日期"
                name="refund_date"
                rules={[{ required: true, message: '请选择退款日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="审批人"
                name="approver"
                rules={[{ required: true, message: '请输入审批人' }]}
              >
                <Input placeholder="如：王经理" />
              </Form.Item>
            </Col>
          </Row>

          {refundCheck?.hasUnpaidFees && (
            <Form.Item
              name="offset_fees"
              valuePropName="checked"
            >
              <Checkbox>
                从押金中抵扣未结清物业费（共 {refundCheck.unpaidFeeCount} 笔，¥{refundCheck.unpaidFeeAmount?.toFixed(2)}）
              </Checkbox>
            </Form.Item>
          )}

          <Divider orientation="left">扣款明细（可选）</Divider>
          
          <Form.List name="deduction_items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'item_type']}
                      rules={[{ required: true, message: '请选择' }]}
                      style={{ marginBottom: 0, width: 120 }}
                    >
                      <Select placeholder="类型">
                        <Option value="修复费用">修复费用</Option>
                        <Option value="清洁费用">清洁费用</Option>
                        <Option value="物品损坏">物品损坏</Option>
                        <Option value="其他扣款">其他扣款</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'description']}
                      rules={[{ required: true, message: '请输入描述' }]}
                      style={{ marginBottom: 0, width: 250 }}
                    >
                      <Input placeholder="扣款说明" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'amount']}
                      rules={[{ required: true, message: '请输入金额' }]}
                      style={{ marginBottom: 0, width: 130 }}
                    >
                      <InputNumber
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                        placeholder="金额"
                        addonAfter="元"
                      />
                    </Form.Item>
                    <Button type="text" danger onClick={() => remove(name)}>
                      删除
                    </Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加扣款项目
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item
            label="扣款原因说明"
            name="deduction_reason"
          >
            <Input.TextArea rows={2} placeholder="扣款原因汇总说明..." />
          </Form.Item>

          <Form.Item
            label="备注"
            name="remarks"
          >
            <Input.TextArea rows={2} placeholder="其他备注信息..." />
          </Form.Item>

          {refundCalculation && (
            <Card size="small" type="inner" title="扣款试算结果">
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="押金总额" value={refundCalculation.totalDeposit} precision={2} prefix="¥" />
                </Col>
                <Col span={6}>
                  <Statistic title="扣款金额" value={refundCalculation.totalDeduction} precision={2} prefix="-¥" valueStyle={{ color: '#ff4d4f' }} />
                </Col>
                <Col span={6}>
                  <Statistic title="物业费抵扣" value={refundCalculation.feeOffset} precision={2} prefix="-¥" valueStyle={{ color: '#faad14' }} />
                </Col>
                <Col span={6}>
                  <Statistic title="实际退款" value={refundCalculation.actualRefund} precision={2} prefix="¥" valueStyle={{ color: '#52c41a', fontWeight: 'bold' }} />
                </Col>
              </Row>
            </Card>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ApplicationDetail;
