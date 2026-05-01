import React, { useState } from 'react';
import { Layout, Button, Empty, Popconfirm, Tooltip, Modal, Form, Input, InputNumber, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined, ClockCircleOutlined, FireOutlined, BoxPlotOutlined } from '@ant-design/icons';
import { suppliesApi } from '../services/api';

const { Sider } = Layout;

const CATEGORY_OPTIONS = ['电子设备', '办公器材', '布置用品', '其他'];

function SupplySidebar({ supplies, stats, selectedSupplyId, onSupplySelect, onSupplyChange, messageApi }) {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSupply, setEditingSupply] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleAddClick = () => {
    setEditingSupply(null);
    form.resetFields();
    setEditModalVisible(true);
  };

  const handleEditClick = (e, supply) => {
    e.stopPropagation();
    setEditingSupply(supply);
    form.setFieldsValue({
      name: supply.name,
      category: supply.category,
      totalQuantity: supply.totalQuantity,
      availableQuantity: supply.availableQuantity,
      remark: supply.remark
    });
    setEditModalVisible(true);
  };

  const handleDelete = async (e, supply) => {
    e.stopPropagation();
    try {
      await suppliesApi.delete(supply.id);
      messageApi.success('删除成功');
      onSupplyChange();
    } catch (error) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleFormSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingSupply) {
        await suppliesApi.update(editingSupply.id, values);
        messageApi.success('更新成功');
      } else {
        await suppliesApi.create(values);
        messageApi.success('创建成功');
      }
      setEditModalVisible(false);
      onSupplyChange();
    } catch (error) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getQuantityStatus = (available, total) => {
    if (available <= 0) return 'out';
    if (available <= 2) return 'low';
    return 'available';
  };

  const getToday = () => {
    return new Date().toISOString().split('T')[0];
  };

  return (
    <>
      <Sider width={300} className="sidebar-wrapper">
        <div className="sidebar-header">
          <span className="sidebar-title">物资清单</span>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddClick}>
            新增
          </Button>
        </div>

        {stats && (
          <div className="stats-section">
            <div className="stat-card">
              <span className="stat-icon"><BoxPlotOutlined /></span>
              <span>物资总数：{stats.overview.totalSupplies} 种</span>
            </div>
            {stats.overview.overdueCount > 0 && (
              <div className="stat-card warning" onClick={() => {}} style={{ cursor: 'pointer' }}>
                <span className="stat-icon"><WarningOutlined /></span>
                <span>逾期未还：{stats.overview.overdueCount} 笔</span>
              </div>
            )}
            {stats.overview.todayDueCount > 0 && (
              <div className="stat-card" style={{ color: '#faad14' }}>
                <span className="stat-icon"><ClockCircleOutlined /></span>
                <span>今日应还：{stats.overview.todayDueCount} 笔</span>
              </div>
            )}
            {stats.lowStockItems && stats.lowStockItems.length > 0 && (
              <div className="stat-card" style={{ color: '#ff4d4f' }}>
                <span className="stat-icon"><FireOutlined /></span>
                <span>库存预警：{stats.lowStockItems.length} 项</span>
              </div>
            )}
          </div>
        )}

        <div className="supply-list">
          {supplies.length === 0 ? (
            <Empty description="暂无物资，点击新增添加" style={{ margin: '40px 0' }} />
          ) : (
            supplies.map((supply) => (
              <div
                key={supply.id}
                className={`supply-item ${selectedSupplyId === supply.id ? 'selected' : ''}`}
                onClick={() => onSupplySelect(supply.id)}
              >
                <div className="supply-name">
                  {supply.name}
                  <span style={{ float: 'right' }}>
                    <Tooltip title="编辑">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => handleEditClick(e, supply)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="确定删除该物资？"
                      description="若有未归还的借用记录将无法删除"
                      onConfirm={(e) => handleDelete(e, supply)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Tooltip title="删除">
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  </span>
                </div>
                <div className="supply-info">
                  <span className="supply-category">{supply.category}</span>
                  <span className={`supply-quantity ${getQuantityStatus(supply.availableQuantity, supply.totalQuantity)}`}>
                    可借 {supply.availableQuantity} / 共 {supply.totalQuantity}
                  </span>
                </div>
                {supply.remark && (
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    备注：{supply.remark}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Sider>

      <Modal
        title={editingSupply ? '编辑物资' : '新增物资'}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={420}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
        >
          <Form.Item
            name="name"
            label="物资名称"
            rules={[{ required: true, message: '请输入物资名称' }]}
          >
            <Input placeholder="例如：投影仪" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Input placeholder="例如：电子设备" />
          </Form.Item>

          <Form.Item
            name="totalQuantity"
            label="总数量"
            rules={[
              { required: true, message: '请输入总数量' },
              { type: 'number', min: 0, message: '数量不能为负数' }
            ]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入总数量" />
          </Form.Item>

          <Form.Item
            name="availableQuantity"
            label="可借数量"
            rules={[
              { required: true, message: '请输入可借数量' },
              { type: 'number', min: 0, message: '数量不能为负数' }
            ]}
            help="初始状态下可借数量等于总数量"
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入可借数量" />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="可选，备注信息" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setEditModalVisible(false)} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingSupply ? '保存' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default SupplySidebar;
