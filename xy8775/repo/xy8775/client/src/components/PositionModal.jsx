import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, Select, message, Button, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import useStore from '../store'

const { TextArea } = Input

function PositionModal({ visible, position, onClose, onSuccess }) {
  const [form] = Form.useForm()
  const { positions, skills, addPosition, updatePosition, addSkill, fetchAllData } = useStore()
  const [newSkill, setNewSkill] = useState('')

  useEffect(() => {
    if (visible) {
      if (position) {
        let requiredSkills = []
        try {
          requiredSkills = JSON.parse(position.required_skills || '[]')
        } catch (e) {
          requiredSkills = []
        }
        form.setFieldsValue({
          name: position.name,
          required_skills: requiredSkills,
          description: position.description,
        })
      } else {
        form.resetFields()
      }
    }
  }, [visible, position, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      
      const data = {
        name: values.name,
        required_skills: values.required_skills || [],
        description: values.description,
      }
      
      if (position) {
        await updatePosition(position.id, data)
        message.success('更新成功')
      } else {
        await addPosition(data)
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

  const handleAddSkill = async () => {
    if (!newSkill.trim()) {
      return
    }
    
    const existingSkill = skills.find(
      (s) => s.name.toLowerCase() === newSkill.trim().toLowerCase()
    )
    
    if (existingSkill) {
      const currentSkills = form.getFieldValue('required_skills') || []
      if (!currentSkills.includes(existingSkill.name)) {
        form.setFieldsValue({
          required_skills: [...currentSkills, existingSkill.name],
        })
      }
      setNewSkill('')
      return
    }
    
    try {
      await addSkill({ name: newSkill.trim() })
      await fetchAllData()
      const currentSkills = form.getFieldValue('required_skills') || []
      form.setFieldsValue({
        required_skills: [...currentSkills, newSkill.trim()],
      })
      setNewSkill('')
      message.success('技能添加成功')
    } catch (err) {
      message.error('添加技能失败')
    }
  }

  const skillOptions = skills.map((s) => ({
    label: s.name,
    value: s.name,
  }))

  return (
    <Modal
      title={position ? '编辑岗位' : '添加岗位'}
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
          name="name"
          label="岗位名称"
          rules={[{ required: true, message: '请输入岗位名称' }]}
        >
          <Input placeholder="请输入岗位名称，如：签到、引导、安保等" />
        </Form.Item>

        <Form.Item name="required_skills" label="所需技能">
          <Select
            mode="multiple"
            placeholder="请选择所需技能（可不选）"
            options={skillOptions}
            allowClear
            className="skills-select"
            dropdownRender={(menu) => (
              <div>
                {menu}
                <Space style={{ padding: '8px' }}>
                  <Input
                    placeholder="添加新技能"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onPressEnter={handleAddSkill}
                    style={{ width: '200px' }}
                  />
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSkill}>
                    添加
                  </Button>
                </Space>
              </div>
            )}
          />
        </Form.Item>

        <Form.Item name="description" label="岗位描述">
          <TextArea rows={3} placeholder="请输入岗位描述" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default PositionModal
