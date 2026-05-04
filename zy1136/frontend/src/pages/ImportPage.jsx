import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Upload,
  Button,
  message,
  Spin,
  Descriptions,
  Divider,
  Alert,
  Table,
  Tag,
} from 'antd';
import {
  UploadOutlined,
  DesktopOutlined,
  ShareAltOutlined,
  GlobalOutlined,
  SafetyOutlined,
  BellOutlined,
  ApartmentOutlined,
  ServerOutlined,
} from '@ant-design/icons';
import { importAPI } from '../services/api';

const ImportPage = () => {
  const [loading, setLoading] = useState(false);
  const [importResults, setImportResults] = useState({});
  const [selectedType, setSelectedType] = useState(null);

  const importTypes = [
    {
      key: 'assets',
      label: '资产数据',
      icon: <DesktopOutlined />,
      description: '导入电脑、服务器、打印机等设备资产',
      fileFormat: 'CSV',
      example: `name,type,mac_address,department,owner,location,status
办公电脑-001,computer,00:11:22:33:44:55,技术部,张三,1楼机房,active`,
      api: importAPI.importAssets,
    },
    {
      key: 'topology',
      label: '拓扑数据',
      icon: <ShareAltOutlined />,
      description: '导入网络拓扑关系',
      fileFormat: 'JSON',
      example: `{
  "nodes": [
    {"id": "1", "name": "核心交换机", "type": "switch", "mac_address": "00:11:22:33:44:01"},
    {"id": "2", "name": "服务器-001", "type": "server", "mac_address": "00:11:22:33:44:02"}
  ],
  "edges": [
    {"source": "1", "target": "2", "type": "connected", "relationship_type": "uplink"}
  ]
}`,
      api: importAPI.importTopology,
    },
    {
      key: 'dhcp-leases',
      label: 'DHCP租约',
      icon: <GlobalOutlined />,
      description: '导入DHCP服务器租约记录',
      fileFormat: 'CSV',
      example: `ip,mac_address,hostname,start_time,expire_time,status
192.168.1.100,00:11:22:33:44:55,PC-001,2024-01-01T00:00:00,2024-01-02T00:00:00,active`,
      api: importAPI.importDHCPLeases,
    },
    {
      key: 'firewall-rules',
      label: '防火墙规则',
      icon: <SafetyOutlined />,
      description: '导入防火墙访问规则',
      fileFormat: 'CSV',
      example: `rule_number,name,action,source,destination,protocol,ports,description
1,允许办公网访问互联网,allow,192.168.1.0/24,any,tcp,80;443,办公网HTTP/HTTPS访问
2,拒绝外部访问SSH,deny,any,192.168.1.0/24,tcp,22,禁止外部SSH访问`,
      api: importAPI.importFirewallRules,
    },
    {
      key: 'alerts',
      label: '告警数据',
      icon: <BellOutlined />,
      description: '导入历史告警记录',
      fileFormat: 'JSONL',
      example: `{"title":"IP地址冲突","type":"ip_conflict","severity":"critical","ip_address":"192.168.1.100","description":"检测到IP冲突"}
{"title":"网段利用率过高","type":"high_utilization","severity":"high","description":"网段利用率超过90%"}`,
      api: importAPI.importAlerts,
    },
    {
      key: 'segments',
      label: '网段数据',
      icon: <ApartmentOutlined />,
      description: '导入网络网段配置',
      fileFormat: 'CSV',
      example: `name,cidr,gateway,dns_servers,vlan_id,description
办公网-1楼,192.168.1.0/24,192.168.1.1,8.8.8.8;8.8.4.4,10,一楼办公网段
服务器网段,192.168.10.0/24,192.168.10.1,8.8.8.8,20,服务器专用网段`,
      api: importAPI.importSegments,
    },
    {
      key: 'vlans',
      label: 'VLAN数据',
      icon: <ServerOutlined />,
      description: '导入VLAN配置',
      fileFormat: 'CSV',
      example: `vlan_id,name,type,is_guest,description
10,办公VLAN,data,false,办公网络VLAN
20,服务器VLAN,data,false,服务器VLAN
30,访客VLAN,guest,true,访客网络VLAN`,
      api: importAPI.importVLANs,
    },
  ];

  const handleImport = async (file, type) => {
    try {
      setLoading(true);
      setSelectedType(type.key);
      
      const response = await type.api(file);
      
      if (response.data.success) {
        setImportResults(prev => ({
          ...prev,
          [type.key]: response.data.data
        }));
        message.success('导入成功');
      } else {
        message.error(response.data.error || '导入失败');
      }
    } catch (error) {
      message.error(error.response?.data?.error || '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const renderImportCard = (type) => {
    const result = importResults[type.key];
    
    return (
      <Col xs={24} md={12} lg={8} key={type.key}>
        <Card
          title={
            <span>
              {type.icon} {type.label}
            </span>
          }
          size="small"
          style={{ marginBottom: 16 }}
        >
          <p style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
            {type.description}
          </p>
          <p style={{ marginBottom: 8 }}>
            <Tag color="blue">{type.fileFormat}</Tag>
          </p>
          
          <Upload
            beforeUpload={(file) => {
              handleImport(file, type);
              return false;
            }}
            showUploadList={false}
            accept={type.fileFormat === 'JSON' ? '.json' : 
                   type.fileFormat === 'JSONL' ? '.jsonl' : '.csv'}
          >
            <Button 
              icon={<UploadOutlined />} 
              loading={loading && selectedType === type.key}
            >
              选择文件
            </Button>
          </Upload>

          {result && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Descriptions column={1} size="small">
                <Descriptions.Item label="总计">
                  {result.total || 0}
                </Descriptions.Item>
                <Descriptions.Item label="成功">
                  <Tag color="green">{result.successCount || 0}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="失败">
                  {result.errorCount > 0 ? (
                    <Tag color="red">{result.errorCount}</Tag>
                  ) : 0}
                </Descriptions.Item>
              </Descriptions>

              {result.errors && result.errors.length > 0 && (
                <Alert
                  message="导入错误详情"
                  type="warning"
                  showIcon
                  style={{ marginTop: 8 }}
                >
                  <Table
                    dataSource={result.errors}
                    rowKey="row"
                    pagination={false}
                    size="small"
                  >
                    <Table.Column title="行号" dataIndex="row" />
                    <Table.Column 
                      title="错误" 
                      dataIndex="error" 
                      ellipsis
                    />
                  </Table>
                </Alert>
              )}
            </>
          )}
        </Card>
      </Col>
    );
  };

  return (
    <Spin spinning={loading}>
      <Alert
        message="数据导入说明"
        description="请按照以下格式准备数据文件，支持 CSV、JSON、JSONL 格式。导入时会自动校验数据格式，错误数据将被跳过并显示详细错误信息。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={[16, 16]}>
        {importTypes.map(renderImportCard)}
      </Row>

      <Card title="文件格式示例" style={{ marginTop: 24 }}>
        {importTypes.map((type) => (
          <div key={type.key} style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 8 }}>
              {type.icon} {type.label} ({type.fileFormat})
            </h4>
            <pre
              style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 4,
                fontSize: 12,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {type.example}
            </pre>
          </div>
        ))}
      </Card>
    </Spin>
  );
};

export default ImportPage;
