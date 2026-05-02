import React, { useEffect } from 'react'
import { Modal, Form, Input, DatePicker, message } from 'antd'
import useStore from '../store'
import dayjs from 'dayjs'

const { TextArea } = Input

function DateModal({ visible, date, onClose, onSuccess }) {
  const [form] = Form.useForm()
  const { addEventDate, updateEventDate } = useStore()

  useEffect(() => {
    if (visible) {
      if (date) {
        form.setFieldsValue({
          date: date.date ? dayjs(date.date) : null,
          description: date.description,
        })
      } else {
        form.resetFields()
      }
    }
  }, [visible, date, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      
      const data = {
        date: values.date ? values.date.format('YYYY-MM-DD') : null,
        description: values.description,
      }
      
      if (date) {
        await updateEventDate(date.id, data)
        message.success('更新成功')
      } else {
        await addEventDate(data)
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

  return (
    <Modal
      title={date ? '编辑活动日期' : '添加活动日期'}
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
          name="date"
          label="日期"
          rules={[{ required: true, message: '请选择日期' }]}
        >
          <DatePicker
            style={{ width: '100%' }}
            placeholder="请选择日期"
            format="YYYY-MM-DD"
          />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea rows={3} placeholder="请输入日期描述（如：开幕日、闭幕日等）" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default DateModal
