import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Button, Form, Input, Select, InputNumber, message, Space, Tag,
  Row, Col, Descriptions, Timeline, Divider, Modal, List, Collapse
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, DollarOutlined,
  RollbackOutlined, ThunderboltOutlined
} from '@ant-design/icons';
import { bookAPI, saleAPI } from '../services/api';
import dayjs from 'dayjs';

const statusMap = {
  pending_evaluation: { color: 'default', text: '待估价' },
  evaluated: { color: 'blue', text: '已估价' },
  for_sale: { color: 'green', text: '待售' },
  sold: { color: 'purple', text: '已售出' },
  returned: { color: 'orange', text: '已退回' },
  return_accepted: { color: 'success', text: '退货验收通过' },
  return_rejected: { color: 'error', text: '退货验收不通过' },
  sale_exception: { color: 'red', text: '销售异常' }
};

const BookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [evaluateVisible, setEvaluateVisible] = useState(false);
  const [priceReductionVisible, setPriceReductionVisible] = useState(false);
  const [saleVisible, setSaleVisible] = useState(false);
  const [returnVisible, setReturnVisible] = useState(false);
  const [inspectReturnVisible, setInspectReturnVisible] = useState(false);
  const [pendingReturn, setPendingReturn] = useState(null);
  const [evaluateForm] = Form.useForm();
  const [priceReductionForm] = Form.useForm();
  const [saleForm] = Form.useForm();
  const [returnForm] = Form.useForm();
  const [inspectReturnForm] = Form.useForm();

  const fetchBook = async () => {
    setLoading(true);
    try {
      const res = await bookAPI.getById(id);
      setBook(res.data);
    } catch (error) {
      message.error('获取书籍详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBook();
  }, [id]);

  const handleEvaluate = async () => {
    try {
      const values = await evaluateForm.validateFields();
      await bookAPI.evaluate({ book_id: id, ...values });
      message.success('估价成功');
      setEvaluateVisible(false);
      fetchBook();
    } catch (error) {
      message.error('估价失败');
    }
  };

  const handleRequestPriceReduction = async () => {
    try {
      const values = await priceReductionForm.validateFields();
      await bookAPI.requestPriceReduction({ book_id: id, ...values });
      message.success('降价申请已提交');
      setPriceReductionVisible(false);
      fetchBook();
    } catch (error) {
      message.error('申请失败');
    }
  };

  const handleApproveReduction = async (reduction, approved) => {
    try {
      await bookAPI.approvePriceReduction({
        reduction_id: reduction.id,
        approver: '管理员',
        approved
      });
      message.success(approved ? '已批准降价' : '已驳回降价');
      fetchBook();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleMarkForSale = async () => {
    try {
      await bookAPI.markForSale({ book_id: id, operator: '管理员' });
      message.success('已标记为待售');
      fetchBook();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSale = async () => {
    try {
      const values = await saleForm.validateFields();
      await saleAPI.create({ book_id: id, ...values });
      message.success('销售记录已创建');
      setSaleVisible(false);
      fetchBook();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCreateReturn = async () => {
    try {
      const values = await returnForm.validateFields();
      await saleAPI.createReturn({
        book_id: id,
        ...values,
        returned_at: dayjs().toISOString(),
        received_by: '管理员'
      });
      message.success('退货记录已创建');
      setReturnVisible(false);
      fetchBook();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleInspectReturn = async () => {
    try {
      const values = await inspectReturnForm.validateFields();
      await saleAPI.inspectReturn({
        return_id: pendingReturn.id,
        ...values,
        inspected_by: '管理员'
      });
      message.success('验收完成');
      setInspectReturnVisible(false);
      setPendingReturn(null);
      fetchBook();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const renderActionButtons = () => {
    const buttons = [];
    
    if (book?.status === 'pending_evaluation') {
      buttons.push(
        <Button type="primary" onClick={() => setEvaluateVisible(true)}>
          品相估价
        </Button>
      );
    }
    
    if (book?.status === 'evaluated') {
      buttons.push(
        <Button type="primary" onClick={handleMarkForSale}>
          上架出售
        </Button>
      );
      buttons.push(
        <Button onClick={() => setPriceReductionVisible(true)}>
          申请降价
        </Button>
      );
    }
    
    if (book?.status === 'for_sale') {
      buttons.push(
        <Button type="primary" onClick={() => setSaleVisible(true)}>
          确认售出
        </Button>
      );
      buttons.push(
        <Button onClick={() => setPriceReductionVisible(true)}>
          申请降价
        </Button>
      );
    }
    
    if (book?.status === 'sold') {
      buttons.push(
        <Button type="default" onClick={() => setReturnVisible(true)}>
          处理退货
        </Button>
      );
    }
    
    if (book?.status === 'returned') {
      const pendingInspection = book?.returns?.find(r => r.status === 'pending_inspection');
      if (pendingInspection) {
        buttons.push(
          <Button type="primary" onClick={() => {
            setPendingReturn(pendingInspection);
            setInspectReturnVisible(true);
          }}>
            退货验收
          </Button>
        );
      }
    }
    
    return buttons;
  };

  if (!book) return <div>加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/books')}>
          返回列表
        </Button>
      </div>

      <Card
        title={book.title}
        extra={
          <Tag color={statusMap[book.status]?.color}>
            {statusMap[book.status]?.text}
          </Tag>
        }
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label="作者">{book.author}</Descriptions.Item>
          <Descriptions.Item label="出版社">{book.publisher}</Descriptions.Item>
          <Descriptions.Item label="ISBN">{book.isbn}</Descriptions.Item>
          <Descriptions.Item label="寄售人">{book.consignor_name}</Descriptions.Item>
          <Descriptions.Item label="原价">{book.original_price}</Descriptions.Item>
          <Descriptions.Item label="估价">{book.estimated_price}</Descriptions.Item>
          <Descriptions.Item label="当前价格">{book.current_price}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(book.created_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Space wrap>
          {renderActionButtons()}
        </Space>

        <Divider />

        <Row gutter={16}>
          <Col span={12}>
            <Card title="估价记录" size="small">
              <List
                dataSource={book.evaluations || []}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={`品相：${item.condition} - ¥${item.estimated_price}`}
                      description={
                        <div>
                          <div>估价人：{item.evaluator}</div>
                          <div>备注：{item.condition_description}</div>
                          <div>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="降价申请" size="small">
              <List
                dataSource={book.priceReductions || []}
                renderItem={item => (
                  <List.Item
                    actions={
                      item.status === 'pending' ? [
                        <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleApproveReduction(item, true)}>
                          批准
                        </Button>,
                        <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => handleApproveReduction(item, false)}>
                          驳回
                        </Button>
                      ] : null
                    }
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>¥{item.original_price} → ¥{item.proposed_price}</span>
                          <Tag color={item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'default'}>
                            {item.status === 'approved' ? '已批准' : item.status === 'rejected' ? '已驳回' : '待审批'}
                          </Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <div>申请人：{item.proposer}</div>
                          <div>原因：{item.reason}</div>
                          <div>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>

        <Divider />

        <Card title="销售记录" size="small">
          <List
            dataSource={book.sales || []}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <span>售价：¥{item.sold_price}</span>
                      <Tag color={item.status === 'completed' ? 'green' : 'red'}>
                        {item.status === 'completed' ? '已完成' : '异常'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <div>销售渠道：{item.platform}</div>
                      <div>买家信息：{item.buyer_info}</div>
                      <div>平台佣金：¥{item.platform_fee} | 寄售人分成：¥{item.seller_share}</div>
                      {item.exception_type && (
                        <div style={{ color: 'red' }}>
                          异常：{item.exception_type} - {item.exception_note}
                        </div>
                      )}
                      <div>{dayjs(item.sold_at).format('YYYY-MM-DD HH:mm')}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Card title="退货记录" size="small" style={{ marginTop: 16 }}>
          <List
            dataSource={book.returns || []}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <span>退货原因：{item.return_reason}</span>
                      <Tag color={
                        item.status === 'inspection_passed' ? 'green' :
                        item.status === 'inspection_failed' ? 'red' : 'orange'
                      }>
                        {item.status === 'pending_inspection' ? '待验收' :
                         item.status === 'inspection_passed' ? '验收通过' : '验收不通过'}
                      </Tag>
                      {item.manual_process_required && <Tag color="red">需人工处理</Tag>}
                    </Space>
                  }
                  description={
                    <div>
                      <div>验收结果：{item.inspection_result}</div>
                      <div>验收备注：{item.inspection_notes}</div>
                      <div>{dayjs(item.returned_at).format('YYYY-MM-DD HH:mm')}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Divider />

        <Card title="状态变更时间线">
          <Timeline>
            {(book.timeline || []).map((item, index) => (
              <Timeline.Item key={index}>
                <div>
                  <div>
                    <strong>{statusMap[item.status]?.text || item.status}</strong>
                    {' - '}
                    <span>{item.change_reason}</span>
                  </div>
                  <div style={{ color: '#666', fontSize: 12 }}>
                    操作人：{item.changed_by} | {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                  </div>
                  {item.old_values && Object.keys(item.old_values).length > 0 && (
                    <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                      <div style={{ color: '#999', marginBottom: 4 }}>变更前：</div>
                      {Object.entries(item.old_values).map(([key, value]) => (
                        <div key={key} style={{ fontSize: 12 }}>
                          {key}: {JSON.stringify(value)}
                        </div>
                      ))}
                    </div>
                  )}
                  {item.new_values && Object.keys(item.new_values).length > 0 && (
                    <div style={{ marginTop: 8, padding: 8, background: '#e6f7ff', borderRadius: 4 }}>
                      <div style={{ color: '#1890ff', marginBottom: 4 }}>变更后：</div>
                      {Object.entries(item.new_values).map(([key, value]) => (
                        <div key={key} style={{ fontSize: 12 }}>
                          {key}: {JSON.stringify(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      </Card>

      <Modal title="品相估价" open={evaluateVisible} onOk={handleEvaluate} onCancel={() => setEvaluateVisible(false)}>
        <Form form={evaluateForm} layout="vertical">
          <Form.Item name="evaluator" label="估价人" initialValue="管理员" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="condition" label="品相" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="全新">全新</Select.Option>
              <Select.Option value="九成新">九成新</Select.Option>
              <Select.Option value="八成新">八成新</Select.Option>
              <Select.Option value="七成新">七成新</Select.Option>
              <Select.Option value="六成新及以下">六成新及以下</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="condition_description" label="品相描述">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="estimated_price" label="估价" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="申请降价" open={priceReductionVisible} onOk={handleRequestPriceReduction} onCancel={() => setPriceReductionVisible(false)}>
        <Form form={priceReductionForm} layout="vertical">
          <Form.Item name="proposer" label="申请人" initialValue="管理员" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="当前价格">
            <Input value={book.current_price} disabled />
          </Form.Item>
          <Form.Item name="proposed_price" label="建议价格" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="降价原因" rules={[{ required: true }]}>
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="确认售出" open={saleVisible} onOk={handleSale} onCancel={() => setSaleVisible(false)}>
        <Form form={saleForm} layout="vertical">
          <Form.Item name="sold_by" label="操作人" initialValue="管理员" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sold_price" label="售价" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="platform" label="销售平台" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="线下门店">线下门店</Select.Option>
              <Select.Option value="微信小程序">微信小程序</Select.Option>
              <Select.Option value="闲鱼">闲鱼</Select.Option>
              <Select.Option value="多抓鱼">多抓鱼</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="buyer_info" label="买家信息">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="处理退货" open={returnVisible} onOk={handleCreateReturn} onCancel={() => setReturnVisible(false)}>
        <Form form={returnForm} layout="vertical">
          <Form.Item name="return_reason" label="退货原因" rules={[{ required: true }]}>
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="退货验收" open={inspectReturnVisible} onOk={handleInspectReturn} onCancel={() => setInspectReturnVisible(false)}>
        <Form form={inspectReturnForm} layout="vertical">
          <Form.Item name="inspection_result" label="验收结果" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="pass">通过</Select.Option>
              <Select.Option value="fail">不通过</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="inspection_notes" label="验收备注" rules={[{ required: true }]}>
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="manual_process_required" label="是否需要人工处理" valuePropName="checked">
            <Input type="checkbox" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BookDetail;
