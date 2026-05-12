import React, { useState, useEffect } from 'react';
import {
  Layout, Table, Button, Modal, Form, Input, Select, Space,
  Tag, Card, Row, Col, Checkbox, InputNumber, DatePicker,
  message, Tabs, Descriptions, Timeline, Typography
} from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import _ from 'lodash';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const STATUS_OPTIONS = [
  { value: 'pending', label: '待处理', color: 'default' },
  { value: 'documents_checking', label: '资料审核中', color: 'blue' },
  { value: 'supplement_requested', label: '需补件', color: 'orange' },
  { value: 'inspection', label: '查验中', color: 'purple' },
  { value: 'payment_pending', label: '待缴费', color: 'cyan' },
  { value: 'released', label: '已放行', color: 'green' },
  { value: 'closed', label: '已结案', color: 'gray' }
];

const DOCUMENT_TYPE_MAP = {
  contract: '合同',
  invoice: '发票',
  packing_list: '装箱单',
  bill_of_lading: '提单',
  certificate_of_origin: '原产地证',
  inspection_certificate: '商检证',
  customs_declaration: '报关单',
  power_of_attorney: '委托书',
  other: '其他资料'
};

const getStatusTag = (status) => {
  const option = STATUS_OPTIONS.find(o => o.value === status);
  return option ? <Tag color={option.color}>{option.label}</Tag> : status;
};

