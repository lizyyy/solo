import React, { useEffect, useState } from 'react';
import { 
  Form, 
  Input, 
  InputNumber, 
  Button, 
  Select, 
  Space, 
  Card, 
  List, 
  Tag,
  message,
  Upload,
  Divider,
  Row,
  Col,
  Modal,
  Empty
} from 'antd';
import { 
  PlusOutlined, 
  UploadOutlined,
  DeleteOutlined,
  SafetyOutlined,
  WarningOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import useStore from '../store';

const { Option } = Select;
const { TextArea } = Input;

function SetupPanel() {
  const { 
    floors, 
    exits, 
    persons,
    currentDrill,
    loadFloors, 
    loadExits, 
    loadPersons,
    createFloor,
    createExit,
    addFirePoint,
    clearAllData,
    loadSampleData,
    selectedFloor,
    setSelectedFloor
  } = useStore();
  
  const [activeTab, setActiveTab] = useState('floors');
  const [form] = Form.useForm();
  const [exitForm] = Form.useForm();
  const [addFloorModal, setAddFloorModal] = useState(false);
  const [addExitModal, setAddExitModal] = useState(false);
  
  useEffect(() => {
    loadFloors();
    loadExits();
    loadPersons();
  }, []);
  
  const handleAddFloor = async (values) => {
    try {
      const floor = await createFloor({
        floor_number: values.floor_number,
        name: values.name || `第${values.floor_number}层`,
        width: values.width || 80,
        height: values.height || 60,
        description: values.description
      });
      
      if (floor) {
        message.success('楼层添加成功');
        setAddFloorModal(false);
        form.resetFields();
      }
    } catch (error) {
      message.error('添加楼层失败: ' + error.message);
    }
  };
  
  const handleAddExit = async (values) => {
    try {
      const exit = await createExit({
        floor_id: values.floor_id,
        name: values.name,
        type: values.type || 'normal',
        status: values.status || 'available',
        x: values.x,
        y: values.y,
        width: values.width || 3,
        capacity_per_minute: values.capacity_per_minute || 10
      });
      
      if (exit) {
        message.success('出口添加成功');
        setAddExitModal(false);
        exitForm.resetFields();
      }
    } catch (error) {
      message.error('添加出口失败: ' + error.message);
    }
  };
  
  const handleLoadSample = async () => {
    try {
      await loadSampleData();
      message.success('示例数据加载成功');
    } catch (error) {
      message.error('加载示例数据失败: ' + error.message);
    }
  };
  
  const handleClear = async () => {
    try {
      await clearAllData();
      message.success('数据已清空');
    } catch (error) {
      message.error('清空数据失败');
    }
  };
  
  const getStatusTag = (status) => {
    const statusMap = {
      'available': { color: 'green', text: '可用' },
      'blocked': { color: 'red', text: '阻塞' },
      'unavailable': { color: 'default', text: '不可用' }
    };
    const info = statusMap[status] || statusMap['available'];
    return <Tag color={info.color}>{info.text}</Tag>;
  };
  
  const getExitTypeTag = (type) => {
    const typeMap = {
      'main': { color: 'blue', text: '主出口' },
      'emergency': { color: 'red', text: '紧急出口' },
      'stairwell': { color: 'purple', text: '楼梯' },
      'normal': { color: 'default', text: '普通出口' }
    };
    const info = typeMap[type] || typeMap['normal'];
    return <Tag color={info.color}>{info.text}</Tag>;
  };
  
  const getExitCount = (floorId) => {
    return exits.filter(e => e.floor_id === floorId).length;
  };
  
  const getPersonCount = (floorId) => {
    return persons.filter(p => p.floor_id === floorId).length;
  };
  
  return (
    <div className="setup-panel">
      <Card 
        size="small"
        title={
          <Space>
            <EnvironmentOutlined />
            <span>环境配置</span>
          </Space>
        }
        extra={
          <Space size="small">
            <Button 
              size="small" 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleLoadSample}
            >
              加载示例数据
            </Button>
            <Button 
              size="small" 
              danger
              onClick={handleClear}
            >
              清空数据
            </Button>
          </Space>
        }
      >
        <div className="setup-tabs">
          <Space.Compact>
            <Button 
              type={activeTab === 'floors' ? 'primary' : 'default'}
              onClick={() => setActiveTab('floors')}
            >
              楼层 ({floors.length})
            </Button>
            <Button 
              type={activeTab === 'exits' ? 'primary' : 'default'}
              onClick={() => setActiveTab('exits')}
            >
              出口 ({exits.length})
            </Button>
            <Button 
              type={activeTab === 'persons' ? 'primary' : 'default'}
              onClick={() => setActiveTab('persons')}
            >
              人员 ({persons.length})
            </Button>
          </Space.Compact>
        </div>
        
        <div className="setup-content">
          {activeTab === 'floors' && (
            <div className="floors-section">
              <div style={{ marginBottom: 12 }}>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setAddFloorModal(true)}
                >
                  添加楼层
                </Button>
              </div>
              
              {floors.length === 0 ? (
                <Empty description="暂无楼层，请添加或加载示例数据" />
              ) : (
                <List
                  size="small"
                  dataSource={floors}
                  renderItem={(floor) => (
                    <List.Item
                      actions={[
                        <Button 
                          key="view" 
                          size="small" 
                          type="link"
                          onClick={() => setSelectedFloor(floor.id)}
                        >
                          查看
                        </Button>
                      ]}
                      style={{
                        background: selectedFloor === floor.id ? '#e6f7ff' : 'transparent',
                        margin: '4px 0',
                        padding: '8px 12px',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedFloor(floor.id)}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{
                            width: 40,
                            height: 40,
                            background: '#1890ff',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            {floor.floor_number}
                          </div>
                        }
                        title={
                          <Space>
                            <strong>{floor.name}</strong>
                            {selectedFloor === floor.id && <Tag color="blue">选中</Tag>}
                          </Space>
                        }
                        description={
                          <Space split="|" size="small">
                            <span>尺寸: {floor.width}×{floor.height}</span>
                            <span>出口: {getExitCount(floor.id)} 个</span>
                            <span>人员: {getPersonCount(floor.id)} 人</span>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>
          )}
          
          {activeTab === 'exits' && (
            <div className="exits-section">
              <div style={{ marginBottom: 12 }}>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setAddExitModal(true)}
                  disabled={floors.length === 0}
                >
                  添加出口
                </Button>
              </div>
              
              {exits.length === 0 ? (
                <Empty description="暂无出口，请先添加楼层" />
              ) : (
                <List
                  size="small"
                  dataSource={exits}
                  renderItem={(exit) => {
                    const floor = floors.find(f => f.id === exit.floor_id);
                    return (
                      <List.Item style={{ padding: '8px 12px' }}>
                        <List.Item.Meta
                          avatar={
                            <div style={{
                              width: 36,
                              height: 36,
                              background: exit.status === 'available' ? '#52c41a' : '#ff4d4f',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <SafetyOutlined style={{ color: 'white' }} />
                            </div>
                          }
                          title={
                            <Space>
                              <strong>{exit.name}</strong>
                              {getStatusTag(exit.status)}
                              {getExitTypeTag(exit.type)}
                            </Space>
                          }
                          description={
                            <Space split="|" size="small">
                              <span>楼层: {floor?.name || '未知'}</span>
                              <span>位置: ({exit.x}, {exit.y})</span>
                              <span>容量: {exit.capacity_per_minute}人/分</span>
                            </Space>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              )}
            </div>
          )}
          
          {activeTab === 'persons' && (
            <div className="persons-section">
              <div style={{ marginBottom: 12 }}>
                <Space>
                  <Upload
                    accept=".csv"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      message.info('CSV导入功能开发中...');
                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />}>导入CSV</Button>
                  </Upload>
                </Space>
              </div>
              
              {persons.length === 0 ? (
                <Empty description="暂无人员数据，请加载示例数据" />
              ) : (
                <div>
                  <Card size="small" style={{ marginBottom: 12 }}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <div className="stat-item">
                          <div className="stat-value" style={{ color: '#1890ff' }}>{persons.length}</div>
                          <div className="stat-label">总人数</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div className="stat-item">
                          <div className="stat-value" style={{ color: '#52c41a' }}>
                            {persons.filter(p => p.status === 'idle').length}
                          </div>
                          <div className="stat-label">待疏散</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div className="stat-item">
                          <div className="stat-value" style={{ color: '#faad14' }}>
                            {persons.filter(p => p.status === 'evacuating').length}
                          </div>
                          <div className="stat-label">疏散中</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div className="stat-item">
                          <div className="stat-value" style={{ color: '#ff4d4f' }}>
                            {persons.filter(p => p.status === 'trapped' || p.status === 'injured').length}
                          </div>
                          <div className="stat-label">异常</div>
                        </div>
                      </Col>
                    </Row>
                  </Card>
                  
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    按楼层分布:
                    {floors.map(f => (
                      <Tag key={f.id} style={{ marginLeft: 4 }}>
                        {f.name}: {getPersonCount(f.id)}人
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
      
      <Modal
        title="添加楼层"
        open={addFloorModal}
        onCancel={() => setAddFloorModal(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddFloor}
          initialValues={{
            floor_number: floors.length + 1,
            width: 80,
            height: 60
          }}
        >
          <Form.Item
            name="floor_number"
            label="楼层编号"
            rules={[{ required: true, message: '请输入楼层编号' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="name"
            label="楼层名称"
            rules={[{ required: true, message: '请输入楼层名称' }]}
          >
            <Input placeholder="例如: 教学楼1层" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="width" label="宽度 (米)">
                <InputNumber min={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="height" label="高度 (米)">
                <InputNumber min={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="楼层描述（可选）" />
          </Form.Item>
          
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
              <Button onClick={() => setAddFloorModal(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      <Modal
        title="添加出口"
        open={addExitModal}
        onCancel={() => setAddExitModal(false)}
        footer={null}
      >
        <Form
          form={exitForm}
          layout="vertical"
          onFinish={handleAddExit}
          initialValues={{
            type: 'normal',
            status: 'available',
            width: 3,
            capacity_per_minute: 10
          }}
        >
          <Form.Item
            name="floor_id"
            label="所属楼层"
            rules={[{ required: true, message: '请选择楼层' }]}
          >
            <Select placeholder="请选择楼层">
              {floors.map(f => (
                <Option key={f.id} value={f.id}>
                  {f.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="name"
            label="出口名称"
            rules={[{ required: true, message: '请输入出口名称' }]}
          >
            <Input placeholder="例如: 东门出口" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="出口类型">
                <Select>
                  <Option value="normal">普通出口</Option>
                  <Option value="main">主出口</Option>
                  <Option value="emergency">紧急出口</Option>
                  <Option value="stairwell">楼梯</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="初始状态">
                <Select>
                  <Option value="available">可用</Option>
                  <Option value="blocked">阻塞</Option>
                  <Option value="unavailable">不可用</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="x" label="X 坐标">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0-100" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="y" label="Y 坐标">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0-100" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="width" label="出口宽度">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="capacity_per_minute" label="每分钟容量">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="1-50" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
              <Button onClick={() => setAddExitModal(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default SetupPanel;
