import React, { useState } from 'react';
import { Form, Input, InputNumber, Select, Button, Modal, List, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { 领取地信息 as 领取地信息类型 } from '../types';

const 城市计发基数数据: Record<string, any> = {
  '北京市': { 省份: '北京市', 社会平均工资: 11082, 计发基数: 11082, 最低缴费基数: 6650, 最高缴费基数: 33225 },
  '上海市': { 省份: '上海市', 社会平均工资: 12183, 计发基数: 12183, 最低缴费基数: 7330, 最高缴费基数: 36549 },
  '广州市': { 省份: '广东省', 社会平均工资: 10428, 计发基数: 10428, 最低缴费基数: 6257, 最高缴费基数: 31284 },
  '深圳市': { 省份: '广东省', 社会平均工资: 12964, 计发基数: 12964, 最低缴费基数: 7778, 最高缴费基数: 38892 },
  '成都市': { 省份: '四川省', 社会平均工资: 8491, 计发基数: 8491, 最低缴费基数: 5095, 最高缴费基数: 25473 },
  '杭州市': { 省份: '浙江省', 社会平均工资: 11345, 计发基数: 11345, 最低缴费基数: 6807, 最高缴费基数: 34035 },
  '武汉市': { 省份: '湖北省', 社会平均工资: 9203, 计发基数: 9203, 最低缴费基数: 5522, 最高缴费基数: 27609 },
  '南京市': { 省份: '江苏省', 社会平均工资: 11240, 计发基数: 11240, 最低缴费基数: 6744, 最高缴费基数: 33720 }
};

interface Props {
  数据: 领取地信息类型;
  确定结果?: any;
  onChange: (数据: 领取地信息类型) => void;
}

const 领取地信息表单: React.FC<Props> = ({ 数据, 确定结果, onChange }) => {
  const [编辑中, set编辑中] = useState(false);
  const [form] = Form.useForm();

  const 处理城市变化 = (城市: string) => {
    const 城市数据 = 城市计发基数数据[城市];
    if (城市数据) {
      form.setFieldsValue({
        省份: 城市数据.省份,
        社会平均工资: 城市数据.社会平均工资,
        计发基数: 城市数据.计发基数,
        最低缴费基数: 城市数据.最低缴费基数,
        最高缴费基数: 城市数据.最高缴费基数
      });
    }
  };

  const 打开编辑弹窗 = () => {
    form.setFieldsValue(数据);
    set编辑中(true);
  };

  const 保存数据 = async () => {
    try {
      const values = await form.validateFields();
      onChange({
        ...values,
        id: 数据.id || `loc_${Date.now()}`
      });
      set编辑中(false);
      message.success('保存成功');
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Tag color="blue">当前领取地: {数据.城市}</Tag>
          <Tag color="green">计发基数: ¥{数据.计发基数?.toLocaleString()}</Tag>
          {确定结果?.最终领取地 && (
            <Tag color="purple" icon={<CheckOutlined />}>
              系统确定: {确定结果.最终领取地}
            </Tag>
          )}
        </div>
        <Button type="primary" icon={<EditOutlined />} onClick={打开编辑弹窗}>
          编辑领取地
        </Button>
      </div>

      <List
        bordered
        dataSource={[
          { label: '省份', value: 数据.省份 },
          { label: '户籍性质', value: 数据.户籍性质 },
          { label: '社会平均工资', value: `¥${数据.社会平均工资?.toLocaleString()}` },
          { label: '最低缴费基数', value: `¥${数据.最低缴费基数?.toLocaleString()}` },
          { label: '最高缴费基数', value: `¥${数据.最高缴费基数?.toLocaleString()}` }
        ]}
        renderItem={item => (
          <List.Item>
            <span style={{ width: 120 }}>{item.label}:</span>
            <strong>{item.value}</strong>
          </List.Item>
        )}
      />

      {确定结果?.领取依据 && (
        <div style={{ marginTop: 16, padding: 12, background: '#f0f5ff', borderRadius: 4 }}>
          <strong>领取依据:</strong> {确定结果.领取依据}
        </div>
      )}

      {确定结果?.边界提示?.length > 0 && (
        <div style={{ marginTop: 16, color: '#fa8c16' }}>
          提示: {确定结果.边界提示.map((t: any) => t.message).join('; ')}
        </div>
      )}

      <Modal
        title="编辑领取地信息"
        open={编辑中}
        onOk={保存数据}
        onCancel={() => set编辑中(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="城市"
            name="城市"
            rules={[{ required: true, message: '请选择城市' }]}
          >
            <Select
              showSearch
              placeholder="选择或输入城市"
              onChange={处理城市变化}
            >
              {Object.keys(城市计发基数数据).map(城市 => (
                <Select.Option key={城市} value={城市}>
                  {城市}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="省份"
            name="省份"
            rules={[{ required: true, message: '请输入省份' }]}
          >
            <Input placeholder="请输入省份" />
          </Form.Item>

          <Form.Item
            label="户籍性质"
            name="户籍性质"
            rules={[{ required: true, message: '请选择户籍性质' }]}
          >
            <Select>
              <Select.Option value="城镇">城镇</Select.Option>
              <Select.Option value="农村">农村</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="社会平均工资"
            name="社会平均工资"
            rules={[{ required: true, message: '请输入社会平均工资' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入社会平均工资" />
          </Form.Item>

          <Form.Item
            label="计发基数"
            name="计发基数"
            rules={[{ required: true, message: '请输入计发基数' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入计发基数" />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              label="最低缴费基数"
              name="最低缴费基数"
              rules={[{ required: true, message: '请输入最低缴费基数' }]}
              style={{ flex: 1 }}
            >
              <InputNumber style={{ width: '100%' }} min={0} placeholder="最低" />
            </Form.Item>

            <Form.Item
              label="最高缴费基数"
              name="最高缴费基数"
              rules={[{ required: true, message: '请输入最高缴费基数' }]}
              style={{ flex: 1 }}
            >
              <InputNumber style={{ width: '100%' }} min={0} placeholder="最高" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default 领取地信息表单;
