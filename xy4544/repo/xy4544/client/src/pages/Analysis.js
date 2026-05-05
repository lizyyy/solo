import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Select,
  Input,
  Space,
  Alert,
  Spin,
  Badge,
  Divider,
  List,
  Statistic,
} from 'antd';
import {
  BarChartOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const Analysis = () => {
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    deck: undefined,
    risk_level: undefined,
    maintenance_status: undefined,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [selectedCabin, setSelectedCabin] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    loadStats();
  }, [filters, pagination.current, pagination.pageSize]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
      };

      const response = await api.analysis.getAll(params);
      setAnalysisData(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.total || 0,
      }));
    } catch (error) {
      console.error('加载分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.analysis.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case '高风险':
        return 'red';
      case '中风险':
        return 'orange';
      case '低风险':
        return 'blue';
      case '误报':
        return 'default';
      default:
        return 'green';
    }
  };

  const getRiskBadgeStatus = (riskLevel) => {
    switch (riskLevel) {
      case '高风险':
        return 'error';
      case '中风险':
        return 'warning';
      case '低风险':
        return 'processing';
      case '误报':
        return 'default';
      default:
        return 'success';
    }
  };

  const getMaintenancePriorityColor = (priority) => {
    switch (priority) {
      case '高':
        return 'red';
      case '中':
        return 'orange';
      default:
        return 'blue';
    }
  };

  const viewCabinDetail = async (cabinNumber) => {
    setDetailLoading(true);
    setDetailModalVisible(true);
    
    try {
      const response = await api.analysis.getByCabin(cabinNumber);
      setSelectedCabin(response.data);
    } catch (error) {
      console.error('获取舱房详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const openOverrideModal = (cabin) => {
    setSelectedCabin(cabin);
    form.setFieldsValue({
      risk_level: cabin.risk_level,
      maintenance_status: cabin.maintenance_status,
      maintenance_priority: cabin.maintenance_priority,
      is_false_alarm: cabin.is_false_alarm === 1,
      override_reason: cabin.override_reason,
      notes: cabin.notes,
    });
    setOverrideModalVisible(true);
  };

  const handleOverride = async (values) => {
    try {
      await api.analysis.override(selectedCabin.cabin_number, {
        ...values,
        is_false_alarm: values.is_false_alarm ? 1 : 0,
        override_by: '当前用户',
      });
      
      Modal.success({
        title: '改判成功',
        content: `舱房 ${selectedCabin.cabin_number} 的状态已更新`,
      });
      
      setOverrideModalVisible(false);
      loadData();
      loadStats();
    } catch (error) {
      console.error('改判失败:', error);
      Modal.error({
        title: '改判失败',
        content: error.response?.data?.error || '操作失败',
      });
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const response = await api.analysis.recalculate();
      Modal.success({
        title: '分析完成',
        content: response.data.message,
      });
      loadData();
      loadStats();
    } catch (error) {
      console.error('分析失败:', error);
      Modal.error({
        title: '分析失败',
        content: error.response?.data?.error || '分析失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '舱房号',
      dataIndex: 'cabin_number',
      key: 'cabin_number',
      fixed: 'left',
      width: 100,
      render: (text, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => viewCabinDetail(text)}
        >
          {text}
        </Button>
      ),
    },
    {
      title: '甲板',
      dataIndex: 'deck',
      key: 'deck',
      width: 80,
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (text, record) => (
        <Badge
          status={getRiskBadgeStatus(text)}
          text={
            <Tag color={getRiskColor(text)}>
              {text}
              {record.manual_override && <span style={{ marginLeft: 4 }}>(人工)</span>}
            </Tag>
          }
        />
      ),
      filters: [
        { text: '高风险', value: '高风险' },
        { text: '中风险', value: '中风险' },
        { text: '低风险', value: '低风险' },
        { text: '正常', value: '正常' },
        { text: '误报', value: '误报' },
      ],
      onFilter: (value, record) => record.risk_level === value,
    },
    {
      title: '风险分数',
      dataIndex: 'risk_score',
      key: 'risk_score',
      width: 100,
      sorter: (a, b) => a.risk_score - b.risk_score,
      render: (score) => (
        <span
          style={{
            fontWeight: 'bold',
            color: score >= 50 ? '#ff4d4f' : score >= 30 ? '#faad14' : '#52c41a',
          }}
        >
          {score}
        </span>
      ),
    },
    {
      title: '维修状态',
      dataIndex: 'maintenance_status',
      key: 'maintenance_status',
      width: 120,
      render: (text) => <Tag>{text}</Tag>,
      filters: [
        { text: '需优先检修', value: '需优先检修' },
        { text: '需检修', value: '需检修' },
        { text: '建议检查', value: '建议检查' },
        { text: '无需维修', value: '无需维修' },
        { text: '误报排除', value: '误报排除' },
      ],
      onFilter: (value, record) => record.maintenance_status === value,
    },
    {
      title: '维修优先级',
      dataIndex: 'maintenance_priority',
      key: 'maintenance_priority',
      width: 100,
      render: (text) => <Tag color={getMaintenancePriorityColor(text)}>{text}</Tag>,
    },
    {
      title: '误报',
      dataIndex: 'is_false_alarm',
      key: 'is_false_alarm',
      width: 80,
      render: (value) => (
        value === 1 ? <Tag color="default">是</Tag> : <Tag color="green">否</Tag>
      ),
    },
    {
      title: '分析原因',
      dataIndex: 'analysis_reason',
      key: 'analysis_reason',
      ellipsis: true,
      width: 200,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      width: 150,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openOverrideModal(record)}
          >
            改判
          </Button>
        </Space>
      ),
    },
  ];

  const parseEvidence = (evidence) => {
    if (!evidence) return [];
    try {
      return typeof evidence === 'string' ? JSON.parse(evidence) : evidence;
    } catch (e) {
      return [];
    }
  };

  const getEvidenceIcon = (type) => {
    if (type?.includes('temperature') || type?.includes('温度')) {
      return <WarningOutlined style={{ color: '#ff4d4f' }} />;
    }
    if (type?.includes('humidity') || type?.includes('湿度')) {
      return <WarningOutlined style={{ color: '#faad14' }} />;
    }
    if (type?.includes('alarm') || type?.includes('报警')) {
      return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
    }
    if (type?.includes('complaint') || type?.includes('客诉')) {
      return <InfoCircleOutlined style={{ color: '#722ed1' }} />;
    }
    if (type?.includes('sustained') || type?.includes('持续')) {
      return <WarningOutlined style={{ color: '#ff4d4f' }} />;
    }
    return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          舱房分析
        </h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<ReloadOutlined />} onClick={runAnalysis} loading={loading}>
            重新分析
          </Button>
        </Space>
      </div>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="高风险"
                value={stats.risk_distribution?.find(r => r.risk_level === '高风险')?.count || 0}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="中风险"
                value={stats.risk_distribution?.find(r => r.risk_level === '中风险')?.count || 0}
                valueStyle={{ color: '#faad14' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="低风险"
                value={stats.risk_distribution?.find(r => r.risk_level === '低风险')?.count || 0}
                valueStyle={{ color: '#1890ff' }}
                prefix={<InfoCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="误报"
                value={stats.risk_distribution?.find(r => r.risk_level === '误报')?.count || 0}
                valueStyle={{ color: '#8c8c8c' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <span style={{ fontWeight: 500 }}>筛选条件:</span>
            <Select
              placeholder="选择甲板"
              style={{ width: 120 }}
              allowClear
              value={filters.deck}
              onChange={(value) => setFilters(prev => ({ ...prev, deck: value }))}
            >
              {stats?.deck_summary?.map(deck => (
                <Option key={deck.deck} value={deck.deck}>
                  {deck.deck}层 ({deck.total_cabins}舱)
                </Option>
              ))}
            </Select>
            <Select
              placeholder="风险等级"
              style={{ width: 120 }}
              allowClear
              value={filters.risk_level}
              onChange={(value) => setFilters(prev => ({ ...prev, risk_level: value }))}
            >
              <Option value="高风险">高风险</Option>
              <Option value="中风险">中风险</Option>
              <Option value="低风险">低风险</Option>
              <Option value="正常">正常</Option>
              <Option value="误报">误报</Option>
            </Select>
            <Select
              placeholder="维修状态"
              style={{ width: 140 }}
              allowClear
              value={filters.maintenance_status}
              onChange={(value) => setFilters(prev => ({ ...prev, maintenance_status: value }))}
            >
              <Option value="需优先检修">需优先检修</Option>
              <Option value="需检修">需检修</Option>
              <Option value="建议检查">建议检查</Option>
              <Option value="无需维修">无需维修</Option>
              <Option value="误报排除">误报排除</Option>
            </Select>
            <Button
              onClick={() => {
                setFilters({ deck: undefined, risk_level: undefined, maintenance_status: undefined });
                setPagination(prev => ({ ...prev, current: 1 }));
              }}
            >
              清除筛选
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={analysisData}
          rowKey="cabin_number"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={`舱房详情 - ${selectedCabin?.cabin_number}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setDetailModalVisible(false);
              openOverrideModal(selectedCabin);
            }}
          >
            人工改判
          </Button>,
        ]}
      >
        <Spin spinning={detailLoading}>
          {selectedCabin && (
            <div className="modal-content">
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="基本信息">
                    <p><strong>舱房号:</strong> {selectedCabin.cabin_number}</p>
                    <p><strong>甲板:</strong> {selectedCabin.deck}层</p>
                    <p><strong>舱房类型:</strong> {selectedCabin.cabin_type || '未知'}</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="风险评估">
                    <p>
                      <strong>风险等级:</strong>{' '}
                      <Tag color={getRiskColor(selectedCabin.risk_level)}>
                        {selectedCabin.risk_level}
                      </Tag>
                    </p>
                    <p><strong>风险分数:</strong> {selectedCabin.risk_score}</p>
                    <p>
                      <strong>误报判定:</strong>{' '}
                      <Tag color={selectedCabin.is_false_alarm === 1 ? 'default' : 'green'}>
                        {selectedCabin.is_false_alarm === 1 ? '是' : '否'}
                      </Tag>
                    </p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="维修状态">
                    <p><strong>维修状态:</strong> <Tag>{selectedCabin.maintenance_status}</Tag></p>
                    <p>
                      <strong>维修优先级:</strong>{' '}
                      <Tag color={getMaintenancePriorityColor(selectedCabin.maintenance_priority)}>
                        {selectedCabin.maintenance_priority}
                      </Tag>
                    </p>
                    <p>
                      <strong>人工改判:</strong>{' '}
                      <Tag color={selectedCabin.manual_override === 1 ? 'green' : 'default'}>
                        {selectedCabin.manual_override === 1 ? '是' : '否'}
                      </Tag>
                    </p>
                  </Card>
                </Col>
              </Row>

              <Divider />

              {selectedCabin.analysis_reason && (
                <div className="detail-section">
                  <h3>分析原因</h3>
                  <Alert
                    message={selectedCabin.analysis_reason}
                    type="info"
                    showIcon
                  />
                </div>
              )}

              {parseEvidence(selectedCabin.evidence).length > 0 && (
                <div className="detail-section">
                  <h3>风险证据</h3>
                  <List
                    dataSource={parseEvidence(selectedCabin.evidence)}
                    renderItem={(item) => (
                      <List.Item>
                        <div className="evidence-item">
                          <Space>
                            {getEvidenceIcon(item.type)}
                            <strong>{item.description || item.type}</strong>
                            {item.value !== undefined && (
                              <span style={{ color: '#666' }}>
                                (值: {item.value}{item.threshold ? `, 阈值: ${item.threshold}` : ''})
                              </span>
                            )}
                            {item.firstAbnormalTime && (
                              <span style={{ color: '#999' }}>
                                首次异常: {dayjs(item.firstAbnormalTime).format('YYYY-MM-DD HH:mm')}
                              </span>
                            )}
                          </Space>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              )}

              {selectedCabin.notes && (
                <div className="detail-section">
                  <h3>备注</h3>
                  <Card size="small" type="inner">
                    {selectedCabin.notes}
                  </Card>
                </div>
              )}

              {selectedCabin.manual_override === 1 && (
                <div className="detail-section">
                  <Alert
                    message="此状态为人工改判"
                    description={
                      <div>
                        {selectedCabin.override_reason && (
                          <p><strong>改判原因:</strong> {selectedCabin.override_reason}</p>
                        )}
                        {selectedCabin.override_by && (
                          <p><strong>改判人:</strong> {selectedCabin.override_by}</p>
                        )}
                      </div>
                    }
                    type="success"
                    showIcon
                  />
                </div>
              )}
            </div>
          )}
        </Spin>
      </Modal>

      <Modal
        title={`人工改判 - 舱房 ${selectedCabin?.cabin_number}`}
        open={overrideModalVisible}
        onCancel={() => setOverrideModalVisible(false)}
        width={600}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleOverride}
        >
          <Alert
            message="人工改判说明"
            description="修改后的数据将保留，下次系统自动分析时不会覆盖您的改判结果。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            name="risk_level"
            label="风险等级"
            rules={[{ required: true, message: '请选择风险等级' }]}
          >
            <Select>
              <Option value="高风险">高风险</Option>
              <Option value="中风险">中风险</Option>
              <Option value="低风险">低风险</Option>
              <Option value="正常">正常</Option>
              <Option value="误报">误报</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="maintenance_status"
            label="维修状态"
            rules={[{ required: true, message: '请选择维修状态' }]}
          >
            <Select>
              <Option value="需优先检修">需优先检修</Option>
              <Option value="需检修">需检修</Option>
              <Option value="建议检查">建议检查</Option>
              <Option value="无需维修">无需维修</Option>
              <Option value="误报排除">误报排除</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="maintenance_priority"
            label="维修优先级"
            rules={[{ required: true, message: '请选择维修优先级' }]}
          >
            <Select>
              <Option value="高">高</Option>
              <Option value="中">中</Option>
              <Option value="低">低</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="is_false_alarm"
            label="是否为误报"
            valuePropName="checked"
          >
            <Select>
              <Option value={true}>是（误报）</Option>
              <Option value={false}>否（真实告警）</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="override_reason"
            label="改判原因"
            rules={[{ required: true, message: '请填写改判原因' }]}
          >
            <TextArea
              rows={3}
              placeholder="请详细说明改判的原因..."
            />
          </Form.Item>

          <Form.Item
            name="notes"
            label="备注"
          >
            <TextArea
              rows={2}
              placeholder="添加额外的备注信息..."
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setOverrideModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认改判
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Analysis;
