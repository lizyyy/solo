import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Tag, 
  Space, 
  Statistic, 
  Row, 
  Col, 
  Select, 
  message, 
  Divider,
  Descriptions,
  Steps,
  Input,
  Form,
  Modal,
  Empty
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  LeftOutlined,
  RightOutlined,
  FastBackwardOutlined,
  FastForwardOutlined,
  EditOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { usePhotoScan, REPAIR_STATUS, REPAIR_STATUS_LABELS } from '../context/PhotoScanContext';
import DataService from '../services/DataService';

const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;

function ReviewPage() {
  const { state, updateRecord } = usePhotoScan();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [form] = Form.useForm();

  const unreviewedRecords = state.records.filter(r => !r.reviewed);
  const reviewedRecords = state.records.filter(r => r.reviewed);
  const passedRecords = state.records.filter(r => r.reviewStatus === 'pass');
  const failedRecords = state.records.filter(r => r.reviewStatus === 'fail');

  const recordsToReview = state.records;

  const currentRecord = recordsToReview[currentIndex];

  const goToFirst = () => {
    setCurrentIndex(0);
  };

  const goToLast = () => {
    setCurrentIndex(Math.max(0, recordsToReview.length - 1));
  };

  const goToPrev = () => {
    setCurrentIndex(Math.max(0, currentIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex(Math.min(recordsToReview.length - 1, currentIndex + 1));
  };

  const handleReview = (status) => {
    if (!currentRecord) return;
    
    updateRecord({
      ...currentRecord,
      reviewed: true,
      reviewStatus: status,
      reviewTime: new Date().toLocaleString()
    });

    message.success(`已标记为"${status === 'pass' ? '通过' : '有问题'}"`);
    
    if (currentIndex < recordsToReview.length - 1) {
      goToNext();
    }
  };

  const openDetailModal = () => {
    if (!currentRecord) return;
    form.setFieldsValue({
      ...currentRecord,
      scanResolution: currentRecord.scanResolution || undefined
    });
    setIsDetailModalOpen(true);
  };

  const saveDetailChanges = () => {
    form.validateFields().then(values => {
      updateRecord({
        ...currentRecord,
        ...values
      });
      message.success('记录已更新');
      setIsDetailModalOpen(false);
    });
  };

  const resetReview = () => {
    if (!currentRecord) return;
    updateRecord({
      ...currentRecord,
      reviewed: false,
      reviewStatus: null,
      reviewTime: null,
      reviewNotes: ''
    });
    message.info('已重置复核状态');
  };

  const getReviewStatusTag = (record) => {
    if (!record.reviewed) {
      return <Tag color="warning">未复核</Tag>;
    }
    if (record.reviewStatus === 'pass') {
      return <Tag color="success" icon={<CheckCircleOutlined />}>通过</Tag>;
    }
    return <Tag color="error" icon={<CloseCircleOutlined />}>有问题</Tag>;
  };

  const getRepairStatusTag = (status) => {
    const colorMap = {
      [REPAIR_STATUS.NOT_REPAIRED]: 'default',
      [REPAIR_STATUS.IN_PROGRESS]: 'processing',
      [REPAIR_STATUS.REPAIRED]: 'success'
    };
    return (
      <Tag color={colorMap[status] || 'default'}>
        {REPAIR_STATUS_LABELS[status] || status}
      </Tag>
    );
  };

  const getResolutionTag = (resolution) => {
    if (!resolution || resolution === 0) {
      return <Tag color="default">未知</Tag>;
    }
    if (resolution < state.settings.minResolution) {
      return <Tag color="error">{resolution} DPI</Tag>;
    }
    return <Tag color="success">{resolution} DPI</Tag>;
  };

  const steps = recordsToReview.map((record, index) => ({
    title: DataService.generateUniqueId(record.boxId, record.frameNumber),
    status: record.reviewed 
      ? (record.reviewStatus === 'pass' ? 'finish' : 'error')
      : (index === currentIndex ? 'process' : 'wait')
  }));

  if (recordsToReview.length === 0) {
    return (
      <Card>
        <Empty 
          description="暂无记录可复核，请先导入数据"
          style={{ padding: '60px 0' }}
        />
      </Card>
    );
  }

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={4}>
            <Statistic title="总记录数" value={recordsToReview.length} suffix="条" />
          </Col>
          <Col span={4}>
            <Statistic 
              title="待复核" 
              value={unreviewedRecords.length} 
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="已复核" 
              value={reviewedRecords.length} 
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="通过" 
              value={passedRecords.length} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="有问题" 
              value={failedRecords.length} 
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={4} style={{ textAlign: 'right' }}>
            <Statistic 
              title="复核进度" 
              value={Math.round(reviewedRecords.length / recordsToReview.length * 100)} 
              suffix="%"
            />
          </Col>
        </Row>
      </Card>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Steps
          current={currentIndex}
          items={steps}
          size="small"
          onChange={setCurrentIndex}
          labelPlacement="vertical"
        />
      </Card>

      {currentRecord && (
        <>
          <Card 
            size="small"
            title={
              <Space>
                <span>第 {currentIndex + 1} / {recordsToReview.length} 条</span>
                {getReviewStatusTag(currentRecord)}
                <Tag color="blue">
                  {DataService.generateUniqueId(currentRecord.boxId, currentRecord.frameNumber)}
                </Tag>
              </Space>
            }
            extra={
              <Space>
                <Button icon={<EditOutlined />} onClick={openDetailModal}>
                  编辑详情
                </Button>
              </Space>
            }
          >
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="底片盒号">
                <strong>{currentRecord.boxId || '-'}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="张号">
                <strong>{currentRecord.frameNumber || '-'}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="扫描文件" span={2}>
                {currentRecord.scanFile || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="分辨率">
                {getResolutionTag(currentRecord.scanResolution)}
              </Descriptions.Item>
              <Descriptions.Item label="修复状态">
                {getRepairStatusTag(currentRecord.repairStatus)}
              </Descriptions.Item>
              <Descriptions.Item label="修复备注" span={2}>
                {currentRecord.repairNotes || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="交付文件">
                {currentRecord.deliveryFile || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="责任人">
                {currentRecord.responsiblePerson || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {currentRecord.remarks || '-'}
              </Descriptions.Item>
            </Descriptions>

            {currentRecord.reviewed && (
              <>
                <Divider>复核信息</Divider>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="复核状态">
                    {getReviewStatusTag(currentRecord)}
                  </Descriptions.Item>
                  <Descriptions.Item label="复核时间">
                    {currentRecord.reviewTime || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="复核备注" span={2}>
                    {currentRecord.reviewNotes || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}
          </Card>

          <Card size="small" style={{ marginTop: 16 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Button icon={<FastBackwardOutlined />} onClick={goToFirst} disabled={currentIndex === 0}>
                    第一条
                  </Button>
                  <Button icon={<LeftOutlined />} onClick={goToPrev} disabled={currentIndex === 0}>
                    上一条
                  </Button>
                  <Button icon={<RightOutlined />} onClick={goToNext} disabled={currentIndex === recordsToReview.length - 1}>
                    下一条
                  </Button>
                  <Button icon={<FastForwardOutlined />} onClick={goToLast} disabled={currentIndex === recordsToReview.length - 1}>
                    最后一条
                  </Button>
                </Space>
              </Col>
              <Col>
                <Space>
                  {currentRecord.reviewed && (
                    <Button onClick={resetReview}>
                      重置复核
                    </Button>
                  )}
                  <Button 
                    danger 
                    size="large"
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleReview('fail')}
                  >
                    有问题
                  </Button>
                  <Button 
                    type="primary" 
                    size="large"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleReview('pass')}
                  >
                    通过
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </>
      )}

      <Modal
        title="编辑记录详情"
        open={isDetailModalOpen}
        onOk={saveDetailChanges}
        onCancel={() => setIsDetailModalOpen(false)}
        width={700}
      >
        {currentRecord && (
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              ...currentRecord,
              scanResolution: currentRecord.scanResolution || undefined
            }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="底片盒号" name="boxId">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="张号" name="frameNumber">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item label="扫描文件名" name="scanFile">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="分辨率 (DPI)" name="scanResolution">
                  <Input.Number min={0} max={1200} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="修复状态" name="repairStatus">
                  <Select>
                    <Option value={REPAIR_STATUS.NOT_REPAIRED}>{REPAIR_STATUS_LABELS[REPAIR_STATUS.NOT_REPAIRED]}</Option>
                    <Option value={REPAIR_STATUS.IN_PROGRESS}>{REPAIR_STATUS_LABELS[REPAIR_STATUS.IN_PROGRESS]}</Option>
                    <Option value={REPAIR_STATUS.REPAIRED}>{REPAIR_STATUS_LABELS[REPAIR_STATUS.REPAIRED]}</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="责任人" name="responsiblePerson">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="交付文件名" name="deliveryFile">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="修复备注" name="repairNotes">
              <TextArea rows={3} />
            </Form.Item>
            <Form.Item label="复核备注" name="reviewNotes">
              <TextArea rows={2} placeholder="记录复核时的问题和说明" />
            </Form.Item>
            <Form.Item label="备注" name="remarks">
              <TextArea rows={2} />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}

export default ReviewPage;
