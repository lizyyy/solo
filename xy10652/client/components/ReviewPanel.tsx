import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Tag,
  Space,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Modal,
  Descriptions,
  Row,
  Col
} from 'antd';
import {
  batchApi,
  reviewApi,
  rectificationApi,
  logisticsApi,
  finalizationApi,
  changeLogApi
} from '../api';
import {
  SampleBatch,
  ReviewScore,
  RectificationOpinion,
  ReshipLogistics,
  VersionFinalization,
  ChangeLog
} from '../types';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { TabPane } = Tabs;

interface ReviewPanelProps {
  batch: SampleBatch;
  onClose: () => void;
  onRefresh: () => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({ batch, onClose, onRefresh }) => {
  const [reviews, setReviews] = useState<ReviewScore[]>([]);
  const [rectifications, setRectifications] = useState<RectificationOpinion[]>([]);
  const [logistics, setLogistics] = useState<ReshipLogistics[]>([]);
  const [finalization, setFinalization] = useState<VersionFinalization | null>(null);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewForm] = Form.useForm();
  const [rectificationForm] = Form.useForm();
  const [logisticsForm] = Form.useForm();
  const [finalizationForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [reviewData, rectificationData, logisticsData, finalizationData, batchLogs, reviewLogs] = await Promise.all([
        reviewApi.getByBatchId(batch.id),
        rectificationApi.getByBatchId(batch.id),
        logisticsApi.getByBatchId(batch.id),
        finalizationApi.getByBatchId(batch.id),
        changeLogApi.getByRecord('sample_batches', batch.id),
        changeLogApi.getByRecord('review_scores', batch.id)
      ]);
      setReviews(reviewData);
      setRectifications(rectificationData);
      setLogistics(logisticsData);
      setFinalization(finalizationData);
      setChangeLogs([...batchLogs, ...reviewLogs]);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [batch.id]);