function App() {
  const [declarations, setDeclarations] = useState([]);
  const [filters, setFilters] = useState({ customers: [], ports: [] });
  const [selectedFilters, setSelectedFilters] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedDeclaration, setSelectedDeclaration] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    loadFilters();
  }, [selectedFilters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(selectedFilters).toString();
      const res = await fetch(`/api/declarations?${params}`);
      const data = await res.json();
      setDeclarations(data);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
    setLoading(false);
  };

  const loadFilters = async () => {
    try {
      const res = await fetch('/api/filters');
      const data = await res.json();
      setFilters(data);
    } catch (error) {
      console.error('加载筛选条件失败:', error);
    }
  };

  const loadDetail = async (id) => {
    try {
      const res = await fetch(`/api/declarations/${id}`);
      const data = await res.json();
      setDetailData(data);
    } catch (error) {
      console.error('加载详情失败:', error);
    }
  };

  const handleCreate = async (values) => {
    try {
      const res = await fetch('/api/declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleStatusChange = async (id, status, reason = '') => {
    try {
      const res = await fetch(`/api/declarations/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason, changed_by: '当前用户' })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      message.success('状态更新成功');
      loadData();
      if (detailData) {
        loadDetail(id);
      }
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleDocumentUpdate = async (declarationId, documentType, values) => {
    try {
      const res = await fetch(`/api/declarations/${declarationId}/documents/${documentType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      message.success('资料状态更新成功');
      loadDetail(declarationId);
    } catch (error) {
      message.error(error.message);
    }
  };

  const handlePaymentUpdate = async (declarationId, values) => {
    try {
      const res = await fetch(`/api/declarations/${declarationId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      message.success('缴费信息更新成功');
      loadData();
      loadDetail(declarationId);
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleInspectionUpdate = async (declarationId, values) => {
    try {
      const res = await fetch(`/api/declarations/${declarationId}/inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      message.success('查验信息更新成功');
      loadData();
      loadDetail(declarationId);
    } catch (error) {
      message.error(error.message);
    }
  };

  const columns = [
    { title: '提单号', dataIndex: 'bill_of_lading', key: 'bill_of_lading', width: 150 },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 150 },
    { title: '口岸', dataIndex: 'port', key: 'port', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getStatusTag(status)
    },
    {
      title: '下一步负责人',
      dataIndex: 'next_responsible',
      key: 'next_responsible',
      width: 120
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedDeclaration(record);
              loadDetail(record.id);
              setDetailVisible(true);
            }}
          >
            详情
          </Button>
          <Select
            placeholder="更新状态"
            style={{ width: 120 }}
            onChange={(value) => handleStatusChange(record.id, value)}
            value={undefined}
          >
            {STATUS_OPTIONS.map(opt => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Select>
        </Space>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', lineHeight: '64px', margin: 0 }}>
          🏭 口岸报关资料进度台
        </Title>
      </Header>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col span={6}>
              <Select
                placeholder="筛选客户"
                style={{ width: '100%' }}
                allowClear
                showSearch
                onChange={(value) => setSelectedFilters({ ...selectedFilters, customer_name: value })}
              >
                {filters.customers?.map(c => (
                  <Option key={c} value={c}>{c}</Option>
                ))}
              </Select>
            </Col>
            <Col span={6}>
              <Select
                placeholder="筛选口岸"
                style={{ width: '100%' }}
                allowClear
                showSearch
                onChange={(value) => setSelectedFilters({ ...selectedFilters, port: value })}
              >
                {filters.ports?.map(p => (
                  <Option key={p} value={p}>{p}</Option>
                ))}
              </Select>
            </Col>
            <Col span={6}>
              <Select
                placeholder="筛选状态"
                style={{ width: '100%' }}
                allowClear
                onChange={(value) => setSelectedFilters({ ...selectedFilters, status: value })}
              >
                {STATUS_OPTIONS.map(opt => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            </Col>
            <Col span={6} style={{ textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setModalVisible(true)}
              >
                新建委托
              </Button>
            </Col>
          </Row>
        </Card>

        <Table
          columns={columns}
          dataSource={declarations}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Content>

      <Modal
        title="新建报关委托"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="bill_of_lading"
            label="提单号"
            rules={[{ required: true, message: '请输入提单号' }]}
          >
            <Input placeholder="请输入提单号（不能重复）" />
          </Form.Item>
          <Form.Item
            name="customer_name"
            label="客户名称"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input placeholder="请输入客户名称" />
          </Form.Item>
          <Form.Item
            name="port"
            label="口岸"
            rules={[{ required: true, message: '请输入口岸' }]}
          >
            <Input placeholder="例如：上海港、深圳盐田港" />
          </Form.Item>
          <Form.Item name="next_responsible" label="下一步负责人">
            <Input placeholder="请输入下一步负责人" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {detailData && (
        <Modal
          title={`委托详情 - ${detailData.declaration.bill_of_lading}`}
          open={detailVisible}
          onCancel={() => setDetailVisible(false)}
          footer={null}
          width={1000}
        >
          <Tabs
            items={[
              {
                key: '1',
                label: '基本信息',
                children: (
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="提单号">{detailData.declaration.bill_of_lading}</Descriptions.Item>
                    <Descriptions.Item label="客户名称">{detailData.declaration.customer_name}</Descriptions.Item>
                    <Descriptions.Item label="口岸">{detailData.declaration.port}</Descriptions.Item>
                    <Descriptions.Item label="状态">{getStatusTag(detailData.declaration.status)}</Descriptions.Item>
                    <Descriptions.Item label="下一步负责人">{detailData.declaration.next_responsible || '-'}</Descriptions.Item>
                    <Descriptions.Item label="创建时间">{dayjs(detailData.declaration.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
                    <Descriptions.Item label="备注" span={2}>{detailData.declaration.notes || '-'}</Descriptions.Item>
                  </Descriptions>
                )
              },
              {
                key: '2',
                label: '资料管理',
                children: (
                  <Card title="资料清单" size="small">
                    {detailData.documents.map(doc => (
                      <Card
                        key={doc.document_type}
                        size="small"
                        style={{ marginBottom: 8 }}
                        title={
                          <Space>
                            <span>{DOCUMENT_TYPE_MAP[doc.document_type]}</span>
                            {doc.received && <Tag color="green">已收到 (v{doc.version})</Tag>}
                            {!doc.received && <Tag color="red">未收到</Tag>}
                          </Space>
                        }
                        extra={
                          <Space>
                            <Checkbox
                              checked={doc.received}
                              onChange={(e) => handleDocumentUpdate(
                                detailData.declaration.id,
                                doc.document_type,
                                { received: e.target.checked, missing_reason: doc.missing_reason }
                              )}
                            >
                              已收到
                            </Checkbox>
                          </Space>
                        }
                      >
                        <Input
                          placeholder="缺件原因（如未盖章、信息不符等）"
                          value={doc.missing_reason || ''}
                          onChange={(e) => {
                            if (e.target.value || doc.missing_reason) {
                              handleDocumentUpdate(
                                detailData.declaration.id,
                                doc.document_type,
                                { received: doc.received, missing_reason: e.target.value }
                              );
                            }
                          }}
                          onBlur={(e) => {
                            handleDocumentUpdate(
                              detailData.declaration.id,
                              doc.document_type,
                              { received: doc.received, missing_reason: e.target.value }
                            );
                          }}
                        />
                      </Card>
                    ))}
                  </Card>
                )
              },
              {
                key: '3',
                label: '缴费管理',
                children: (
                  <Card title="缴费信息" size="small">
                    <Form
                      layout="vertical"
                      initialValues={{
                        amount: detailData.payment?.amount,
                        paid: detailData.payment?.paid || false,
                        payment_method: detailData.payment?.payment_method,
                        notes: detailData.payment?.notes
                      }}
                      onFinish={(values) => handlePaymentUpdate(detailData.declaration.id, values)}
                    >
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="amount" label="金额">
                            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入金额" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="paid" label="缴费状态" valuePropName="checked">
                            <Checkbox>已缴费</Checkbox>
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="payment_method" label="缴费方式">
                        <Input placeholder="例如：银行转账、现金" />
                      </Form.Item>
                      <Form.Item name="notes" label="备注">
                        <TextArea rows={2} />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit">保存缴费信息</Button>
                      </Form.Item>
                    </Form>
                  </Card>
                )
              },
              {
                key: '4',
                label: '查验管理',
                children: (
                  <Card title="查验信息" size="small">
                    <Form
                      layout="vertical"
                      initialValues={{
                        inspection_type: detailData.inspection?.inspection_type,
                        result: detailData.inspection?.result,
                        returned: detailData.inspection?.returned || false,
                        returned_reason: detailData.inspection?.returned_reason,
                        inspector: detailData.inspection?.inspector,
                        inspection_date: detailData.inspection?.inspection_date ? dayjs(detailData.inspection.inspection_date) : null,
                        notes: detailData.inspection?.notes
                      }}
                      onFinish={(values) => handleInspectionUpdate(detailData.declaration.id, {
                        ...values,
                        inspection_date: values.inspection_date ? values.inspection_date.format('YYYY-MM-DD') : null
                      })}
                    >
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="inspection_type" label="查验类型">
                            <Select placeholder="请选择">
                              <Option value="customs">海关查验</Option>
                              <Option value="inspection">商检查验</Option>
                              <Option value="other">其他查验</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="result" label="查验结果">
                            <Select placeholder="请选择">
                              <Option value="pass">通过</Option>
                              <Option value="fail">未通过</Option>
                              <Option value="pending">待处理</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="returned" label="退回状态" valuePropName="checked">
                        <Checkbox>已退回（可关闭）</Checkbox>
                      </Form.Item>
                      <Form.Item name="returned_reason" label="退回原因">
                        <Input placeholder="请输入退回原因" />
                      </Form.Item>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="inspector" label="查验人">
                            <Input placeholder="请输入查验人姓名" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="inspection_date" label="查验日期">
                            <DatePicker style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="notes" label="备注">
                        <TextArea rows={2} />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit">保存查验信息</Button>
                      </Form.Item>
                    </Form>
                  </Card>
                )
              },
              {
                key: '5',
                label: '状态日志',
                children: (
                  <Card title="状态变更记录" size="small">
                    <Timeline>
                      {detailData.statusLogs.map(log => (
                        <Timeline.Item key={log.id}>
                          <Space>
                            <Text strong>{dayjs(log.created_at).format('YYYY-MM-DD HH:mm')}</Text>
                            {getStatusTag(log.status)}
                            {log.reason && <Text type="secondary">({log.reason})</Text>}
                          </Space>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </Card>
                )
              }
            ]}
          />
        </Modal>
      )}
    </Layout>
  );
}

export default App;
