import React, { useEffect } from 'react'
import { Modal, Form, Select, InputNumber, message } from 'antd'
import useStore from '../store'

function RequirementModal({ visible, dateId, onClose, onSuccess }) {
  const [form] = Form.useForm()
  const { positions, addDateRequirement, eventDates, fetchAllData } = useStore()

  useEffect(() => {
    if (visible) {
      form.resetFields()
      form.setFieldsValue({
        required_count: 1,
      })
    }
  }, [visible, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      
      await addDateRequirement(dateId, {
        position_id: values.position_id,
        required_count: values.required_count,
      })
      
      message.success('添加成功')
      onClose()
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      message.error('操作失败：' + (err.response?.data?.error || err.message))
    }
  }

  const positionOptions = positions.map((p) => ({
    label: (
      <span>
        {p.name}
        {p.required_skills && JSON.parse(p.required_skills || '[]').length > 0 && (
          <span style={{ color: '#999', marginLeft: '8px' }}>
            (需要: {JSON.parse(p.required_skills).join(', ')})
          </span>
        )}
      </span>
    ),
    value: p.id,
  }))

  return (
    <Modal
      title="添加岗位需求"
      open={visible}
      onOk={handleOk}
      onCancel={onClose}
      okText="确认"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        className="modal-form"
      >
        <Form.Item
          name="position_id"
          label="选择岗位"
          rules={[{ required: true, message: '请选择岗位' }]}
        >
          <Select
            placeholder="请选择岗位"
            options={positionOptions}
            showSearch
            optionFilterProp="label"
            filterOption={(input, option) =>
              option.label.props.children[0].toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item
          name="required_count"
          label="需要人数"
          rules={[{ required: true, message: '请输入需要人数' }]}
        >
          <InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="请输入需要人数" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default RequirementModal
