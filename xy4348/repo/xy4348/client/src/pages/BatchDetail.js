import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Tabs,
  Upload,
  message,
  Progress,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Space,
  Divider,
  List,
  Descriptions,
  Empty,
  Spin
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  GlobalOutlined,
  BarChartOutlined,
  FileTextOutlined,
  SafetyOutlined,
  WarningOutlined,
  CameraOutlined,
  EyeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { batchApi, conditionApi } from '../api';
import dayjs from 'dayjs';
import _ from 'lodash';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

// 自定义图标
const createCustomIcon = (color, count) => {
  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="
      background-color: ${color};
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">${count}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
};

// 地图中心调整组件
function MapCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 14);
    }
  }, [center, map]);
  return null;
}

function BatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [batch, setBatch] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [highRiskSegments, setHighRiskSegments] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentDetails, setSegmentDetails] = useState(null);
  const [isSegmentModalVisible, setIsSegmentModalVisible] = useState(false);
  const [isOverruleModalVisible, setIsOverruleModalVisible] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [overruleForm] = Form.useForm();
  const [mapCenter, setMapCenter] = useState([39.9042, 116.4074]); // 默认北京
  const [activeTab, setActiveTab] = useState('map');

  // 加载批次详情
  const loadBatchDetail = async () => {
    setLoading(true);
    try {
      // 获取批次基本信息和统计
      const batchResult = await batchApi.getById(id);
      if (batchResult.success) {
        setBatch(batchResult.data.batch);
        setStatistics(batchResult.data.statistics);
      }
      
      // 获取路线数据
      const routesResult = await batchApi.getRoutes(id);
      if (routesResult.success) {
        setRoutes(routesResult.data);
        
        // 如果有路线，设置地图中心
        if (routesResult.data.length > 0 && routesResult.data[0].waypoints.length > 0) {
          const firstPoint = routesResult.data[0].waypoints[0];
          setMapCenter([firstPoint.latitude, firstPoint.longitude]);
        }
      }
      
      // 获取高风险路段
      const riskResult = await batchApi.getHighRisk(id, { minScore: 3.0, limit: 50 });
      if (riskResult.success) {
        setHighRiskSegments(riskResult.data.segments || []);
      }
    } catch (error) {
      message.error('加载批次详情失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadBatchDetail();
    }
  }, [id]);

  // 文件上传
  const handleUpload = async (options) => {
    const { file, onSuccess, onError, onProgress } = options;
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      
      // 根据文件类型分类
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.gpx')) {
        formData.append('gpx', file);
      } else if (fileName.endsWith('.csv')) {
        // 简单判断是路况CSV还是照片索引CSV
        // 实际应用中可能需要更复杂的判断或让用户选择
        formData.append('road_csv', file);
      }
      
      const result = await batchApi.uploadFiles(id, formData, (percent) => {
        setUploadProgress(percent);
        if (onProgress) {
          onProgress({ percent });
        }
      });
      
      if (result.success) {
        message.success('文件上传处理成功');
        onSuccess(result);
        // 重新加载数据
        loadBatchDetail();
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      message.error('文件上传失败: ' + (error.response?.data?.error || error.message));
      onError(error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // 查看路段详情
  const handleViewSegment = async (segment) => {
    setSelectedSegment(segment);
    try {
      const result = await batchApi.getSegmentDetails(id, segment.segment_id);
      if (result.success) {
        setSegmentDetails(result.data);
        setIsSegmentModalVisible(true);
      }
    } catch (error) {
      message.error('获取路段详情失败');
    }
  };

  // 人工改判
  const handleOverrule = (condition) => {
    setSelectedCondition(condition);
    overruleForm.setFieldsValue({
      is_overruled: !condition.is_overruled,
      reason: condition.overrule_reason || ''
    });
    setIsOverruleModalVisible(true);
  };

  // 提交改判
  const submitOverrule = async (values) => {
    try {
      const result = await conditionApi.overrule(selectedCondition.id, {
        is_overruled: values.is_overruled,
        reason: values.reason,
        overruled_by: '当前用户'
      });
      
      if (result.success) {
        message.success(result.message);
        setIsOverruleModalVisible(false);
        overruleForm.resetFields();
        // 重新加载数据
        loadBatchDetail();
        // 如果正在查看路段详情，也刷新
        if (selectedSegment) {
          const result = await batchApi.getSegmentDetails(id, selectedSegment.segment_id);
          if (result.success) {
            setSegmentDetails(result.data);
          }
        }
      }
    } catch (error) {
      message.error('改判失败: ' + (error.response?.data?.error || error.message));
    }
  };

  // 导出Markdown
  const handleExportMarkdown = async () => {
    try {
      const result = await batchApi.exportMarkdown(id);
      if (result.success) {
        message.success('Markdown 报告生成成功');
        // 打开下载链接
        window.open(result.data.downloadUrl, '_blank');
      }
    } catch (error) {
      message.error('导出失败: ' + (error.response?.data?.error || error.message));
    }
  };

  // 导出JSON
  const handleExportJson = async () => {
    try {
      const result = await batchApi.exportJson(id);
      if (result.success) {
        message.success('JSON 审计包生成成功');
        // 打开下载链接
        window.open(result.data.downloadUrl, '_blank');
      }
    } catch (error) {
      message.error('导出失败: ' + (error.response?.data?.error || error.message));
    }
  };

  // 重新分析
  const handleReanalyze = async () => {
    setLoading(true);
    try {
      const result = await batchApi.analyze(id);
      if (result.success) {
        message.success(`风险分析完成，共 ${result.data.aggregationCount} 个风险聚合`);
        loadBatchDetail();
      }
    } catch (error) {
      message.error('分析失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 准备图表数据
  const getPieChartData = () => {
    if (!statistics || !statistics.typeStats) return [];
    return statistics.typeStats.map(stat => ({
      name: stat.condition_type_name,
      value: stat.count,
      color: stat.color
    }));
  };

  const getBarChartData = () => {
    if (!statistics || !statistics.typeStats) return [];
    return statistics.typeStats.map(stat => ({
      name: stat.condition_type_name,
      高风险: stat.high_count,
      中风险: stat.medium_count,
      低风险: stat.low_count
    }));
  };

  // 高风险路段表格列
  const riskColumns = [
    {
      title: '风险类型',
      dataIndex: 'condition_type_name',
      key: 'condition_type_name',
      width: 120,
      render: (text, record) => (
        <Tag color={record.color}>{text}</Tag>
      )
    },
    {
      title: '风险次数',
      dataIndex: 'risk_count',
      key: 'risk_count',
      width: 100,
      sorter: (a, b) => a.risk_count - b.risk_count
    },
    {
      title: '最大严重程度',
      dataIndex: 'max_severity',
      key: 'max_severity',
      width: 120,
      render: (text) => {
        const severityMap = {
          high: { text: '高', color: 'red' },
          medium: { text: '中', color: 'orange' },
          low: { text: '低', color: 'green' }
        };
        const severity = severityMap[text] || { text: text, color: 'default' };
        return <Tag color={severity.color}>{severity.text}</Tag>;
      }
    },
    {
      title: '风险分数',
      dataIndex: 'risk_score',
      key: 'risk_score',
      width: 100,
      sorter: (a, b) => a.risk_score - b.risk_score,
      render: (score) => (
        <span style={{ 
          fontWeight: 'bold', 
          color: score >= 10 ? '#ff4d4f' : score >= 5 ? '#faad14' : '#52c41a' 
        }}>
          {score.toFixed(1)}
        </span>
      )
    },
    {
      title: '照片证据',
      dataIndex: 'photo_count',
      key: 'photo_count',
      width: 100
    },
    {
      title: '路线',
      dataIndex: 'route_name',
      key: 'route_name',
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => handleViewSegment(record)}
        >
          详情
        </Button>
      )
    }
  ];

  const COLORS = ['#ff4d4f', '#faad14', '#ff7875', '#ffc53d', '#40a9ff', '#ffa940', '#8c8c8c'];

  return (
    <div>
      {/* 顶部导航和标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/batches')}
          style={{ marginBottom: '16px' }}
        >
          返回批次列表
        </Button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0' }}>{batch?.name || '加载中...'}</h1>
            {batch?.description && (
              <p style={{ margin: 0, color: '#666' }}>{batch.description}</p>
            )}
            <p style={{ margin: '8px 0 0 0', color: '#999', fontSize: '13px' }}>
              创建时间: {batch?.created_at ? dayjs(batch.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </p>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReanalyze} loading={loading}>
              重新分析
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExportMarkdown}>
              导出 Markdown
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportJson}>
              导出 JSON 审计包
            </Button>
          </Space>
        </div>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="总风险报告"
              value={statistics?.totalRisks || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="高风险路段"
              value={statistics?.highRiskSegments || 0}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="路线数量"
              value={routes.length}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="照片证据"
              value={statistics?.totalPhotos || 0}
              prefix={<CameraOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 文件上传区域 */}
      <Card title="文件上传" style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Upload.Dragger
              name="gpx"
              customRequest={handleUpload}
              accept=".gpx"
              multiple
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <GlobalOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">上传 GPX 路线文件</p>
              <p className="ant-upload-hint">支持 .gpx 格式，可上传多个文件</p>
            </Upload.Dragger>
          </Col>
          <Col xs={24} md={8}>
            <Upload.Dragger
              name="road_csv"
              customRequest={handleUpload}
              accept=".csv"
              multiple
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <FileTextOutlined style={{ fontSize: '48px', color: '#faad14' }} />
              </p>
              <p className="ant-upload-text">上传路况 CSV 文件</p>
              <p className="ant-upload-hint">支持 .csv 格式的路况报告</p>
            </Upload.Dragger>
          </Col>
          <Col xs={24} md={8}>
            <Upload.Dragger
              name="photo_csv"
              customRequest={handleUpload}
              accept=".csv"
              multiple
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <CameraOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
              </p>
              <p className="ant-upload-text">上传照片索引 CSV</p>
              <p className="ant-upload-hint">支持 .csv 格式的照片索引</p>
            </Upload.Dragger>
          </Col>
        </Row>
        {uploading && (
          <div style={{ marginTop: '16px' }}>
            <Progress percent={uploadProgress} status="active" />
          </div>
        )}
      </Card>

      {/* 主要内容标签页 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* 地图视图 */}
          <TabPane tab={<span><GlobalOutlined />地图视图</span>} key="map">
            <div style={{ height: '600px', position: 'relative' }}>
              {routes.length > 0 ? (
                <MapContainer
                  center={mapCenter}
                  zoom={14}
                  style={{ height: '100%', width: '100%' }}
                >
                  <MapCenter center={mapCenter} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* 绘制路线 */}
                  {routes.map((route, routeIndex) => {
                    const positions = route.waypoints.map(wp => [wp.latitude, wp.longitude]);
                    const colors = ['#1890ff', '#52c41a', '#722ed1', '#eb2f96'];
                    return (
                      <Polyline
                        key={route.id}
                        positions={positions}
                        color={colors[routeIndex % colors.length]}
                        weight={4}
                        opacity={0.8}
                      >
                        <Popup>
                          <div>
                            <strong>{route.name}</strong>
                            <p style={{ margin: '4px 0', fontSize: '12px' }}>
                              距离: {route.total_distance ? (route.total_distance / 1000).toFixed(2) + ' km' : '-'}
                            </p>
                            <p style={{ margin: '4px 0', fontSize: '12px' }}>
                              路点数: {route.waypoints.length}
                            </p>
                          </div>
                        </Popup>
                      </Polyline>
                    );
                  })}
                  
                  {/* 绘制高风险路段标记 */}
                  {highRiskSegments.map((segment, index) => {
                    const centerLat = (segment.start_latitude + segment.end_latitude) / 2;
                    const centerLon = (segment.start_longitude + segment.end_longitude) / 2;
                    
                    return (
                      <Marker
                        key={segment.id}
                        position={[centerLat, centerLon]}
                        icon={createCustomIcon(segment.color, segment.risk_count)}
                      >
                        <Popup>
                          <div style={{ minWidth: '200px' }}>
                            <div style={{ 
                              background: segment.color, 
                              color: 'white', 
                              padding: '8px 12px', 
                              margin: '-1px -1px 0 -1px',
                              borderRadius: '6px 6px 0 0'
                            }}>
                              <strong>{segment.condition_type_name}</strong>
                              <Tag 
                                color={segment.max_severity === 'high' ? 'red' : segment.max_severity === 'medium' ? 'orange' : 'green'}
                                style={{ marginLeft: '8px' }}
                              >
                                {segment.max_severity === 'high' ? '高风险' : segment.max_severity === 'medium' ? '中风险' : '低风险'}
                              </Tag>
                            </div>
                            <div style={{ padding: '12px' }}>
                              <p style={{ margin: '4px 0' }}>
                                <strong>风险次数:</strong> {segment.risk_count} 次
                              </p>
                              <p style={{ margin: '4px 0' }}>
                                <strong>风险分数:</strong> <span style={{ fontWeight: 'bold', color: segment.color }}>{segment.risk_score.toFixed(1)}</span>
                              </p>
                              <p style={{ margin: '4px 0' }}>
                                <strong>照片证据:</strong> {segment.photo_count} 张
                              </p>
                              <p style={{ margin: '4px 0' }}>
                                <strong>路线:</strong> {segment.route_name}
                              </p>
                              <Divider style={{ margin: '12px 0' }} />
                              <Button 
                                type="primary" 
                                size="small" 
                                block
                                onClick={() => handleViewSegment(segment)}
                              >
                                查看详情
                              </Button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <Empty 
                  description="暂无路线数据，请先上传 GPX 文件"
                  style={{ padding: '100px 0' }}
                />
              )}
            </div>
          </TabPane>

          {/* 风险分析 */}
          <TabPane tab={<span><BarChartOutlined />风险分析</span>} key="analysis">
            <Row gutter={[24, 24]}>
              {/* 饼图 */}
              <Col xs={24} lg={12}>
                <Card title="风险类型分布">
                  {getPieChartData().length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={getPieChartData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getPieChartData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="暂无数据" style={{ padding: '60px 0' }} />
                  )}
                </Card>
              </Col>

              {/* 柱状图 */}
              <Col xs={24} lg={12}>
                <Card title="风险严重程度分布">
                  {getBarChartData().length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={getBarChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="高风险" fill="#ff4d4f" />
                        <Bar dataKey="中风险" fill="#faad14" />
                        <Bar dataKey="低风险" fill="#52c41a" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="暂无数据" style={{ padding: '60px 0' }} />
                  )}
                </Card>
              </Col>
            </Row>

            {/* 高风险路段列表 */}
            <Card title="高风险路段列表" style={{ marginTop: '24px' }}>
              {highRiskSegments.length > 0 ? (
                <Table
                  columns={riskColumns}
                  dataSource={highRiskSegments}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              ) : (
                <Empty 
                  description="暂无高风险路段数据，请先上传路况文件并进行分析"
                  style={{ padding: '60px 0' }}
                />
              )}
            </Card>
          </TabPane>

          {/* 路线列表 */}
          <TabPane tab={<span><FileTextOutlined />路线列表</span>} key="routes">
            {routes.length > 0 ? (
              <List
                grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
                dataSource={routes}
                renderItem={route => (
                  <List.Item>
                    <Card 
                      hoverable
                      title={
                        <Space>
                          <GlobalOutlined />
                          {route.name}
                        </Space>
                      }
                    >
                      <Descriptions size="small" column={1}>
                        <Descriptions.Item label="路点数">{route.waypoints.length}</Descriptions.Item>
                        <Descriptions.Item label="总距离">
                          {route.total_distance ? (route.total_distance / 1000).toFixed(2) + ' km' : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="总时长">
                          {route.total_duration ? Math.round(route.total_duration / 60) + ' 分钟' : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="创建时间">
                          {route.created_at ? dayjs(route.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </List.Item>
                )}
              />
            ) : (
              <Empty 
                description="暂无路线数据，请先上传 GPX 文件"
                style={{ padding: '100px 0' }}
              />
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* 路段详情模态框 */}
      <Modal
        title={
          <Space>
            <Tag color={selectedSegment?.color}>{selectedSegment?.condition_type_name}</Tag>
            <span>路段详情</span>
          </Space>
        }
        open={isSegmentModalVisible}
        onCancel={() => setIsSegmentModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setIsSegmentModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {segmentDetails && (
          <div>
            {/* 路段基本信息 */}
            <Card title="路段基本信息" size="small" style={{ marginBottom: '16px' }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="路线名称">{segmentDetails.segment.route_name}</Descriptions.Item>
                <Descriptions.Item label="路段长度">
                  {segmentDetails.segment.segment_length ? (segmentDetails.segment.segment_length).toFixed(1) + ' 米' : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="起点坐标">
                  ({segmentDetails.segment.start_latitude?.toFixed(6)}, {segmentDetails.segment.start_longitude?.toFixed(6)})
                </Descriptions.Item>
                <Descriptions.Item label="终点坐标">
                  ({segmentDetails.segment.end_latitude?.toFixed(6)}, {segmentDetails.segment.end_longitude?.toFixed(6)})
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 风险聚合统计 */}
            <Card title="风险聚合统计" size="small" style={{ marginBottom: '16px' }}>
              {segmentDetails.riskAggregations.length > 0 ? (
                <List
                  dataSource={segmentDetails.riskAggregations}
                  renderItem={agg => (
                    <List.Item>
                      <Space>
                        <Tag color={agg.color}>{agg.condition_type_name}</Tag>
                        <span>风险次数: <strong>{agg.risk_count}</strong></span>
                        <span>最高严重程度: <Tag color={agg.max_severity === 'high' ? 'red' : agg.max_severity === 'medium' ? 'orange' : 'green'}>
                          {agg.max_severity === 'high' ? '高' : agg.max_severity === 'medium' ? '中' : '低'}
                        </Tag></span>
                        <span>风险分数: <strong style={{ color: agg.color }}>{agg.risk_score.toFixed(1)}</strong></span>
                        <span>照片证据: <strong>{agg.photo_count}</strong> 张</span>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无聚合数据" style={{ padding: '20px 0' }} />
              )}
            </Card>

            {/* 路况报告列表 */}
            <Card title="路况报告列表" size="small">
              {segmentDetails.conditions.length > 0 ? (
                <Table
                  dataSource={segmentDetails.conditions}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 5 }}
                  columns={[
                    {
                      title: '风险类型',
                      dataIndex: 'condition_type_name',
                      key: 'condition_type_name',
                      render: (text, record) => (
                        <Tag color={record.color}>{text}</Tag>
                      )
                    },
                    {
                      title: '严重程度',
                      dataIndex: 'severity',
                      key: 'severity',
                      render: (text) => {
                        const colorMap = { high: 'red', medium: 'orange', low: 'green' };
                        const textMap = { high: '高', medium: '中', low: '低' };
                        return <Tag color={colorMap[text]}>{textMap[text] || text}</Tag>;
                      }
                    },
                    {
                      title: '描述',
                      dataIndex: 'description',
                      key: 'description',
                      ellipsis: true,
                      render: (text) => text || '-'
                    },
                    {
                      title: '速度',
                      dataIndex: 'speed',
                      key: 'speed',
                      render: (v) => v ? v.toFixed(1) + ' km/h' : '-'
                    },
                    {
                      title: '照片',
                      dataIndex: 'photos',
                      key: 'photos',
                      render: (photos) => photos?.length > 0 ? (
                        <Tag color="blue">{photos.length} 张</Tag>
                      ) : '-'
                    },
                    {
                      title: '状态',
                      dataIndex: 'is_overruled',
                      key: 'is_overruled',
                      render: (isOverruled) => (
                        isOverruled ? (
                          <Tag color="default" icon={<CloseOutlined />}>已改判</Tag>
                        ) : (
                          <Tag color="green" icon={<CheckOutlined />}>有效</Tag>
                        )
                      )
                    },
                    {
                      title: '操作',
                      key: 'action',
                      render: (_, record) => (
                        <Button 
                          type="link" 
                          size="small"
                          onClick={() => handleOverrule(record)}
                        >
                          人工改判
                        </Button>
                      )
                    }
                  ]}
                />
              ) : (
                <Empty description="暂无路况报告" style={{ padding: '20px 0' }} />
              )}
            </Card>
          </div>
        )}
      </Modal>

      {/* 人工改判模态框 */}
      <Modal
        title="人工改判"
        open={isOverruleModalVisible}
        onCancel={() => {
          setIsOverruleModalVisible(false);
          overruleForm.resetFields();
        }}
        onOk={() => overruleForm.submit()}
        okText="确认"
        cancelText="取消"
      >
        <Form
          form={overruleForm}
          layout="vertical"
          onFinish={submitOverrule}
        >
          <Form.Item label="当前路况信息">
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="风险类型">
                <Tag color={selectedCondition?.color}>{selectedCondition?.condition_type_name}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="严重程度">
                {selectedCondition?.severity === 'high' ? '高' : selectedCondition?.severity === 'medium' ? '中' : '低'}
              </Descriptions.Item>
              <Descriptions.Item label="描述">
                {selectedCondition?.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                {selectedCondition?.is_overruled ? (
                  <Tag color="default">已标记为无效</Tag>
                ) : (
                  <Tag color="green">有效风险</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Form.Item>

          <Form.Item
            name="is_overruled"
            label="改判操作"
            rules={[{ required: true, message: '请选择改判操作' }]}
          >
            <Select>
              <Option value={true}>
                <Space>
                  <CloseOutlined style={{ color: '#ff4d4f' }} />
                  标记为无效风险
                </Space>
              </Option>
              <Option value={false}>
                <Space>
                  <CheckOutlined style={{ color: '#52c41a' }} />
                  恢复为有效风险
                </Space>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reason"
            label="改判原因"
            rules={[{ required: true, message: '请输入改判原因' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请输入改判的原因说明..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BatchDetail;
