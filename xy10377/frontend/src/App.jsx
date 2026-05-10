import React, { useState, useEffect } from 'react';
import {
  Layout,
  Card,
  Select,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Tag,
  Row,
  Col,
  Statistic,
  Divider,
  Space,
  Tooltip,
  Typography,
  Alert,
  Popover,
  Descriptions,
  Badge,
  Tabs,
  message,
  Upload
} from 'antd';
import {
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ImportOutlined,
  FileExcelOutlined,
  EyeOutlined,
  EditOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const DIFFERENCE_COLORS = {
  positive: 'difference-positive',
  negative: 'difference-negative',
  zero: 'difference-zero'
};

const getDifferenceClass = (diff) => {
  if (diff > 0) return DIFFERENCE_COLORS.positive;
  if (diff < 0) return DIFFERENCE_COLORS.negative;
  return DIFFERENCE_COLORS.zero;
};

const formatDifference = (diff) => {
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
};

const getReasonTags = (reasons) => {
  return reasons.map((r, idx) => {
    let color = 'default';
    if (r.type === 'normal') color = 'success';
    else if (r.type === 'in_transit') color = 'blue';
    else if (r.type === 'damage') color = 'orange';
    else if (r.type === 'overage') color = 'green';
    else if (r.type === 'shortage') color = 'red';
    
    return (
      <Tag key={idx} color={color} style={{ marginBottom: 4 }}>
        {r.label}
        {r.quantity > 0 && ` (${r.quantity})`}
      </Tag>
    );
  });
};

const App = () => {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [summary, setSummary] = useState(null);
  const [differences, setDifferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [form] = Form.useForm();
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchData();
    }
  }, [selectedStore]);

  const fetchStores = async () => {
    try {
      const res = await axios.get('/api/stores');
      setStores(res.data);
      if (res.data.length > 0) {
        setSelectedStore(res.data[0].id);
      }
    } catch (err) {
      message.error('获取门店列表失败');
    }
  };

  const fetchData = async () => {
    if (!selectedStore) return;
    
    setLoading(true);
    try {
      const [diffRes, summaryRes] = await Promise.all([
        axios.get('/api/differences', { params: { storeId: selectedStore } }),
        axios.get('/api/summary', { params: { storeId: selectedStore } })
      ]);
      
      if (diffRes.data.success) {
        setDifferences(diffRes.data.data);
      }
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
    } catch (err) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (record) => {
    setCurrentRecord(record);
    form.setFieldsValue({
      note: record.reviewNote || '',
      operator: ''
    });
    setReviewModalVisible(true);
  };

  const handleCancelReview = async (record) => {
    Modal.confirm({
      title: '确认取消复核',
      content: '取消复核后，该记录可以再次被修改和复核。确定要取消吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await axios.post('/api/review/cancel', { id: record.id });
          if (res.data.success) {
            message.success('已取消复核');
            fetchData();
          } else {
            message.error(res.data.message);
          }
        } catch (err) {
          message.error('操作失败');
        }
      }
    });
  };

  const submitReview = async () => {
    try {
      const values = await form.validateFields();
      const res = await axios.post('/api/review', {
        id: currentRecord.id,
        note: values.note,
        operator: values.operator
      });
      
      if (res.data.success) {
        message.success('复核成功');
        setReviewModalVisible(false);
        fetchData();
      } else {
        message.error(res.data.message);
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error('复核失败');
    }
  };

  const handleExport = () => {
    if (!selectedStore) {
      message.warning('请先选择门店');
      return;
    }
    
    const link = document.createElement('a');
    link.href = `/api/export?storeId=${selectedStore}`;
    link.download = `盘点报告.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('导出成功');
  };

  const filteredDifferences = differences.filter(d => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'zero') return d.difference === 0;
    if (filterStatus === 'positive') return d.difference > 0;
    if (filterStatus === 'negative') return d.difference < 0;
    if (filterStatus === 'reviewed') return d.reviewed;
    if (filterStatus === 'pending') return !d.reviewed;
    return true;
  });

  const expandedRowRender = (record) => {
    return (
      <div style={{ padding: '16px 24px', background: '#fafafa' }}>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="商品SKU">{record.productSku}</Descriptions.Item>
          <Descriptions.Item label="商品名称">{record.productName}</Descriptions.Item>
          <Descriptions.Item label="分类">{record.category}</Descriptions.Item>
          <Descriptions.Item label="系统库存">{record.systemQty}</Descriptions.Item>
          <Descriptions.Item label="在途调拨(未入账)">
            <Text type={record.inTransitQty > 0 ? 'warning' : undefined}>
              {record.inTransitQty}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="报损记录(未上报)">
            <Text type={record.damageQty > 0 ? 'danger' : undefined}>
              {record.damageQty}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="调整后系统库存">
            {record.adjustedSysQty}
          </Descriptions.Item>
          <Descriptions.Item label="实盘数量">{record.physicalQty}</Descriptions.Item>
          <Descriptions.Item label="差异计算" span={2}>
            <Text strong style={{ fontSize: '14px' }}>
              {record.calculation}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="可能原因" span={2}>
            {record.reasons.map((r, idx) => (
              <div key={idx} style={{ marginBottom: 8 }}>
                <Tag>{r.label}</Tag>
                {r.records && r.records.length > 0 && (
                  <div style={{ marginLeft: 8, marginTop: 4, color: '#666' }}>
                    {r.records.map((rec, ridx) => (
                      <div key={ridx} style={{ fontSize: '12px' }}>
                        {r.type === 'in_transit' && 
                          `从 ${stores.find(s => s.id === rec.fromStore)?.name || rec.fromStore} 调拨 ${rec.quantity} 件，日期: ${rec.transferDate}`
                        }
                        {r.type === 'damage' && 
                          `报损 ${rec.quantity} 件，原因: ${rec.reason}，日期: ${rec.damageDate}，操作人: ${rec.operator}`
                        }
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Descriptions.Item>
          {record.reviewed && (
            <>
              <Descriptions.Item label="复核人">{record.reviewOperator}</Descriptions.Item>
              <Descriptions.Item label="复核时间">
                {record.reviewTime ? new Date(record.reviewTime).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="复核备注" span={2}>
                {record.reviewNote || '-'}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </div>
    );
  };

  const columns = [
    {
      title: '商品SKU',
      dataIndex: 'productSku',
      key: 'productSku',
      width: 120,
      fixed: 'left'
    },
    {
      title: '商品名称',
      dataIndex: 'productName',
      key: 'productName',
      width: 180,
      fixed: 'left'
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100
    },
    {
      title: '系统库存',
      dataIndex: 'systemQty',
      key: 'systemQty',
      width: 100,
      align: 'right'
    },
    {
      title: '在途调拨',
      dataIndex: 'inTransitQty',
      key: 'inTransitQty',
      width: 100,
      align: 'right',
      render: (val) => val > 0 ? <Tag color="blue">+{val}</Tag> : val
    },
    {
      title: '报损记录',
      dataIndex: 'damageQty',
      key: 'damageQty',
      width: 100,
      align: 'right',
      render: (val) => val > 0 ? <Tag color="orange">-{val}</Tag> : val
    },
    {
      title: '调整后系统库存',
      dataIndex: 'adjustedSysQty',
      key: 'adjustedSysQty',
      width: 120,
      align: 'right',
      render: (val) => <Text strong>{val}</Text>
    },
    {
      title: '实盘数量',
      dataIndex: 'physicalQty',
      key: 'physicalQty',
      width: 100,
      align: 'right'
    },
    {
      title: '差异数量',
      dataIndex: 'difference',
      key: 'difference',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.difference - b.difference,
      render: (val) => (
        <span className={getDifferenceClass(val)}>
          {formatDifference(val)}
        </span>
      )
    },
    {
      title: '可能原因',
      dataIndex: 'reasons',
      key: 'reasons',
      width: 200,
      render: (reasons) => (
        <Space wrap size={[4, 4]}>
          {getReasonTags(reasons)}
        </Space>
      )
    },
    {
      title: '复核状态',
      dataIndex: 'reviewed',
      key: 'reviewed',
      width: 100,
      filters: [
        { text: '已复核', value: true },
        { text: '待复核', value: false }
      ],
      onFilter: (value, record) => record.reviewed === value,
      render: (reviewed) => reviewed ? (
        <Badge status="success" text="已复核" />
      ) : (
        <Badge status="processing" text="待复核" />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="text" icon={<EyeOutlined />} size="small" />
          </Tooltip>
          {!record.reviewed ? (
            <Tooltip title="复核">
              <Button
                type="text"
                icon={<CheckCircleOutlined />}
                size="small"
                onClick={() => handleReview(record)}
              />
            </Tooltip>
          ) : (
            <Tooltip title="取消复核">
              <Button
                type="text"
                danger
                icon={<CloseCircleOutlined />}
                size="small"
                onClick={() => handleCancelReview(record)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const tabItems = [
    {
      key: 'all',
      label: `全部 (${differences.length})`
    },
    {
      key: 'zero',
      label: `账实一致 (${differences.filter(d => d.difference === 0).length})`
    },
    {
      key: 'positive',
      label: (
        <span>
          <Tag color="green">盘盈</Tag> ({differences.filter(d => d.difference > 0).length})
        </span>
      )
    },
    {
      key: 'negative',
      label: (
        <span>
          <Tag color="red">盘亏</Tag> ({differences.filter(d => d.difference < 0).length})
        </span>
      )
    },
    {
      key: 'pending',
      label: `待复核 (${differences.filter(d => !d.reviewed).length})`
    },
    {
      key: 'reviewed',
      label: `已复核 (${differences.filter(d => d.reviewed).length})`
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#001529', 
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Space>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            📊 连锁门店盘点差异台
          </Title>
        </Space>
        <Space>
          <Select
            style={{ width: 200 }}
            placeholder="选择门店"
            value={selectedStore}
            onChange={setSelectedStore}
          >
            {stores.map(store => (
              <Option key={store.id} value={store.id}>
                {store.name} ({store.code})
              </Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            icon={<FileExcelOutlined />}
            onClick={handleExport}
            type="primary"
            danger
          >
            导出报表
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        {summary && (
          <Card className="card-summary" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic
                    title="盘点商品总数"
                    value={summary.totalProducts}
                    suffix="件"
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic
                    title="账实一致"
                    value={summary.zeroDiff}
                    suffix="件"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic
                    title={<span><Tag color="green">盘盈</Tag> 商品</span>}
                    value={summary.overageCount}
                    prefix="+"
                    suffix={`件 (+${summary.overageQty}数量)`}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic
                    title={<span><Tag color="red">盘亏</Tag> 商品</span>}
                    value={summary.shortageCount}
                    suffix={`件 (-${summary.shortageQty}数量)`}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic
                    title="已复核"
                    value={summary.reviewed}
                    suffix="件"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic
                    title="待复核"
                    value={summary.pendingReview}
                    suffix="件"
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Card>
              </Col>
            </Row>

            {summary.categories.length > 0 && (
              <>
                <Divider orientation="left">分类汇总</Divider>
                <Row gutter={[16, 16]}>
                  {summary.categories.map((cat, idx) => (
                    <Col key={idx} xs={24} sm={12} md={8} lg={6}>
                      <Card size="small" title={cat.name}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text type="secondary">总数</Text>
                            <Text strong>{cat.total}</Text>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text type="secondary">一致</Text>
                            <Text style={{ color: '#52c41a' }}>{cat.normal}</Text>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text type="secondary">盘盈</Text>
                            <Text style={{ color: '#52c41a' }}>
                              {cat.overage} (+{cat.overageQty})
                            </Text>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text type="secondary">盘亏</Text>
                            <Text style={{ color: '#ff4d4f' }}>
                              {cat.shortage} (-{cat.shortageQty})
                            </Text>
                          </div>
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            )}
          </Card>
        )}

        <Alert
          showIcon
          type="info"
          message="盘点差异计算说明"
          description={
            <div>
              <p><Text strong>差异公式：</Text> 实盘数量 - (系统库存 + 在途调拨未入账 - 报损未上报)</p>
              <p><Text strong>样例数据包含：</Text></p>
              <ul style={{ margin: 0 }}>
                <li>✅ 可口可乐：账实一致（正常一致）</li>
                <li>📦 农夫山泉：在途调拨20件未入账（在途差异）</li>
                <li>📦 乐事薯片：在途调拨15件未入账，实盘多5件（综合差异）</li>
                <li>⚠️ 康师傅红烧牛肉面：报损5件未上报（漏报损）</li>
                <li>🔄 其他商品：不同程度的盘盈盘亏</li>
              </ul>
            </div>
          }
          style={{ marginBottom: 16 }}
        />

        <Card>
          <Tabs
            activeKey={filterStatus}
            onChange={setFilterStatus}
            items={tabItems}
            style={{ marginBottom: 16 }}
          />

          <Table
            columns={columns}
            dataSource={filteredDifferences}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1600 }}
            expandable={{
              expandedRowRender,
              expandIcon: ({ expanded, onExpand, record }) => (
                <Tooltip title={expanded ? '收起详情' : '展开查看完整计算过程和归因'}>
                  <InfoCircleOutlined
                    style={{ cursor: 'pointer', color: '#1890ff' }}
                    rotate={expanded ? 90 : 0}
                    onClick={(e) => onExpand(record, e)}
                  />
                </Tooltip>
              )
            }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
          />
        </Card>
      </Content>

      <Modal
        title="复核盘点差异"
        open={reviewModalVisible}
        onOk={submitReview}
        onCancel={() => setReviewModalVisible(false)}
        okText="确认复核"
        cancelText="取消"
        destroyOnHidden
      >
        {currentRecord && (
          <div>
            <Alert
              showIcon
              type="warning"
              message="复核说明"
              description="复核后该记录将被锁定，如需修改请先取消复核。"
              style={{ marginBottom: 16 }}
            />
            
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="商品">
                {currentRecord.productName} ({currentRecord.productSku})
              </Descriptions.Item>
              <Descriptions.Item label="差异数量">
                <span className={getDifferenceClass(currentRecord.difference)}>
                  {formatDifference(currentRecord.difference)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="可能原因">
                {getReasonTags(currentRecord.reasons)}
              </Descriptions.Item>
            </Descriptions>

            <Form form={form} layout="vertical">
              <Form.Item
                name="operator"
                label="复核人"
                rules={[{ required: true, message: '请输入复核人姓名' }]}
              >
                <Input placeholder="请输入复核人姓名" />
              </Form.Item>
              <Form.Item
                name="note"
                label="复核备注"
                rules={[{ required: true, message: '请输入复核说明' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="请输入复核说明，例如：已核实差异原因，确认为在途商品/已确认报损/盘亏需要进一步调查..."
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default App;
