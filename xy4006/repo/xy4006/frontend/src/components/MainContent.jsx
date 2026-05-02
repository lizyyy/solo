import React, { useState } from 'react';
import { Tabs, Button, Empty, Card, Descriptions, Tag, Space, Divider, Modal, Form, Input, InputNumber, DatePicker, Select, message, Timeline } from 'antd';
import { PlusOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { borrowRecordsApi } from '../services/api';

const { Option } = Select;

function MainContent({ records, supplies, currentView, viewTitle, onViewChange, onRecordChange, messageApi }) {
  const [borrowModalVisible, setBorrowModalVisible] = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [borrowForm] = Form.useForm();
  const [returnForm] = Form.useForm();

  const tabItems = [
    { key: 'all', label: '全部记录' },
    { key: 'active', label: '进行中' },
    { key: 'overdue', label: '逾期未还' },
    { key: 'today', label: '今日应还' }
  ];

  const getRecordStatus = (record) => {
    if (record.status === 'returned') {
      return { text: '已归还', className: 'returned' };
    }
    const today = dayjs().format('YYYY-MM-DD');
    if (record.expectedReturnDate < today) {
      return { text: '已逾期', className: 'overdue' };
    }
    if (record.expectedReturnDate === today) {
      return { text: '今日应还', className: 'today' };
    }
    return { text: '借用中', className: 'borrowed' };
  };

  const handleNewBorrow = () => {
    borrowForm.resetFields();
    borrowForm.setFieldsValue({
      quantity: 1,
      expectedReturnDate: dayjs().add(1, 'day')
    });
    setBorrowModalVisible(true);
  };

  const handleReturnClick = (record) => {
    setSelectedRecord(record);
    returnForm.resetFields();
    returnForm.setFieldsValue({
      returnQuantity: record.quantity - record.returnedQuantity
    });
    setReturnModalVisible(true);
  };

  const handleBorrowSubmit = async (values) => {
    setSubmitting(true);
    try {
      await borrowRecordsApi.create({
        supplyId: values.supplyId,
        quantity: values.quantity,
        borrower: values.borrower,
        phone: values.phone,
        expectedReturnDate: values.expectedReturnDate.format('YYYY-MM-DD')
      });
      messageApi.success('借用登记成功');
      setBorrowModalVisible(false);
      onRecordChange();
    } catch (error) {
      messageApi.error(error.message || '登记失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnSubmit = async (values) => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      await borrowRecordsApi.return(selectedRecord.id, {
        returnQuantity: values.returnQuantity,
        remark: values.remark
      });
      messageApi.success('归还登记成功');
      setReturnModalVisible(false);
      onRecordChange();
    } catch (error) {
      messageApi.error(error.message || '归还失败');
    } finally {
      setSubmitting(false);
    }
  };

  const availableSupplies = supplies.filter(s => s.availableQuantity > 0);

  return (
    <div>
      <div className="content-header">
        <h3>{viewTitle}</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleNewBorrow}>
          新建借用单
        </Button>
      </div>

      <Tabs
        activeKey={currentView}
        onChange={onViewChange}
        items={tabItems}
        className="view-tabs"
      />

      {records.length === 0 ? (
        <div className="empty-container">
          <Empty description={
            <div>
              <p>暂无记录</p>
              <p style={{ fontSize: '12px', color: '#999', marginTop: 8 }}>
                点击上方「新建借用单」开始登记
              </p>
            </div>
          } />
        </div>
      ) : (
        <div>
          {records.map((record) => {
            const status = getRecordStatus(record);
            return (
              <Card key={record.id} className="record-card" size="small">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="物资名称" span={2}>
                    <Space>
                      <strong>{record.supplyName}</strong>
                      <Tag color="blue">{record.supplyCategory}</Tag>
                      <span className={`record-status ${status.className}`}>
                        {status.text}
                      </span>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="借用人">{record.borrower}</Descriptions.Item>
                  <Descriptions.Item label="手机号">{record.phone}</Descriptions.Item>
                  <Descriptions.Item label="借用数量">
                    {record.returnedQuantity > 0 ? (
                      <span>
                        共 {record.quantity}，已还 {record.returnedQuantity}，
                        <span style={{ color: '#ff4d4f' }}> 待还 {record.quantity - record.returnedQuantity}</span>
                      </span>
                    ) : (
                      <span>{record.quantity}</span>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="预计归还日期">
                    {status.className === 'overdue' ? (
                      <span style={{ color: '#ff4d4f' }}>{record.expectedReturnDate}</span>
                    ) : status.className === 'today' ? (
                      <span style={{ color: '#faad14' }}>{record.expectedReturnDate}</span>
                    ) : (
                      record.expectedReturnDate
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="借用时间" span={2}>
                    {dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                </Descriptions>

                {record.returnHistory && record.returnHistory.length > 0 && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: 500, marginBottom: 8 }}>归还记录：</div>
                      <Timeline size="small">
                        {record.returnHistory.map((h, idx) => (
                          <Timeline.Item key={idx} color="green">
                            归还 {h.quantity} 个
                            {h.remark && `（${h.remark}）`}
                            <br />
                            <span style={{ color: '#999', fontSize: '11px' }}>
                              {dayjs(h.returnedAt).format('YYYY-MM-DD HH:mm')}
                            </span>
                          </Timeline.Item>
                        ))}
                      </Timeline>
                    </div>
                  </>
                )}

                {record.status !== 'returned' && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ textAlign: 'right' }}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<UndoOutlined />}
                        onClick={() => handleReturnClick(record)}
                      >
                        归还
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        title="新建借用单"
        open={borrowModalVisible}
        onCancel={() => setBorrowModalVisible(false)}
        footer={null}
        width={480}
      >
        <Form
          form={borrowForm}
          layout="vertical"
          onFinish={handleBorrowSubmit}
        >
          <Form.Item
            name="supplyId"
            label="选择物资"
            rules={[{ required: true, message: '请选择物资' }]}
          >
            <Select placeholder="请选择物资" showSearch filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }>
              {availableSupplies.map((s) => (
                <Option key={s.id} value={s.id} label={s.name}>
                  <Space>
                    <span>{s.name}</span>
                    <Tag color="blue">{s.category}</Tag>
                    <span style={{ color: '#52c41a' }}>可借 {s.availableQuantity}</span>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="quantity"
            label="借用数量"
            rules={[
              { required: true, message: '请输入数量' },
              { type: 'number', min: 1, message: '数量至少为1' }
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入借用数量" />
          </Form.Item>

          <Divider>借用人信息</Divider>

          <Form.Item
            name="borrower"
            label="借用人姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '请输入正确的手机号' }
            ]}
          >
            <Input placeholder="请输入手机号" maxLength={11} />
          </Form.Item>

          <Form.Item
            name="expectedReturnDate"
            label="预计归还日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              placeholder="请选择预计归还日期"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setBorrowModalVisible(false)} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              确认借用
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="归还登记"
        open={returnModalVisible}
        onCancel={() => setReturnModalVisible(false)}
        footer={null}
        width={420}
      >
        {selectedRecord && (
          <div>
            <div className="modal-section">
              <div className="modal-section-title">借用信息</div>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="物资">{selectedRecord.supplyName}</Descriptions.Item>
                <Descriptions.Item label="借用人">{selectedRecord.borrower}</Descriptions.Item>
                <Descriptions.Item label="借用数量">
                  {selectedRecord.quantity} 个
                  {selectedRecord.returnedQuantity > 0 && (
                    <span style={{ color: '#999' }}>（已还 {selectedRecord.returnedQuantity} 个）</span>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </div>

            <Form
              form={returnForm}
              layout="vertical"
              onFinish={handleReturnSubmit}
            >
              <Form.Item
                name="returnQuantity"
                label="本次归还数量"
                rules={[
                  { required: true, message: '请输入归还数量' },
                  {
                    type: 'number',
                    min: 1,
                    max: selectedRecord.quantity - selectedRecord.returnedQuantity,
                    message: `归还数量应在 1 到 ${selectedRecord.quantity - selectedRecord.returnedQuantity} 之间`
                  }
                ]}
              >
                <InputNumber
                  min={1}
                  max={selectedRecord.quantity - selectedRecord.returnedQuantity}
                  style={{ width: '100%' }}
                  placeholder={`请输入归还数量（最多 ${selectedRecord.quantity - selectedRecord.returnedQuantity}）`}
                />
              </Form.Item>

              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} placeholder="可选，归还备注" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Button onClick={() => setReturnModalVisible(false)} style={{ marginRight: 8 }}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  确认归还
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default MainContent;