  const handleSubmitReview = async (values: any) => {
    try {
      await reviewApi.create({
        ...values,
        batch_id: batch.id,
        review_date: values.review_date.format('YYYY-MM-DD'),
        changedBy: '当前用户'
      });
      message.success('评审打分保存成功');
      reviewForm.resetFields();
      loadData();
      onRefresh();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleSubmitRectification = async (values: any) => {
    try {
      await rectificationApi.create({
        ...values,
        batch_id: batch.id,
        deadline: values.deadline?.format('YYYY-MM-DD'),
        changedBy: '当前用户'
      });
      message.success('整改意见保存成功');
      rectificationForm.resetFields();
      loadData();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleAdvanceRectification = async (id: string, status: string) => {
    try {
      await rectificationApi.advance(id, status);
      message.success('状态更新成功');
      loadData();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleSubmitLogistics = async (values: any) => {
    try {
      await logisticsApi.create({
        ...values,
        batch_id: batch.id,
        ship_date: values.ship_date?.format('YYYY-MM-DD'),
        receive_date: values.receive_date?.format('YYYY-MM-DD'),
        changedBy: '当前用户'
      });
      message.success('物流信息保存成功');
      logisticsForm.resetFields();
      loadData();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleSubmitFinalization = async (values: any) => {
    try {
      await finalizationApi.create({
        ...values,
        batch_id: batch.id,
        finalize_date: values.finalize_date.format('YYYY-MM-DD'),
        changedBy: '当前用户'
      });
      message.success('版本定版成功');
      finalizationForm.resetFields();
      loadData();
      onRefresh();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const reviewColumns = [
    { title: '评审人', dataIndex: 'reviewer', key: 'reviewer' },
    { title: '评审日期', dataIndex: 'review_date', key: 'review_date' },
    { title: '外观', dataIndex: 'appearance_score', key: 'appearance_score' },
    { title: '品质', dataIndex: 'quality_score', key: 'quality_score' },
    { title: '功能', dataIndex: 'function_score', key: 'function_score' },
    { title: '包装', dataIndex: 'packaging_score', key: 'packaging_score' },
    { title: '总分', dataIndex: 'total_score', key: 'total_score' },
    { title: '结果', dataIndex: 'result', key: 'result', render: (v: string) => {
      const colors: Record<string, string> = { pending: 'orange', pass: 'green', fail: 'red' };
      return <Tag color={colors[v]}>{v === 'pending' ? '待确认' : v === 'pass' ? '通过' : '不通过'}</Tag>;
    }},
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '备注', dataIndex: 'comments', key: 'comments' }
  ];

  const rectificationColumns = [
    { title: '整改项', dataIndex: 'item', key: 'item' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '要求', dataIndex: 'requirement', key: 'requirement' },
    { title: '责任人', dataIndex: 'responsible_person', key: 'responsible_person' },
    { title: '截止日期', dataIndex: 'deadline', key: 'deadline' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => {
      const colors: Record<string, string> = { pending: 'orange', in_progress: 'blue', completed: 'green' };
      return <Tag color={colors[v]}>{v === 'pending' ? '待处理' : v === 'in_progress' ? '进行中' : '已完成'}</Tag>;
    }},
    { title: '操作', key: 'action', render: (_: any, record: RectificationOpinion) => (
      <Space>
        {record.status === 'pending' && (
          <Button size="small" type="primary" onClick={() => handleAdvanceRectification(record.id, 'in_progress')}>
            开始整改
          </Button>
        )}
        {record.status === 'in_progress' && (
          <Button size="small" type="primary" onClick={() => handleAdvanceRectification(record.id, 'completed')}>
            完成整改
          </Button>
        )}
      </Space>
    )}
  ];

  const logisticsColumns = [
    { title: '快递公司', dataIndex: 'courier_company', key: 'courier_company' },
    { title: '运单号', dataIndex: 'tracking_no', key: 'tracking_no' },
    { title: '寄出日期', dataIndex: 'ship_date', key: 'ship_date' },
    { title: '签收日期', dataIndex: 'receive_date', key: 'receive_date' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => (
      <Tag color={v === 'received' ? 'green' : 'blue'}>{v === 'received' ? '已签收' : '运输中'}</Tag>
    )},
    { title: '备注', dataIndex: 'remarks', key: 'remarks' }
  ];

  const changeLogColumns = [
    { title: '修改字段', dataIndex: 'field_name', key: 'field_name' },
    { title: '原值', dataIndex: 'old_value', key: 'old_value', render: (v: string) => <del style={{ color: '#999' }}>{v}</del> },
    { title: '新值', dataIndex: 'new_value', key: 'new_value' },
    { title: '修改人', dataIndex: 'changed_by', key: 'changed_by' },
    { title: '修改时间', dataIndex: 'changed_at', key: 'changed_at', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') }
  ];

  return (
    <Modal
      title={`样品批次复核 - ${batch.batch_no}`}
      open={true}
      onCancel={onClose}
      footer={null}
      width={1200}
      style={{ top: 20 }}
    >
      <Descriptions column={3} bordered size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="批次号">{batch.batch_no}</Descriptions.Item>
        <Descriptions.Item label="产品名称">{batch.product_name}</Descriptions.Item>
        <Descriptions.Item label="供应商">{batch.supplier_name}</Descriptions.Item>
        <Descriptions.Item label="样品类型">{batch.sample_type}</Descriptions.Item>
        <Descriptions.Item label="数量">{batch.quantity}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={batch.status === 'pending' ? 'orange' : batch.status === 'reviewing' ? 'blue' : 'green'}>
            {batch.status === 'pending' ? '待评审' : batch.status === 'reviewing' ? '评审中' : '已定版'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="当前版本">{batch.version}</Descriptions.Item>
        <Descriptions.Item label="收件日期">{batch.receive_date}</Descriptions.Item>
      </Descriptions>

      <Tabs defaultActiveKey="review">
        <TabPane tab="评审打分" key="review">
          <Form form={reviewForm} layout="horizontal" onFinish={handleSubmitReview} style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="reviewer" label="评审人" rules={[{ required: true }]}>
                  <Input placeholder="请输入评审人" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="review_date" label="评审日期" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="version" label="版本" initialValue="1.0">
                  <Input placeholder="如 1.0" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="appearance_score" label="外观" initialValue={20}>
                  <InputNumber min={0} max={20} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="quality_score" label="品质" initialValue={20}>
                  <InputNumber min={0} max={20} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="function_score" label="功能" initialValue={20}>
                  <InputNumber min={0} max={20} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="packaging_score" label="包装" initialValue={20}>
                  <InputNumber min={0} max={20} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="result" label="评审结果" initialValue="pending">
                  <Select>
                    <Select.Option value="pending">待确认</Select.Option>
                    <Select.Option value="pass">通过</Select.Option>
                    <Select.Option value="fail">不通过</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="comments" label="评审意见">
                  <TextArea rows={1} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                保存评审
              </Button>
            </Form.Item>
          </Form>
          <Table
            columns={reviewColumns}
            dataSource={reviews}
            rowKey="id"
            loading={loading}
            size="small"
          />
        </TabPane>

        <TabPane tab="整改意见" key="rectification">
          <Form form={rectificationForm} layout="horizontal" onFinish={handleSubmitRectification} style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="item" label="整改项" rules={[{ required: true }]}>
                  <Input placeholder="请输入整改项名称" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="responsible_person" label="责任人">
                  <Input placeholder="请输入责任人" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="deadline" label="截止日期">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="description" label="问题描述">
                  <TextArea rows={2} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="requirement" label="整改要求">
                  <TextArea rows={2} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                添加整改
              </Button>
            </Form.Item>
          </Form>
          <Table
            columns={rectificationColumns}
            dataSource={rectifications}
            rowKey="id"
            loading={loading}
            size="small"
          />
        </TabPane>

        <TabPane tab="复寄物流" key="logistics">
          <Form form={logisticsForm} layout="horizontal" onFinish={handleSubmitLogistics} style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="courier_company" label="快递公司">
                  <Input placeholder="如：顺丰速运" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="tracking_no" label="运单号">
                  <Input placeholder="请输入运单号" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="status" label="状态" initialValue="transit">
                  <Select>
                    <Select.Option value="transit">运输中</Select.Option>
                    <Select.Option value="received">已签收</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="ship_date" label="寄出日期">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="receive_date" label="签收日期">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="remarks" label="备注">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                保存物流
              </Button>
            </Form.Item>
          </Form>
          <Table
            columns={logisticsColumns}
            dataSource={logistics}
            rowKey="id"
            loading={loading}
            size="small"
          />
        </TabPane>

        <TabPane tab="版本定版" key="finalization">
          {finalization ? (
            <Card title="已定版信息">
              <Descriptions column={2}>
                <Descriptions.Item label="定版版本">{finalization.final_version}</Descriptions.Item>
                <Descriptions.Item label="定版人">{finalization.finalizer}</Descriptions.Item>
                <Descriptions.Item label="定版日期">{finalization.finalize_date}</Descriptions.Item>
                <Descriptions.Item label="备注">{finalization.remarks}</Descriptions.Item>
              </Descriptions>
            </Card>
          ) : (
            <Form form={finalizationForm} layout="horizontal" onFinish={handleSubmitFinalization}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="final_version" label="定版版本" rules={[{ required: true }]}>
                    <Input placeholder="如 2.0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="finalizer" label="定版人" rules={[{ required: true }]}>
                    <Input placeholder="请输入定版人" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="finalize_date" label="定版日期" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="remarks" label="备注">
                <TextArea rows={2} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" danger>
                  确认定版
                </Button>
              </Form.Item>
            </Form>
          )}
        </TabPane>

        <TabPane tab="修改记录" key="changes">
          <Table
            columns={changeLogColumns}
            dataSource={changeLogs}
            rowKey="id"
            loading={loading}
            size="small"
          />
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default ReviewPanel;
