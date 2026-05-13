import React, { useState } from 'react'
import { Card, Form, Select, Button, message, Space, DatePicker } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select
const { RangePicker } = DatePicker

function Reports() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const params = {
        responsible_person: values.responsible_person,
        start_date: values.date_range ? values.date_range[0].format('YYYY-MM-DD') : undefined,
        end_date: values.date_range ? values.date_range[1].format('YYYY-MM-DD') : undefined,
      }

      const res = await axios.get('/api/reports/export', {
        params,
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `导出报表_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2>报告导出</h2>
      </div>

      <Card title="导出报表">
        <Form form={form} layout="vertical">
          <Form.Item
            name="date_range"
            label="时间范围"
          >
            <RangePicker 
              style={{ width: '100%' }} 
              placeholder={['开始日期', '结束日期']}
            />
          </Form.Item>

          <Form.Item
            name="responsible_person"
            label="责任人/操作人"
          >
            <Select 
              placeholder="输入责任人姓名过滤" 
              showSearch
              allowClear
            >
              <Option value="管理员">管理员</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                icon={<DownloadOutlined />} 
                onClick={handleExport}
                loading={loading}
              >
                导出Excel报表
              </Button>
              <Button onClick={() => form.resetFields()}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Card type="inner" title="报表包含内容" style={{ marginTop: 16 }}>
          <ul>
            <li><strong>审计日志</strong>：所有字段变更记录，包含表名、字段名、原值、新值、操作人、时间</li>
            <li><strong>流转记录</strong>：所有设备流转记录，包含设备编号、流转类型、前后数据、操作人、时间</li>
            <li><strong>异常记录</strong>：所有异常记录，包含设备编号、异常类型、描述、状态、责任人、操作人、时间</li>
          </ul>
        </Card>
      </Card>
    </div>
  )
}

export default Reports
