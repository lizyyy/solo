import React, { useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Select, message, Checkbox } from 'antd'
import useStore from '../store'

const { TextArea } = Input

function VolunteerModal({ visible, volunteer, onClose, onSuccess }) {
  const [form] = Form.useForm()
  const {
    skills,
    eventDates,
    addVolunteer,
    updateVolunteer,
    fetchAllData,
  } = useStore()

  useEffect(() => {
    if (visible) {
      if (volunteer) {
        form.setFieldsValue({
          name: volunteer.name,
          phone: volunteer.phone,
          email: volunteer.email,
          max_daily_shifts: volunteer.max_daily_shifts,
          notes: volunteer.notes,
          skills: volunteer.skills?.map((s) => s.id) || [],
          available_date_ids: volunteer.available_dates?.map((d) => d.id) || [],
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          max_daily_shifts: 1,
        })
      }
    }
  }, [visible, volunteer, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      
      if (volunteer) {
        await updateVolunteer(volunteer.id, values)
        message.success('更新成功')
      } else {
        await addVolunteer(values)
        message.success('添加成功')
      }
      
      onClose()
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      message.error('操作失败：' + (err.response?.data?.error || err.message))
    }
  }

  const skillOptions = skills.map((s) => ({
    label: s.name,
    value: s.id,
  }))

  const dateOptions = eventDates.map((d) => ({
    label: (
      <span>
        {d.date}
        {d.description && ` (${d.description})`}
      </span>
    ),
    value: d.id,
  }))

  return (
    <Modal
      title={volunteer ? '编辑志愿者' : '添加志愿者'}
      open={visible}
      onOk={handleOk}
      onCancel={onClose}
      okText="确认"
      cancelText="取消"
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        className="modal-form"
      >
        <Form.Item
          name="name"
          label="姓名"
          rules={[{ required: true, message: '请输入姓名' }]}
        >
          <Input placeholder="请输入姓名" />
        </Form.Item>

        <Form.Item name="phone" label="联系电话">
          <Input placeholder="请输入联系电话" />
        </Form.Item>

        <Form.Item name="email" label="邮箱">
          <Input placeholder="请输入邮箱" />
        </Form.Item>

        <Form.Item
          name="max_daily_shifts"
          label="每天最多排班次数"
          rules={[{ required: true, message: '请输入次数' }]}
        >
          <InputNumber min={1} max={10} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="skills" label="技能标签">
          <Select
            mode="multiple"
            placeholder="请选择技能标签"
            options={skillOptions}
            allowClear
            className="skills-select"
          />
        </Form.Item>

        <Form.Item name="available_date_ids" label="可用日期">
          <Select
            mode="multiple"
            placeholder="请选择可用日期（不选则表示所有日期都可用）"
            options={dateOptions}
            allowClear
            className="skills-select"
          />
        </Form.Item>

        <Form.Item name="notes" label="备注">
          <TextArea rows={3} placeholder="请输入备注信息" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default VolunteerModal
