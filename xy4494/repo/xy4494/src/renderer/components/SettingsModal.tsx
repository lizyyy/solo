import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Button, Card, Select } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { AppSettings } from '../../shared/types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  onSave: (settings: Partial<AppSettings>) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose, settings, onSave }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await onSave(values);
      onClose();
    } catch (error) {
      console.error('保存设置失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectExportPath = async () => {
    const path = await window.electronAPI.dialog.selectFolder('选择导出路径');
    if (path) {
      form.setFieldsValue({ exportPath: path });
    }
  };

  const handleSelectPhotoPath = async () => {
    const path = await window.electronAPI.dialog.selectFolder('选择照片存储路径');
    if (path) {
      form.setFieldsValue({ photoStoragePath: path });
    }
  };

  useEffect(() => {
    if (open && settings) {
      form.setFieldsValue({
        defaultStation: settings.defaultStation,
        autoJudgeEnabled: settings.autoJudgeEnabled,
        highValueThreshold: settings.highValueThreshold,
        dataRetentionDays: settings.dataRetentionDays,
        exportPath: settings.exportPath,
        photoStoragePath: settings.photoStoragePath,
      });
    }
  }, [open, settings, form]);

  return (
    <Modal
      title="系统设置"
      open={open}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          defaultStation: '人民广场',
          autoJudgeEnabled: true,
          highValueThreshold: 5000,
          dataRetentionDays: 90,
          exportPath: '',
          photoStoragePath: '',
        }}
      >
        <Card size="small" title="基本设置" style={{ marginBottom: 16 }}>
          <Form.Item
            label="默认站点"
            name="defaultStation"
            rules={[{ required: true, message: '请输入默认站点' }]}
          >
            <Input placeholder="例如: 人民广场" />
          </Form.Item>

          <Form.Item label="启用自动判断" name="autoJudgeEnabled" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
          <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: -8, marginBottom: 16 }}>
            开启后系统将自动判断物品是否可归还、是否需要补充证明或值班长复核
          </div>

          <Form.Item
            label="高价值物品阈值 (元)"
            name="highValueThreshold"
            rules={[{ required: true, message: '请输入高价值物品阈值' }]}
            help="超过此价值的物品将自动标记为需要值班长复核"
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="例如: 5000" />
          </Form.Item>

          <Form.Item
            label="数据保留天数"
            name="dataRetentionDays"
            rules={[{ required: true, message: '请输入数据保留天数' }]}
            help="超过此天数的已归还/已关闭记录可以被清理"
          >
            <InputNumber min={7} max={365} style={{ width: '100%' }} placeholder="例如: 90" />
          </Form.Item>
        </Card>

        <Card size="small" title="路径设置">
          <Form.Item label="默认导出路径" name="exportPath">
            <Input
              placeholder="选择默认导出路径"
              addonAfter={
                <Button icon={<FolderOpenOutlined />} onClick={handleSelectExportPath}>
                  选择
                </Button>
              }
            />
          </Form.Item>

          <Form.Item label="照片存储路径" name="photoStoragePath">
            <Input
              placeholder="选择照片存储路径"
              addonAfter={
                <Button icon={<FolderOpenOutlined />} onClick={handleSelectPhotoPath}>
                  选择
                </Button>
              }
            />
          </Form.Item>
        </Card>
      </Form>
    </Modal>
  );
};

export default SettingsModal;
