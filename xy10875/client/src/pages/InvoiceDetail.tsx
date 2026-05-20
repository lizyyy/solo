import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Timeline,
  List,
  Modal,
  Form,
  Select,
  Input,
  message,
  Row,
  Col,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  CarOutlined,
  DollarOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  invoiceApi,
  matchApi,
  duplicateApi,
  tripApi,
  budgetApi,
  Invoice,
  MatchResult,
  DuplicateInvoice,
  StatusTimeline,
  Trip,
  Budget,
} from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待匹配' },
  matched: { color: 'processing', text: '已匹配' },
  duplicate: { color: 'warning', text: '重复' },
  exception: { color: 'error', text: '异常' },
  confirmed: { color: 'success', text: '已确认' },
};

const matchTypeMap: Record<string, string> = {
  trip: '行程匹配',
  budget: '预算匹配',
  manual: '人工匹配',
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateInvoice[]>([]);
  const [timeline, setTimeline] = useState<StatusTimeline[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await invoiceApi.getDetail(id);
      if (res.data.success) {
        setInvoice(res.data.data!.invoice);
        setMatches(res.data.data!.matches);
        setDuplicates(res.data.data!.duplicates);
        setTimeline(res.data.data!.timeline);
      }
    } catch (error) {
      message.error('获取详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchTripsAndBudgets = async () => {
    try {
      const [tripsRes, budgetsRes] = await Promise.all([
        tripApi.getList(),
        budgetApi.getList(),
      ]);
      if (tripsRes.data.success) setTrips(tripsRes.data.data!);
      if (budgetsRes.data.success) setBudgets(budgetsRes.data.data!);
    } catch (error) {
      console.error('获取行程或预算失败');
    }
  };

  useEffect(() => {
    fetchData();
    fetchTripsAndBudgets();
  }, [id]);

  const handleConfirmMatch = async (matchId: string) => {
    try {
      const res = await matchApi.confirm(matchId, '当前用户');
      if (res.data.success) {
        message.success('确认成功');
        fetchData();
      }
    } catch (error) {
      message.error('确认失败');
    }
  };

  const handleResolveDuplicate = async (duplicateId: string, action: 'keep_original' | 'keep_duplicate' | 'keep_both') => {
    try {
      const res = await duplicateApi.resolve(duplicateId, action, '当前用户');
      if (res.data.success) {
        message.success('处理成功');
        fetchData();
      }
    } catch (error) {
      message.error('处理失败');
    }
  };

  const handleManualMatch = async (values: any) => {
    if (!id) return;
    try {
      const res = await invoiceApi.manualMatch(id, {
        ...values,
        operator: '当前用户',
      });
      if (res.data.success) {
        message.success('匹配成功');
        setMatchModalVisible(false);
        form.resetFields();
        fetchData();
      }
    } catch (error) {
      message.error('匹配失败');
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回列表
        </Button>
        {invoice && invoice.status === 'pending' && (
          <Button type="primary" onClick={() => setMatchModalVisible(true)}>
            人工匹配
          </Button>
        )}
      </Space>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="票据信息" loading={loading}>
            {invoice && (
              <Descriptions column={2} bordered>
                <Descriptions.Item label="发票号码">{invoice.invoice_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="发票代码">{invoice.invoice_code || '-'}</Descriptions.Item>
                <Descriptions.Item label="开票日期">{invoice.invoice_date || '-'}</Descriptions.Item>
                <Descriptions.Item label="金额">
                  {invoice.total_amount ? `¥${invoice.total_amount.toFixed(2)}` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="税额">
                  {invoice.tax_amount ? `¥${invoice.tax_amount.toFixed(2)}` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="不含税金额">
                  {invoice.amount ? `¥${invoice.amount.toFixed(2)}` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="销售方" span={2}>{invoice.seller_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="类别">{invoice.category || '-'}</Descriptions.Item>
                <Descriptions.Item label="员工">{invoice.employee_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="员工编号">{invoice.employee_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusMap[invoice.status]?.color || 'default'}>
                    {statusMap[invoice.status]?.text || invoice.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {dayjs(invoice.created_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          {matches.length > 0 && (
            <Card title="匹配结果" style={{ marginTop: 16 }}>
              <List
                dataSource={matches}
                renderItem={(match) => (
                  <List.Item
                    actions={
                      match.status !== 'confirmed'
                        ? [
                            <Popconfirm
                              key="confirm"
                              title="确认匹配结果？"
                              onConfirm={() => handleConfirmMatch(match.id)}
                              okText="确认"
                              cancelText="取消"
                            >
                              <Button type="link" size="small">确认</Button>
                            </Popconfirm>,
                          ]
                        : []
                    }
                  >
                    <List.Item.Meta
                      avatar={
                        match.match_type === 'trip' ? (
                          <CarOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                        ) : (
                          <DollarOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                        )
                      }
                      title={
                        <Space>
                          <span>{matchTypeMap[match.match_type || ''] || match.match_type}</span>
                          {match.match_score && <Tag color="blue">得分: {match.match_score}</Tag>}
                          <Tag color={match.status === 'confirmed' ? 'success' : 'processing'}>
                            {match.status === 'confirmed' ? '已确认' : '待确认'}
                          </Tag>
                        </Space>
                      }
                      description={
                        <>
                          {match.match_type === 'trip' && (
                            <div>
                              行程: {match.departure_city} → {match.arrival_city} ({match.start_date} ~ {match.end_date})
                            </div>
                          )}
                          {match.match_type === 'budget' && (
                            <div>
                              预算科目: {match.budget_name} ({match.budget_code})
                            </div>
                          )}
                          <div style={{ marginTop: 4, color: '#666' }}>
                            匹配人: {match.matched_by} | 匹配时间: {match.matched_at ? dayjs(match.matched_at).format('YYYY-MM-DD HH:mm') : '-'}
                          </div>
                          {match.notes && <div style={{ marginTop: 4 }}>备注: {match.notes}</div>}
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}

          {duplicates.length > 0 && (
            <Card title="重复票据检测" style={{ marginTop: 16 }}>
              <List
                dataSource={duplicates}
                renderItem={(dup) => (
                  <List.Item
                    actions={
                      dup.status !== 'resolved'
                        ? [
                            <Popconfirm
                              key="keep-original"
                              title="保留原始票据，驳回重复票据？"
                              onConfirm={() => handleResolveDuplicate(dup.id, 'keep_original')}
                              okText="确认"
                              cancelText="取消"
                            >
                              <Button type="link" size="small" danger>保留原始</Button>
                            </Popconfirm>,
                            <Popconfirm
                              key="keep-duplicate"
                              title="保留新票据，替换原始票据？"
                              onConfirm={() => handleResolveDuplicate(dup.id, 'keep_duplicate')}
                              okText="确认"
                              cancelText="取消"
                            >
                              <Button type="link" size="small">保留新票据</Button>
                            </Popconfirm>,
                            <Popconfirm
                              key="keep-both"
                              title="两张都保留？"
                              onConfirm={() => handleResolveDuplicate(dup.id, 'keep_both')}
                              okText="确认"
                              cancelText="取消"
                            >
                              <Button type="link" size="small">都保留</Button>
                            </Popconfirm>,
                          ]
                        : []
                    }
                  >
                    <List.Item.Meta
                      avatar={<WarningOutlined style={{ fontSize: 24, color: '#faad14' }} />}
                      title={
                        <Space>
                          <span>检测到重复票据</span>
                          {dup.confidence && <Tag color="orange">置信度: {(dup.confidence * 100).toFixed(0)}%</Tag>}
                          <Tag color={dup.status === 'resolved' ? 'success' : 'warning'}>
                            {dup.status === 'resolved' ? '已处理' : '待处理'}
                          </Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <div>原始票据: {dup.orig_invoice_no} - ¥{dup.orig_total_amount?.toFixed(2)}</div>
                          <div>重复票据: {dup.dup_invoice_no} - ¥{dup.dup_total_amount?.toFixed(2)}</div>
                          <div style={{ marginTop: 4 }}>检测类型: {dup.duplicate_type === 'invoice_no_match' ? '发票号码匹配' : '金额日期匹配'}</div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>

        <Col span={8}>
          <Card title="状态时间线">
            <Timeline>
              {timeline.map((item, index) => (
                <Timeline.Item
                  key={item.id}
                  color={index === 0 ? '#1890ff' : undefined}
                  dot={index === 0 ? <ClockCircleOutlined /> : undefined}
                >
                  <p>
                    <Tag color={statusMap[item.status]?.color || 'default'}>
                      {statusMap[item.status]?.text || item.status}
                    </Tag>
                  </p>
                  {item.notes && <p style={{ margin: '4px 0' }}>{item.notes}</p>}
                  <p style={{ color: '#666', fontSize: 12 }}>
                    操作人: {item.operator || '系统'} | {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                  </p>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Col>
      </Row>

      <Modal
        title="人工匹配"
        open={matchModalVisible}
        onCancel={() => setMatchModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleManualMatch}>
          <Form.Item name="trip_id" label="关联行程">
            <Select placeholder="请选择行程" allowClear>
              {trips.map((trip) => (
                <Option key={trip.id} value={trip.id}>
                  {trip.employee_name} - {trip.departure_city}→{trip.arrival_city} ({trip.start_date})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="budget_category_id" label="关联预算科目">
            <Select placeholder="请选择预算科目" allowClear>
              {budgets.map((budget) => (
                <Option key={budget.id} value={budget.id}>
                  {budget.code} - {budget.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
