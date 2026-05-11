import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Select,
  DatePicker,
  Popconfirm,
  message,
  Typography,
  Tabs,
  Row,
  Col,
  Divider,
  Alert,
  Tooltip,
  List
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  EyeOutlined,
  CopyOutlined,
  WarningOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [voidModalVisible, setVoidModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [versionForm] = Form.useForm();
  const [confirmForm] = Form.useForm();
  const [voidForm] = Form.useForm();
  const [quotationItems, setQuotationItems] = useState([]);
  const [scopeChanges, setScopeChanges] = useState([]);

  const loadProject = () => {
    setLoading(true);
    api.get(`/projects/${id}`)
      .then(res => {
        setProject(res.data);
      })
      .catch(error => {
        message.error('加载项目失败');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadVersionDetail = (versionId) => {
    api.get(`/proposals/versions/${versionId}`)
      .then(res => {
        setSelectedVersion(res.data);
        if (res.data.quotation_items) {
          setQuotationItems(res.data.quotation_items);
        } else {
          setQuotationItems([]);
        }
        if (res.data.scope_changes) {
          setScopeChanges(res.data.scope_changes);
        } else {
          setScopeChanges([]);
        }
        setViewMode(true);
      })
      .catch(error => {
        message.error('加载版本详情失败');
      });
  };

  const handleCreateVersion = (values) => {
    const totalAmount = quotationItems.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) * parseFloat(item.unit_price));
    }, 0);

    const data = {
      ...values,
      project_id: id,
      quotation_items: quotationItems,
      scope_changes: scopeChanges
    };

    api.post('/proposals/versions', data)
      .then(() => {
        message.success('创建版本成功');
        setVersionModalVisible(false);
        versionForm.resetFields();
        setQuotationItems([]);
        setScopeChanges([]);
        loadProject();
      })
      .catch(error => {
        message.error(error.response?.data?.error || '创建失败');
      });
  };

  const handleUpdateVersion = (values) => {
    const totalAmount = quotationItems.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) * parseFloat(item.unit_price));
    }, 0);

    const data = {
      ...values,
      quotation_items: quotationItems,
      scope_changes: scopeChanges
    };

    api.put(`/proposals/versions/${selectedVersion.id}`, data)
      .then(() => {
        message.success('更新版本成功');
        setVersionModalVisible(false);
        setSelectedVersion(null);
        setViewMode(false);
        loadProject();
      })
      .catch(error => {
        message.error(error.response?.data?.error || '更新失败');
      });
  };

  const handleConfirmVersion = (values) => {
    api.post(`/proposals/versions/${selectedVersion.id}/confirm`, values)
      .then(() => {
        message.success('版本确认成功');
        setConfirmModalVisible(false);
        confirmForm.resetFields();
        setSelectedVersion(null);
        setViewMode(false);
        loadProject();
      })
      .catch(error => {
        message.error(error.response?.data?.error || '确认失败');
      });
  };

  const handleVoidVersion = (values) => {
    api.post(`/proposals/versions/${selectedVersion.id}/void`, values)
      .then(() => {
        message.success('版本作废成功');
        setVoidModalVisible(false);
        voidForm.resetFields();
        setSelectedVersion(null);
        setViewMode(false);
        loadProject();
      })
      .catch(error => {
        message.error(error.response?.data?.error || '作废失败');
      });
  };

  const addQuotationItem = () => {
    setQuotationItems([
      ...quotationItems,
      { id: Date.now(), category: '', item_name: '', description: '', quantity: 1, unit: '项', unit_price: 0, amount: 0 }
    ]);
  };

  const updateQuotationItem = (index, field, value) => {
    const newItems = [...quotationItems];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].amount = parseFloat(newItems[index].quantity) * parseFloat(newItems[index].unit_price);
    }
    setQuotationItems(newItems);
  };

  const removeQuotationItem = (index) => {
    const newItems = [...quotationItems];
    newItems.splice(index, 1);
    setQuotationItems(newItems);
  };

  const addScopeChange = () => {
    setScopeChanges([
      ...scopeChanges,
      { id: Date.now(), change_type: '新增', change_content: '', change_reason: '' }
    ]);
  };

  const updateScopeChange = (index, field, value) => {
    const newChanges = [...scopeChanges];
    newChanges[index] = { ...newChanges[index], [field]: value };
    setScopeChanges(newChanges);
  };

  const removeScopeChange = (index) => {
    const newChanges = [...scopeChanges];
    newChanges.splice(index, 1);
    setScopeChanges(newChanges);
  };

  const getStatusTag = (version) => {
    if (version.is_voided) {
      return <Tag color="red" icon={<CloseCircleOutlined />}>已作废</Tag>;
    }
    if (version.is_confirmed) {
      return (
        <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontWeight: 'bold', padding: '4px 12px' }}>
          ⭐ 有效版本 - 已确认
        </Tag>
      );
    }
    return <Tag color="orange">草稿</Tag>;
  };

  const totalAmount = quotationItems.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) * parseFloat(item.unit_price) || 0);
  }, 0);

  const versionColumns = [
    {
      title: '版本号',
      dataIndex: 'version_number',
      key: 'version_number',
      render: (text, record) => (
        <Space>
          {text}
          {record.is_confirmed && !record.is_voided && (
            <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontWeight: 'bold' }}>
              有效
            </Tag>
          )}
        </Space>
      )
    },
    { title: '版本名称', dataIndex: 'version_name', key: 'version_name' },
    {
      title: '报价总额',
      dataIndex: 'final_amount',
      key: 'final_amount',
      render: (amount, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 16 }}>¥{parseFloat(amount).toLocaleString()}</Text>
          {parseFloat(record.discount_amount) > 0 && (
            <Text delete type="secondary" style={{ fontSize: 12 }}>
              原价 ¥{parseFloat(record.total_amount).toLocaleString()}
            </Text>
          )}
        </Space>
      )
    },
    { title: '报价项数', dataIndex: 'item_count', key: 'item_count' },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => getStatusTag(record)
    },
    {
      title: '附件状态',
      key: 'attachments',
      render: (_, record) => {
        if (record.required_attachments === 0) {
          return <Tag color="default">无必需附件</Tag>;
        }
        if (record.uploaded_required_attachments >= record.required_attachments) {
          return <Tag color="green">附件齐全</Tag>;
        }
        return (
          <Tag color="orange" icon={<WarningOutlined />}>
            待补 {record.required_attachments - record.uploaded_required_attachments} 个
          </Tag>
        );
      }
    },
    {
      title: '创建人',
      dataIndex: 'created_by_name',
      key: 'created_by_name'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => loadVersionDetail(record.id)}
          >
            查看
          </Button>
          {!record.is_confirmed && !record.is_voided && (
            <>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => {
                  setSelectedVersion(record);
                  versionForm.setFieldsValue({
                    version_number: record.version_number,
                    version_name: record.version_name,
                    scope_description: record.scope_description,
                    discount_amount: record.discount_amount
                  });
                  api.get(`/proposals/versions/${record.id}`).then(res => {
                    setQuotationItems(res.data.quotation_items || []);
                    setScopeChanges(res.data.scope_changes || []);
                  });
                  setVersionModalVisible(true);
                }}
              >
                编辑
              </Button>
              <Button
                type="link"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  setSelectedVersion(record);
                  setConfirmModalVisible(true);
                }}
              >
                确认
              </Button>
              <Popconfirm
                title="确定要作废这个版本吗？"
                onConfirm={() => {
                  setSelectedVersion(record);
                  setVoidModalVisible(true);
                }}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" icon={<CloseCircleOutlined />} danger>
                  作废
                </Button>
              </Popconfirm>
            </>
          )}
          <Button
            type="link"
            icon={<CopyOutlined />}
            onClick={() => {
              versionForm.setFieldsValue({
                version_number: '',
                version_name: record.version_name + ' - 副本',
                scope_description: record.scope_description,
                discount_amount: record.discount_amount
              });
              api.get(`/proposals/versions/${record.id}`).then(res => {
                setQuotationItems(res.data.quotation_items.map(item => ({ ...item, id: Date.now() + Math.random() })) || []);
                setScopeChanges(res.data.scope_changes.map(c => ({ ...c, id: Date.now() + Math.random() })) || []);
              });
              setSelectedVersion(null);
              setVersionModalVisible(true);
            }}
          >
            复制
          </Button>
        </Space>
      )
    }
  ];

  if (!project) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/projects')}
          style={{ marginRight: 16 }}
        >
          返回项目列表
        </Button>
        <Title level={3} style={{ margin: 0 }}>{project.name}</Title>
      </div>

      {selectedVersion?.is_confirmed && !selectedVersion?.is_voided && (
        <Alert
          message="⭐ 这是一个已确认的有效版本"
          description="已确认的版本不允许修改，如需调整请创建新版本"
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Descriptions title="项目基本信息" column={4}>
          <Descriptions.Item label="客户名称">{project.customer_name}</Descriptions.Item>
          <Descriptions.Item label="联系人">{project.contact_person}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{project.contact_phone}</Descriptions.Item>
          <Descriptions.Item label="联系邮箱">{project.contact_email}</Descriptions.Item>
          <Descriptions.Item label="项目描述" span={4}>{project.description}</Descriptions.Item>
        </Descriptions>
      </Card>

      {!viewMode ? (
        <Card
          title="方案版本列表"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedVersion(null);
                versionForm.resetFields();
                setQuotationItems([]);
                setScopeChanges([]);
                setVersionModalVisible(true);
              }}
            >
              新建版本
            </Button>
          }
        >
          <Table
            columns={versionColumns}
            dataSource={project.versions}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ) : selectedVersion && (
        <div>
          <Card 
            title={
              <Space>
                <span>方案版本详情</span>
                {getStatusTag(selectedVersion)}
              </Space>
            }
            extra={
              <Button onClick={() => {
                setSelectedVersion(null);
                setViewMode(false);
              }}>
                返回版本列表
              </Button>
            }
          >
            <Descriptions column={3} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="版本号">{selectedVersion.version_number}</Descriptions.Item>
              <Descriptions.Item label="版本名称">{selectedVersion.version_name}</Descriptions.Item>
              <Descriptions.Item label="创建人">{selectedVersion.created_by_name}</Descriptions.Item>
              <Descriptions.Item label="报价总额">
                <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                  ¥{parseFloat(selectedVersion.final_amount).toLocaleString()}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="折扣">{selectedVersion.discount_amount > 0 ? `¥${parseFloat(selectedVersion.discount_amount).toLocaleString()}` : '无'}</Descriptions.Item>
              <Descriptions.Item label="确认时间">{selectedVersion.confirmed_at ? dayjs(selectedVersion.confirmed_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">范围说明</Divider>
            <div style={{ marginBottom: 24, padding: 16, background: '#fafafa', borderRadius: 8 }}>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {selectedVersion.scope_description || '暂无范围说明'}
              </p>
            </div>

            <Tabs>
              <TabPane tab="报价明细" key="quotation">
                <Table
                  columns={[
                    { title: '序号', key: 'index', render: (_, __, index) => index + 1, width: 60 },
                    { title: '类别', dataIndex: 'category', key: 'category' },
                    { title: '项目名称', dataIndex: 'item_name', key: 'item_name' },
                    { title: '描述', dataIndex: 'description', key: 'description' },
                    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
                    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
                    { title: '单价', dataIndex: 'unit_price', key: 'unit_price', render: v => `¥${parseFloat(v).toLocaleString()}` },
                    { title: '金额', dataIndex: 'amount', key: 'amount', render: v => `¥${parseFloat(v).toLocaleString()}` }
                  ]}
                  dataSource={selectedVersion.quotation_items || []}
                  rowKey="id"
                  pagination={false}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={7} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          合计：
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} style={{ fontWeight: 'bold', color: '#1890ff' }}>
                          ¥{parseFloat(selectedVersion.total_amount).toLocaleString()}
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              </TabPane>

              <TabPane tab="范围变更记录" key="changes">
                {(selectedVersion.scope_changes?.length > 0) ? (
                  <List
                    dataSource={selectedVersion.scope_changes}
                    renderItem={item => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Tag color={item.change_type === '新增' ? 'green' : item.change_type === '删除' ? 'red' : 'blue'}>{item.change_type}</Tag>}
                          title={item.change_content}
                          description={
                            <span>
                              <Text type="secondary">变更原因：{item.change_reason || '未填写'}</Text>
                              <br />
                              <Text type="secondary">记录人：{item.created_by_name} · {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</Text>
                            </span>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>暂无变更记录</div>
                )}
              </TabPane>

              <TabPane tab="确认历史" key="confirmations">
                {(selectedVersion.confirmations?.length > 0) ? (
                  <Table
                    columns={[
                      { title: '确认人', dataIndex: 'confirmer_name', key: 'confirmer_name' },
                      { title: '公司', dataIndex: 'confirmer_company', key: 'confirmer_company' },
                      { title: '确认方式', dataIndex: 'confirmation_method', key: 'confirmation_method' },
                      { title: '确认日期', dataIndex: 'confirmation_date', key: 'confirmation_date', render: d => dayjs(d).format('YYYY-MM-DD') },
                      { title: '记录人', dataIndex: 'created_by_name', key: 'created_by_name' },
                      { title: '记录时间', dataIndex: 'created_at', key: 'created_at', render: d => dayjs(d).format('YYYY-MM-DD HH:mm') },
                      { title: '备注', dataIndex: 'notes', key: 'notes' }
                    ]}
                    dataSource={selectedVersion.confirmations}
                    rowKey="id"
                    pagination={false}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>暂无确认记录</div>
                )}
              </TabPane>

              <TabPane tab="附件管理" key="attachments">
                {(selectedVersion.attachments?.length > 0) ? (
                  <List
                    dataSource={selectedVersion.attachments}
                    renderItem={item => (
                      <List.Item
                        actions={[
                          item.file_path ? (
                            <a href={`/uploads/${item.file_path}`} target="_blank">下载</a>
                          ) : (
                            <Tag color="orange">待上传</Tag>
                          )
                        ]}
                      >
                        <List.Item.Meta
                          avatar={item.is_required ? <Tag color="red">必需</Tag> : <Tag>可选</Tag>}
                          title={item.original_name || item.file_name}
                          description={
                            <span>
                              上传人：{item.uploaded_by_name || '未上传'}
                              {item.upload_time && ` · ${dayjs(item.upload_time).format('YYYY-MM-DD HH:mm')}`}
                            </span>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>暂无附件</div>
                )}
              </TabPane>
            </Tabs>
          </Card>
        </div>
      )}

      <Modal
        title={selectedVersion ? '编辑方案版本' : '新建方案版本'}
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        onOk={() => versionForm.submit()}
        width={900}
      >
        <Form form={versionForm} layout="vertical" onFinish={selectedVersion ? handleUpdateVersion : handleCreateVersion}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="version_number"
                label="版本号"
                rules={[{ required: true, message: '请输入版本号' }]}
              >
                <Input placeholder="例如：1.0、2.0" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="version_name"
                label="版本名称"
                rules={[{ required: true, message: '请输入版本名称' }]}
              >
                <Input placeholder="请输入版本名称" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="scope_description"
            label="范围说明"
          >
            <TextArea rows={4} placeholder="请详细描述方案范围" />
          </Form.Item>

          <Form.Item
            name="discount_amount"
            label="折扣金额"
            initialValue={0}
          >
            <InputNumber 
              style={{ width: 200 }}
              min={0}
              precision={2}
              placeholder="请输入折扣金额"
              addonBefore="¥"
            />
          </Form.Item>

          <Divider orientation="left">报价明细</Divider>
          <div style={{ marginBottom: 16 }}>
            <Button 
              type="dashed" 
              onClick={addQuotationItem} 
              icon={<PlusOutlined />}
              block
            >
              添加报价项
            </Button>
          </div>
          
          {quotationItems.map((item, index) => (
            <div key={item.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ width: 30, textAlign: 'center' }}>{index + 1}</span>
              <Select
                value={item.category}
                onChange={(v) => updateQuotationItem(index, 'category', v)}
                style={{ width: 100 }}
                placeholder="类别"
              >
                <Option value="软件实施">软件实施</Option>
                <Option value="运维服务">运维服务</Option>
                <Option value="培训服务">培训服务</Option>
                <Option value="技术支持">技术支持</Option>
                <Option value="咨询服务">咨询服务</Option>
                <Option value="其他">其他</Option>
              </Select>
              <Input
                value={item.item_name}
                onChange={(e) => updateQuotationItem(index, 'item_name', e.target.value)}
                style={{ flex: 2 }}
                placeholder="项目名称"
              />
              <InputNumber
                value={item.quantity}
                onChange={(v) => updateQuotationItem(index, 'quantity', v)}
                style={{ width: 80 }}
                min={0}
                precision={2}
                placeholder="数量"
              />
              <Input
                value={item.unit}
                onChange={(e) => updateQuotationItem(index, 'unit', e.target.value)}
                style={{ width: 60 }}
                placeholder="单位"
              />
              <InputNumber
                value={item.unit_price}
                onChange={(v) => updateQuotationItem(index, 'unit_price', v)}
                style={{ width: 100 }}
                min={0}
                precision={2}
                placeholder="单价"
                addonBefore="¥"
              />
              <span style={{ width: 100, textAlign: 'right', fontWeight: 'bold' }}>
                ¥{parseFloat(item.amount || 0).toLocaleString()}
              </span>
              <Button 
                danger 
                type="text" 
                icon={<DeleteOutlined />}
                onClick={() => removeQuotationItem(index)}
              />
            </div>
          ))}
          
          {quotationItems.length > 0 && (
            <div style={{ textAlign: 'right', marginTop: 16, fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
              报价合计：¥{totalAmount.toLocaleString()}
            </div>
          )}

          <Divider orientation="left">范围变更记录</Divider>
          <div style={{ marginBottom: 16 }}>
            <Button 
              type="dashed" 
              onClick={addScopeChange} 
              icon={<PlusOutlined />}
              block
            >
              添加变更记录
            </Button>
          </div>
          
          {scopeChanges.map((change, index) => (
            <div key={change.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <Select
                value={change.change_type}
                onChange={(v) => updateScopeChange(index, 'change_type', v)}
                style={{ width: 100 }}
              >
                <Option value="新增">新增</Option>
                <Option value="删除">删除</Option>
                <Option value="调整">调整</Option>
                <Option value="其他">其他</Option>
              </Select>
              <Input
                value={change.change_content}
                onChange={(e) => updateScopeChange(index, 'change_content', e.target.value)}
                style={{ flex: 2 }}
                placeholder="变更内容"
              />
              <Input
                value={change.change_reason}
                onChange={(e) => updateScopeChange(index, 'change_reason', e.target.value)}
                style={{ flex: 1 }}
                placeholder="变更原因"
              />
              <Button 
                danger 
                type="text" 
                icon={<DeleteOutlined />}
                onClick={() => removeScopeChange(index)}
              />
            </div>
          ))}
        </Form>
      </Modal>

      <Modal
        title="确认方案版本"
        open={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        onOk={() => confirmForm.submit()}
      >
        <Alert
          message="确认后该版本将成为唯一有效版本"
          description="同一项目只能有一个已确认版本，确认后版本不可修改"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={confirmForm} layout="vertical" onFinish={handleConfirmVersion}>
          <Form.Item
            name="confirmer_name"
            label="客户确认人"
            rules={[{ required: true, message: '请输入客户确认人' }]}
          >
            <Input placeholder="请输入客户确认人姓名" />
          </Form.Item>
          <Form.Item
            name="confirmer_company"
            label="确认公司"
          >
            <Input placeholder="请输入确认公司" />
          </Form.Item>
          <Form.Item
            name="confirmation_method"
            label="确认方式"
            rules={[{ required: true, message: '请选择确认方式' }]}
          >
            <Select placeholder="请选择确认方式">
              <Option value="合同签字">合同签字</Option>
              <Option value="邮件确认">邮件确认</Option>
              <Option value="微信/钉钉">微信/钉钉确认</Option>
              <Option value="电话确认">电话确认</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="confirmation_date"
            label="确认日期"
            rules={[{ required: true, message: '请选择确认日期' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="notes"
            label="备注"
          >
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="作废方案版本"
        open={voidModalVisible}
        onCancel={() => setVoidModalVisible(false)}
        onOk={() => voidForm.submit()}
      >
        <Alert
          message="作废后该版本将不可使用"
          description="已作废的版本不能被引用或确认"
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={voidForm} layout="vertical" onFinish={handleVoidVersion}>
          <Form.Item
            name="reason"
            label="作废原因"
            rules={[{ required: true, message: '请输入作废原因' }]}
          >
            <TextArea rows={4} placeholder="请详细描述作废原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectDetail;
