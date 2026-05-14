import { useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, InputNumber, Button, Space, message, List, Row, Col, Tag, Divider } from 'antd';
import { PlusOutlined, MinusCircleOutlined, UploadOutlined } from '@ant-design/icons';
import type { MaterialItem } from '../types';
import { useBoothStore, boothList, brandList } from '../store/boothStore';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

interface CreateApplicationModalProps {
  open: boolean;
  onClose: () => void;
}

interface MaterialForm {
  name: string;
  type: string;
  quantity: number;
  fireCertified: boolean;
}

const CreateApplicationModal = ({ open, onClose }: CreateApplicationModalProps) => {
  const [form] = Form.useForm();
  const [importForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const { createApplication, batchImportApplications, checkScheduleConflict } = useBoothStore();
  const [conflictCheck, setConflictCheck] = useState<{ hasConflict: boolean; checked: boolean }>({ hasConflict: false, checked: false });

  const watchBooth = Form.useWatch('boothId', form);
  const watchStartDate = Form.useWatch('startDate', form);
  const watchEndDate = Form.useWatch('endDate', form);

  const checkConflict = () => {
    if (watchBooth && watchStartDate && watchEndDate) {
      const hasConflict = checkScheduleConflict(watchBooth, watchStartDate.format('YYYY-MM-DD'), watchEndDate.format('YYYY-MM-DD'));
      setConflictCheck({ hasConflict, checked: true });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const booth = boothList.find((b) => b.id === values.boothId);
      const brand = brandList.find((b) => b.id === values.brandId);
      if (!booth || !brand) return;

      const materials: MaterialItem[] = (values.materials || []).map((m: MaterialForm, i: number) => ({
        id: `M${Date.now()}-${i}`,
        name: m.name,
        type: m.type,
        quantity: m.quantity,
        fireCertified: m.fireCertified,
        status: 'pending' as const,
      }));

      const result = createApplication({
        brandId: brand.id,
        brandName: brand.name,
        boothId: booth.id,
        boothCode: booth.code,
        boothName: booth.name,
        boothLocation: booth.location,
        startDate: values.startDate.format('YYYY-MM-DD'),
        endDate: values.endDate.format('YYYY-MM-DD'),
        purpose: values.purpose,
        estimatedSetupDate: values.estimatedSetupDate.format('YYYY-MM-DD'),
        estimatedTeardownDate: values.estimatedTeardownDate.format('YYYY-MM-DD'),
        materials,
        appliedPower: values.appliedPower,
        depositAmount: booth.basePrice,
      });

      if (result.success) {
        message.success(`申请创建成功！申请编号：${result.app?.applicationNo}${result.conflict ? '（注意：存在档期冲突）' : ''}`);
        form.resetFields();
        setConflictCheck({ hasConflict: false, checked: false });
        onClose();
      } else {
        message.error('创建失败：存在重复的相同品牌、展位和日期的申请');
      }
    } catch {
      // validation error
    }
  };

  const handleBatchImport = async () => {
    try {
      const values = await importForm.validateFields();
      const importData: { brandId: string; boothId: string; startDate: string; endDate: string; purpose: string }[] = JSON.parse(values.jsonData);

      const paramsList = importData.map((item, index) => {
        const booth = boothList.find((b) => b.id === item.boothId);
        const brand = brandList.find((b) => b.id === item.brandId);
        return {
          brandId: item.brandId,
          brandName: brand?.name || item.brandId,
          boothId: item.boothId,
          boothCode: booth?.code || item.boothId,
          boothName: booth?.name || item.boothId,
          boothLocation: booth?.location || '',
          startDate: item.startDate,
          endDate: item.endDate,
          purpose: item.purpose,
          estimatedSetupDate: item.startDate,
          estimatedTeardownDate: item.endDate,
          materials: [
            {
              id: `M${Date.now()}-${index}-0`,
              name: '标准展位材料',
              type: '展台',
              quantity: 1,
              fireCertified: true,
              status: 'pending' as const,
            },
          ],
          appliedPower: booth?.maxElectricity || 10,
          depositAmount: booth?.basePrice || 5000,
        };
      });

      const result = batchImportApplications(paramsList);
      message.success(
        `批量导入完成：成功 ${result.success} 条，重复 ${result.duplicates} 条，档期冲突 ${result.conflicts} 条，失败 ${result.failed} 条`
      );
      importForm.resetFields();
      onClose();
    } catch (error) {
      console.error(error);
      message.error('导入失败，请检查 JSON 格式是否正确');
    }
  };

  const sampleImportData = JSON.stringify(
    [
      {
        brandId: 'B001',
        boothId: 'BT001',
        startDate: dayjs().add(10, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().add(12, 'day').format('YYYY-MM-DD'),
        purpose: '新品推广活动',
      },
      {
        brandId: 'B002',
        boothId: 'BT002',
        startDate: dayjs().add(15, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().add(18, 'day').format('YYYY-MM-DD'),
        purpose: '夏季促销',
      },
    ],
    null,
    2
  );

  return (
    <Modal
      title={
        <Space>
          {activeTab === 'single' ? '新增展位申请' : '批量导入申请'}
          <Tag color={activeTab === 'single' ? 'blue' : 'green'}>{activeTab === 'single' ? '单条录入' : '批量导入'}</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={800}
      footer={null}
      destroyOnClose
    >
      <Space style={{ marginBottom: 16 }}>
        <Button type={activeTab === 'single' ? 'primary' : 'default'} onClick={() => setActiveTab('single')}>
          单条录入
        </Button>
        <Button type={activeTab === 'batch' ? 'primary' : 'default'} onClick={() => setActiveTab('batch')}>
          批量导入
        </Button>
      </Space>

      {activeTab === 'single' && (
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="brandId" label="申请品牌" rules={[{ required: true, message: '请选择品牌' }]}>
                <Select placeholder="请选择品牌">
                  {brandList.map((brand) => (
                    <Option key={brand.id} value={brand.id}>
                      {brand.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="boothId" label="申请展位" rules={[{ required: true, message: '请选择展位' }]}>
                <Select placeholder="请选择展位">
                  {boothList.map((booth) => (
                    <Option key={booth.id} value={booth.id}>
                      {booth.code} - {booth.name}（最大电力：{booth.maxElectricity}kW）
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startDate" label="活动开始日期" rules={[{ required: true, message: '请选择开始日期' }]}>
                <DatePicker style={{ width: '100%' }} onChange={checkConflict} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endDate" label="活动结束日期" rules={[{ required: true, message: '请选择结束日期' }]}>
                <DatePicker style={{ width: '100%' }} onChange={checkConflict} />
              </Form.Item>
            </Col>
          </Row>

          {conflictCheck.checked && (
            <div style={{ marginBottom: 16, padding: 8, background: conflictCheck.hasConflict ? '#fff1f0' : '#f6ffed', borderRadius: 4 }}>
              {conflictCheck.hasConflict ? (
                <Tag color="red">档期冲突警告：该展位此时间段已有预约</Tag>
              ) : (
                <Tag color="green">档期正常：该展位此时间段可用</Tag>
              )}
            </div>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="estimatedSetupDate" label="预计搭建日期" rules={[{ required: true, message: '请选择搭建日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="estimatedTeardownDate" label="预计撤场日期" rules={[{ required: true, message: '请选择撤场日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="purpose" label="活动用途" rules={[{ required: true, message: '请填写活动用途' }]}>
            <TextArea rows={2} placeholder="请简要描述活动用途" />
          </Form.Item>

          <Form.Item name="appliedPower" label="申请电力 (kW)" rules={[{ required: true, message: '请填写申请电力' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入申请的用电量" />
          </Form.Item>

          <Divider>搭建材料清单</Divider>

          <Form.List name="materials">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Row key={field.key} gutter={16} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={6}>
                      <Form.Item {...field} name={[field.name, 'name']} rules={[{ required: true, message: '必填' }]} style={{ margin: 0 }}>
                        <Input placeholder="材料名称" />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item {...field} name={[field.name, 'type']} rules={[{ required: true, message: '必填' }]} style={{ margin: 0 }}>
                        <Select placeholder="类型">
                          <Option value="展台">展台</Option>
                          <Option value="展架">展架</Option>
                          <Option value="背景">背景板</Option>
                          <Option value="灯具">灯具</Option>
                          <Option value="设备">设备</Option>
                          <Option value="其他">其他</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item {...field} name={[field.name, 'quantity']} rules={[{ required: true, message: '必填' }]} style={{ margin: 0 }}>
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="数量" />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item {...field} name={[field.name, 'fireCertified']} initialValue={true} style={{ margin: 0 }}>
                        <Select>
                          <Option value={true}>有消防认证</Option>
                          <Option value={false}>无消防认证</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Button danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)}>
                        移除
                      </Button>
                    </Col>
                  </Row>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加材料
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={onClose}>取消</Button>
              <Button type="primary" onClick={handleSubmit}>
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}

      {activeTab === 'batch' && (
        <Form form={importForm} layout="vertical">
          <Form.Item name="jsonData" label="批量导入数据 (JSON 格式)" rules={[{ required: true, message: '请输入 JSON 数据' }]}>
            <TextArea rows={12} placeholder={sampleImportData} style={{ fontFamily: 'monospace' }} />
          </Form.Item>

          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 16 }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>数据格式说明：</p>
            <pre style={{ margin: 0, fontSize: 12, color: '#666', overflow: 'auto' }}>{sampleImportData}</pre>
          </div>

          <List
            header="可用的品牌和展位 ID"
            size="small"
            dataSource={[
              ...brandList.map((b) => ({ type: '品牌', id: b.id, name: b.name })),
              ...boothList.map((b) => ({ type: '展位', id: b.id, name: `${b.code} - ${b.name}` })),
            ]}
            renderItem={(item) => (
              <List.Item>
                <Tag>{item.type}</Tag>
                <code>{item.id}</code> - {item.name}
              </List.Item>
            )}
          />

          <Form.Item style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={onClose}>取消</Button>
              <Button type="primary" icon={<UploadOutlined />} onClick={handleBatchImport}>
                批量导入
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default CreateApplicationModal;
