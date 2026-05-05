import React, { useState } from 'react';
import {
  Card,
  Button,
  Upload,
  message,
  Divider,
  Alert,
  Descriptions,
  Spin,
  Space,
} from 'antd';
import {
  UploadOutlined,
  FileTextOutlined,
  CarOutlined,
  UserOutlined,
  CalendarOutlined,
  MoneyCollectOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { importAPI } from '../utils/api';

const { Dragger } = Upload;

function ImportData() {
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState(null);

  const handleUpload = async (file, type) => {
    setLoading(true);
    setUploadingType(type);
    
    try {
      let response;
      switch (type) {
        case 'plots':
          response = await importAPI.importPlots(file);
          break;
        case 'machines':
          response = await importAPI.importMachines(file);
          break;
        case 'operators':
          response = await importAPI.importOperators(file);
          break;
        case 'reservations':
          response = await importAPI.importReservations(file);
          break;
        case 'subsidies':
          response = await importAPI.importSubsidies(file);
          break;
        default:
          throw new Error('未知的导入类型');
      }
      
      message.success(response.data.message);
    } catch (error) {
      message.error('导入失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
      setUploadingType(null);
    }
  };

  const handleImportSample = async () => {
    setLoading(true);
    try {
      const response = await importAPI.importSample();
      message.success('示例数据导入成功');
      console.log('导入结果:', response.data);
    } catch (error) {
      message.error('导入示例数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getUploadProps = (type) => ({
    beforeUpload: (file) => {
      const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
      if (!isCSV) {
        message.error('请上传 CSV 格式的文件');
        return false;
      }
      handleUpload(file, type);
      return false;
    },
  });

  return (
    <Spin spinning={loading}>
      <div className="page-header">
        <h2>数据导入</h2>
        <p>导入农户地块、机具、机手、预约和油料补贴数据</p>
      </div>

      <Alert
        message="快速开始"
        description={
          <div>
            <p>点击下方按钮导入示例数据，快速体验系统功能。示例数据包含：</p>
            <ul style={{ margin: '8px 0 0 20px' }}>
              <li>3 个农户地块（50.5亩、35.2亩、80亩）</li>
              <li>3 台机具（拖拉机、收割机等）</li>
              <li>3 位机手（部分证照过期用于测试风险校验）</li>
              <li>4 个预约（包含时段冲突用于测试校验）</li>
              <li>3 条油料补贴记录</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        action={
          <Button
            type="primary"
            icon={<DatabaseOutlined />}
            onClick={handleImportSample}
            size="large"
          >
            导入示例数据
          </Button>
        }
        style={{ marginBottom: 24 }}
      />

      <Divider>或从 CSV 文件导入</Divider>

      <Card title="CSV 格式说明" className="card-margin">
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="地块 CSV 字段">
            农户姓名(farmer_name)、地块名称(plot_name)、面积(area)、位置(location)、作物类型(crop_type)
          </Descriptions.Item>
          <Descriptions.Item label="机具 CSV 字段">
            机具名称(machine_name)、机具类型(machine_type)、车牌号(license_plate)、上次保养日期(last_maintenance)、保养间隔(天)(maintenance_interval_days)
          </Descriptions.Item>
          <Descriptions.Item label="机手 CSV 字段">
            机手姓名(operator_name)、身份证号(id_card)、驾驶证类型(license_type)、驾驶证号(license_number)、驾驶证到期日期(license_expiry)、联系电话(phone)
          </Descriptions.Item>
          <Descriptions.Item label="预约 CSV 字段">
            地块名称(plot_name)、机具名称(machine_name)、机手姓名(operator_name)、开始时间(start_time)、结束时间(end_time)、作业类型(work_type)
          </Descriptions.Item>
          <Descriptions.Item label="油料补贴 CSV 字段">
            地块名称(plot_name)、补贴金额(元)(subsidy_amount)、油耗(L)(fuel_consumption)、补贴日期(subsidy_date)
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <Card title={
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            地块数据
          </Space>
        }>
          <Dragger {...getUploadProps('plots')} accept=".csv">
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传地块 CSV 文件</p>
            <p className="ant-upload-hint">仅支持 CSV 格式文件</p>
          </Dragger>
        </Card>

        <Card title={
          <Space>
            <CarOutlined style={{ color: '#52c41a' }} />
            机具数据
          </Space>
        }>
          <Dragger {...getUploadProps('machines')} accept=".csv">
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传机具 CSV 文件</p>
            <p className="ant-upload-hint">仅支持 CSV 格式文件</p>
          </Dragger>
        </Card>

        <Card title={
          <Space>
            <UserOutlined style={{ color: '#722ed1' }} />
            机手数据
          </Space>
        }>
          <Dragger {...getUploadProps('operators')} accept=".csv">
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传机手 CSV 文件</p>
            <p className="ant-upload-hint">仅支持 CSV 格式文件</p>
          </Dragger>
        </Card>

        <Card title={
          <Space>
            <CalendarOutlined style={{ color: '#faad14' }} />
            预约数据
          </Space>
        }>
          <Dragger {...getUploadProps('reservations')} accept=".csv">
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传预约 CSV 文件</p>
            <p className="ant-upload-hint">仅支持 CSV 格式文件，需先导入地块、机具、机手数据</p>
          </Dragger>
        </Card>

        <Card title={
          <Space>
            <MoneyCollectOutlined style={{ color: '#eb2f96' }} />
            油料补贴数据
          </Space>
        }>
          <Dragger {...getUploadProps('subsidies')} accept=".csv">
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传油料补贴 CSV 文件</p>
            <p className="ant-upload-hint">仅支持 CSV 格式文件，需先导入地块数据</p>
          </Dragger>
        </Card>
      </div>
    </Spin>
  );
}

export default ImportData;
