import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Tabs,
  Card,
  Row,
  Col,
  Tag,
  Divider,
  Space,
  List,
  Upload,
  message,
  Image,
  Popconfirm,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  DeleteOutlined,
  EditOutlined,
  CameraOutlined,
  TagOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import {
  LostItem,
  ItemStatus,
  ItemCategory,
  ClaimAppointment,
  LockerRecord,
  ItemPhoto,
  ManualReview,
  AutoJudgeResult,
} from '../../shared/types';

const { TextArea } = Input;
const { TabPane } = Tabs;

interface ItemDetailProps {
  item: LostItem;
  open: boolean;
  onClose: () => void;
  onSave: (item: LostItem) => Promise<LostItem>;
  getCategoryLabel: (category: ItemCategory) => string;
  getStatusLabel: (status: ItemStatus) => string;
  getStatusColor: (status: ItemStatus) => string;
}

const ItemDetail: React.FC<ItemDetailProps> = ({
  item,
  open,
  onClose,
  onSave,
  getCategoryLabel,
  getStatusLabel,
  getStatusColor,
}) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<LostItem>(item);

  const isNew = !item.id;

  useEffect(() => {
    setEditingItem(item);
    form.setFieldsValue({
      ...item,
      foundTime: item.foundTime ? dayjs(item.foundTime) : null,
    });
  }, [item, form]);

  const categoryOptions = Object.values(ItemCategory).map((c) => ({
    label: getCategoryLabel(c),
    value: c,
  }));

  const statusOptions = Object.values(ItemStatus).map((s) => ({
    label: getStatusLabel(s),
    value: s,
  }));

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const savedItem: LostItem = {
        ...editingItem,
        ...values,
        foundTime: values.foundTime ? values.foundTime.toISOString() : editingItem.foundTime,
        updatedAt: new Date().toISOString(),
      };

      await onSave(savedItem);
      onClose();
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async () => {
    try {
      const photos = await window.electronAPI.dialog.selectPhoto();
      if (photos && photos.length > 0) {
        const newPhotos: ItemPhoto[] = photos.map((p) => ({
          id: uuidv4(),
          filePath: p.filePath,
          fileName: p.fileName,
          tags: [],
          description: '',
          uploadedAt: new Date().toISOString(),
        }));

        setEditingItem({
          ...editingItem,
          photos: [...editingItem.photos, ...newPhotos],
        });
      }
    } catch (error) {
      message.error('添加照片失败');
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    setEditingItem({
      ...editingItem,
      photos: editingItem.photos.filter((p) => p.id !== photoId),
    });
  };

  const handleUpdatePhotoTags = (photoId: string, tags: string[]) => {
    setEditingItem({
      ...editingItem,
      photos: editingItem.photos.map((p) =>
        p.id === photoId ? { ...p, tags } : p
      ),
    });
  };

  const handleAddAppointment = () => {
    const newAppointment: ClaimAppointment = {
      id: uuidv4(),
      claimantName: '',
      claimantContact: '',
      claimantIdType: '',
      claimantIdNumber: '',
      appointmentTime: new Date().toISOString(),
      description: '',
      proofDocuments: [],
      status: 'pending',
      notes: '',
      createdAt: new Date().toISOString(),
    };

    setEditingItem({
      ...editingItem,
      claimAppointments: [...editingItem.claimAppointments, newAppointment],
    });
  };

  const handleUpdateAppointment = (id: string, updates: Partial<ClaimAppointment>) => {
    setEditingItem({
      ...editingItem,
      claimAppointments: editingItem.claimAppointments.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    });
  };

  const handleDeleteAppointment = (id: string) => {
    setEditingItem({
      ...editingItem,
      claimAppointments: editingItem.claimAppointments.filter((a) => a.id !== id),
    });
  };

  const handleAddLockerRecord = () => {
    const newRecord: LockerRecord = {
      id: uuidv4(),
      lockerCode: '',
      scannedBy: '',
      scannedAt: new Date().toISOString(),
      action: 'store',
      notes: '',
    };

    setEditingItem({
      ...editingItem,
      lockerRecords: [...editingItem.lockerRecords, newRecord],
    });
  };

  const handleUpdateLockerRecord = (id: string, updates: Partial<LockerRecord>) => {
    setEditingItem({
      ...editingItem,
      lockerRecords: editingItem.lockerRecords.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    });
  };

  const handleDeleteLockerRecord = (id: string) => {
    setEditingItem({
      ...editingItem,
      lockerRecords: editingItem.lockerRecords.filter((r) => r.id !== id),
    });
  };

  const handleAddManualReview = () => {
    const newReview: ManualReview = {
      id: uuidv4(),
      reviewerName: '',
      reviewTime: new Date().toISOString(),
      notes: '',
      finalDecision: editingItem.status,
      additionalRequirements: [],
    };

    setEditingItem({
      ...editingItem,
      manualReview: newReview,
    });
  };

  const judgeResult = editingItem.autoJudgeResult;

  const renderJudgeResult = () => {
    if (!judgeResult) return null;

    let resultClass = 'judge-result ';
    if (judgeResult.needSupervisor) {
      resultClass += 'need-supervisor';
    } else if (judgeResult.needProof) {
      resultClass += 'need-proof';
    } else if (judgeResult.canReturn) {
      resultClass += 'approved';
    } else {
      resultClass += 'approved';
    }

    return (
      <div className={resultClass}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="可归还"
              value={judgeResult.canReturn ? '是' : '否'}
              valueStyle={{ color: judgeResult.canReturn ? '#52c41a' : '#ff4d4f' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="需补充证明"
              value={judgeResult.needProof ? '是' : '否'}
              valueStyle={{ color: judgeResult.needProof ? '#faad14' : '#8c8c8c' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="需值班长复核"
              value={judgeResult.needSupervisor ? '是' : '否'}
              valueStyle={{ color: judgeResult.needSupervisor ? '#ff4d4f' : '#8c8c8c' }}
            />
          </Col>
        </Row>

        {judgeResult.reasons.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h5>判断原因:</h5>
            <ul>
              {judgeResult.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {judgeResult.suggestedActions.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h5>建议操作:</h5>
            <ul>
              {judgeResult.suggestedActions.map((action, idx) => (
                <li key={idx}>{action}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ marginTop: 16, color: '#8c8c8c', fontSize: '12px' }}>
          置信度: {judgeResult.confidence}%
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={isNew ? '新增失物' : `失物详情 - ${editingItem.itemCode || '未保存'}`}
      open={open}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" loading={loading} onClick={handleSave}>
          保存
        </Button>,
      ]}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="基本信息" key="basic">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              ...editingItem,
              foundTime: editingItem.foundTime ? dayjs(editingItem.foundTime) : null,
            }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="物品编号"
                  name="itemCode"
                  help={isNew ? '保存后自动生成' : ''}
                >
                  <Input disabled={!isNew} placeholder="自动生成" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="状态"
                  name="status"
                  rules={[{ required: true, message: '请选择状态' }]}
                >
                  <Select options={statusOptions}>
                    {statusOptions.map((opt) => (
                      <Select.Option key={opt.value} value={opt.value}>
                        <Tag color={getStatusColor(opt.value as ItemStatus)}>{opt.label}</Tag>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="站点" name="station" rules={[{ required: true, message: '请输入站点' }]}>
                  <Input placeholder="例如: 人民广场" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="类型" name="category" rules={[{ required: true, message: '请选择类型' }]}>
                  <Select options={categoryOptions} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="物品描述" name="description" rules={[{ required: true, message: '请输入物品描述' }]}>
              <TextArea rows={3} placeholder="详细描述物品特征" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="发现时间" name="foundTime">
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="发现地点" name="foundLocation">
                  <Input placeholder="例如: 3号线车厢内" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="交件人姓名" name="finderName">
                  <Input placeholder="交件人姓名" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="交件人联系电话" name="finderContact">
                  <Input placeholder="联系电话" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="预估价值 (元)" name="estimatedValue">
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="预估价值" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="特殊标识" name="specialMarks">
                  <Input placeholder="物品特殊标识、特征等" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </TabPane>

        <TabPane tab="物品照片" key="photos">
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPhoto}>
              添加照片
            </Button>
          </div>

          {editingItem.photos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📷</div>
              <h3>暂无照片</h3>
              <p>点击上方按钮添加物品照片</p>
            </div>
          ) : (
            <div className="photo-grid">
              {editingItem.photos.map((photo) => (
                <Card
                  key={photo.id}
                  size="small"
                  hoverable
                  cover={
                    <Image
                      src={`file://${photo.filePath}`}
                      alt={photo.fileName}
                      style={{ height: 120, objectFit: 'cover' }}
                      fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%23d9d9d9' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='M21 15l-5-5L5 21'/%3E%3C/svg%3E"
                    />
                  }
                  actions={[
                    <Popconfirm title="删除这张照片?" onConfirm={() => handleDeletePhoto(photo.id)}>
                      <DeleteOutlined key="delete" style={{ color: '#ff4d4f' }} />
                    </Popconfirm>,
                  ]}
                >
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ marginBottom: 4 }}>
                      <TagOutlined /> {photo.tags.length > 0 ? photo.tags.join(', ') : '未加标签'}
                    </div>
                    <div style={{ color: '#8c8c8c' }}>
                      {dayjs(photo.uploadedAt).format('MM-DD HH:mm')}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabPane>

        <TabPane tab="认领预约" key="appointments">
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAppointment}>
              添加预约
            </Button>
          </div>

          {editingItem.claimAppointments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h3>暂无认领预约</h3>
              <p>点击上方按钮添加认领预约记录</p>
            </div>
          ) : (
            <List
              dataSource={editingItem.claimAppointments}
              renderItem={(apt) => (
                <Card
                  key={apt.id}
                  size="small"
                  style={{ marginBottom: 12 }}
                  extra={
                    <Popconfirm title="删除这条预约?" onConfirm={() => handleDeleteAppointment(apt.id)}>
                      <Button type="text" danger size="small">
                        删除
                      </Button>
                    </Popconfirm>
                  }
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="认领人" style={{ marginBottom: 8 }}>
                        <Input
                          value={apt.claimantName}
                          onChange={(e) =>
                            handleUpdateAppointment(apt.id, { claimantName: e.target.value })
                          }
                          placeholder="认领人姓名"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="联系电话" style={{ marginBottom: 8 }}>
                        <Input
                          value={apt.claimantContact}
                          onChange={(e) =>
                            handleUpdateAppointment(apt.id, { claimantContact: e.target.value })
                          }
                          placeholder="联系电话"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="状态" style={{ marginBottom: 8 }}>
                        <Select
                          value={apt.status}
                          onChange={(value) => handleUpdateAppointment(apt.id, { status: value })}
                          style={{ width: '100%' }}
                        >
                          <Select.Option value="pending">待确认</Select.Option>
                          <Select.Option value="confirmed">已确认</Select.Option>
                          <Select.Option value="completed">已完成</Select.Option>
                          <Select.Option value="cancelled">已取消</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="证件类型" style={{ marginBottom: 8 }}>
                        <Input
                          value={apt.claimantIdType}
                          onChange={(e) =>
                            handleUpdateAppointment(apt.id, { claimantIdType: e.target.value })
                          }
                          placeholder="身份证/护照等"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="证件号码" style={{ marginBottom: 8 }}>
                        <Input
                          value={apt.claimantIdNumber}
                          onChange={(e) =>
                            handleUpdateAppointment(apt.id, { claimantIdNumber: e.target.value })
                          }
                          placeholder="证件号码"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="预约时间" style={{ marginBottom: 8 }}>
                        <DatePicker
                          showTime
                          value={apt.appointmentTime ? dayjs(apt.appointmentTime) : null}
                          onChange={(date) =>
                            handleUpdateAppointment(apt.id, {
                              appointmentTime: date ? date.toISOString() : '',
                            })
                          }
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="描述" style={{ marginBottom: 8 }}>
                    <TextArea
                      value={apt.description}
                      onChange={(e) => handleUpdateAppointment(apt.id, { description: e.target.value })}
                      rows={2}
                      placeholder="认领人描述的物品特征"
                    />
                  </Form.Item>
                  <Form.Item label="备注" style={{ marginBottom: 0 }}>
                    <TextArea
                      value={apt.notes}
                      onChange={(e) => handleUpdateAppointment(apt.id, { notes: e.target.value })}
                      rows={1}
                      placeholder="备注"
                    />
                  </Form.Item>
                </Card>
              )}
            />
          )}
        </TabPane>

        <TabPane tab="保管柜记录" key="locker">
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddLockerRecord}>
              添加记录
            </Button>
          </div>

          {editingItem.lockerRecords.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔐</div>
              <h3>暂无保管柜记录</h3>
              <p>点击上方按钮添加保管柜扫码记录</p>
            </div>
          ) : (
            <List
              dataSource={editingItem.lockerRecords}
              renderItem={(record) => (
                <Card
                  key={record.id}
                  size="small"
                  style={{ marginBottom: 12 }}
                  extra={
                    <Popconfirm title="删除这条记录?" onConfirm={() => handleDeleteLockerRecord(record.id)}>
                      <Button type="text" danger size="small">
                        删除
                      </Button>
                    </Popconfirm>
                  }
                >
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item label="保管柜编号" style={{ marginBottom: 8 }}>
                        <Input
                          value={record.lockerCode}
                          onChange={(e) => handleUpdateLockerRecord(record.id, { lockerCode: e.target.value })}
                          placeholder="保管柜编号"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="操作类型" style={{ marginBottom: 8 }}>
                        <Select
                          value={record.action}
                          onChange={(value) => handleUpdateLockerRecord(record.id, { action: value })}
                          style={{ width: '100%' }}
                        >
                          <Select.Option value="store">存入</Select.Option>
                          <Select.Option value="retrieve">取出</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="扫描人" style={{ marginBottom: 8 }}>
                        <Input
                          value={record.scannedBy}
                          onChange={(e) => handleUpdateLockerRecord(record.id, { scannedBy: e.target.value })}
                          placeholder="扫描人姓名"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="扫描时间" style={{ marginBottom: 8 }}>
                        <DatePicker
                          showTime
                          value={record.scannedAt ? dayjs(record.scannedAt) : null}
                          onChange={(date) =>
                            handleUpdateLockerRecord(record.id, {
                              scannedAt: date ? date.toISOString() : '',
                            })
                          }
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="备注" style={{ marginBottom: 0 }}>
                    <TextArea
                      value={record.notes}
                      onChange={(e) => handleUpdateLockerRecord(record.id, { notes: e.target.value })}
                      rows={1}
                      placeholder="备注"
                    />
                  </Form.Item>
                </Card>
              )}
            />
          )}
        </TabPane>

        <TabPane tab="审核流程" key="review">
          <div className="modal-section">
            <h4>自动判断结果</h4>
            {judgeResult ? (
              renderJudgeResult()
            ) : (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-icon">⚙️</div>
                <h3>未执行自动判断</h3>
                <p>保存后系统将自动执行判断</p>
              </div>
            )}
          </div>

          <Divider />

          <div className="modal-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ margin: 0 }}>人工复核记录</h4>
              {!editingItem.manualReview && (
                <Button type="primary" icon={<EditOutlined />} onClick={handleAddManualReview}>
                  添加复核
                </Button>
              )}
            </div>

            {editingItem.manualReview ? (
              <Card size="small">
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="复核人" style={{ marginBottom: 8 }}>
                      <Input
                        value={editingItem.manualReview.reviewerName}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            manualReview: { ...editingItem.manualReview!, reviewerName: e.target.value },
                          })
                        }
                        placeholder="复核人姓名"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="复核时间" style={{ marginBottom: 8 }}>
                      <DatePicker
                        showTime
                        value={editingItem.manualReview.reviewTime ? dayjs(editingItem.manualReview.reviewTime) : null}
                        onChange={(date) =>
                          setEditingItem({
                            ...editingItem,
                            manualReview: {
                              ...editingItem.manualReview!,
                              reviewTime: date ? date.toISOString() : '',
                            },
                          })
                        }
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="最终决定" style={{ marginBottom: 8 }}>
                      <Select
                        value={editingItem.manualReview.finalDecision}
                        onChange={(value) =>
                          setEditingItem({
                            ...editingItem,
                            manualReview: { ...editingItem.manualReview!, finalDecision: value },
                          })
                        }
                        style={{ width: '100%' }}
                      >
                        {statusOptions.map((opt) => (
                          <Select.Option key={opt.value} value={opt.value}>
                            {opt.label}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="复核备注" style={{ marginBottom: 8 }}>
                  <TextArea
                    value={editingItem.manualReview.notes}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        manualReview: { ...editingItem.manualReview!, notes: e.target.value },
                      })
                    }
                    rows={3}
                    placeholder="复核备注"
                  />
                </Form.Item>
                <Form.Item label="附加要求" style={{ marginBottom: 0 }}>
                  <TextArea
                    value={editingItem.manualReview.additionalRequirements.join('\n')}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        manualReview: {
                          ...editingItem.manualReview!,
                          additionalRequirements: e.target.value.split('\n').filter(Boolean),
                        },
                      })
                    }
                    rows={2}
                    placeholder="附加要求（每行一条）"
                  />
                </Form.Item>
              </Card>
            ) : (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-icon">📋</div>
                <h3>暂无人工复核记录</h3>
                <p>点击上方按钮添加人工复核</p>
              </div>
            )}
          </div>
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default ItemDetail;
