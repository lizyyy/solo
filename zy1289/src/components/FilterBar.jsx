import React from 'react';
import { Select, Button, Space, Row, Col } from 'antd';
import { ReloadOutlined, ExportOutlined } from '@ant-design/icons';
import { NOTIFICATION_STATUS, STATUS_LABELS } from '../constants/status';

const { Option } = Select;

const FilterBar = ({ 
  stores, 
  filters, 
  onFilterChange, 
  onRefresh, 
  onExport,
  loading 
}) => {
  const handleStoreChange = (value) => {
    onFilterChange({ ...filters, storeName: value });
  };

  const handleStatusChange = (value) => {
    onFilterChange({ ...filters, status: value });
  };

  const handleReset = () => {
    onFilterChange({ storeName: '', status: '' });
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]} align="middle">
        <Col>
          <Space size="middle">
            <div>
              <span style={{ marginRight: 8 }}>门店：</span>
              <Select
                value={filters.storeName || undefined}
                onChange={handleStoreChange}
                style={{ width: 180 }}
                allowClear
                placeholder="请选择门店"
              >
                {stores.map(store => (
                  <Option key={store} value={store}>{store}</Option>
                ))}
              </Select>
            </div>

            <div>
              <span style={{ marginRight: 8 }}>状态：</span>
              <Select
                value={filters.status || undefined}
                onChange={handleStatusChange}
                style={{ width: 150 }}
                allowClear
                placeholder="请选择状态"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <Option key={value} value={value}>{label}</Option>
                ))}
              </Select>
            </div>
          </Space>
        </Col>

        <Col flex="auto" />

        <Col>
          <Space>
            <Button onClick={handleReset}>
              重置筛选
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={onRefresh}
              loading={loading}
            >
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<ExportOutlined />}
              onClick={onExport}
            >
              导出报告
            </Button>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default FilterBar;
