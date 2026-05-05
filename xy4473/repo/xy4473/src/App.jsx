import React, { useState, useEffect } from 'react';
import { Layout, Typography, Tabs, Input, Space, Button, message, Modal, Tag, Statistic, Row, Col } from 'antd';
import {
  DeleteOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  HighlightOutlined,
} from '@ant-design/icons';
import Bridge3D from './components/Bridge3D';
import DataImport, { ImportTypes } from './components/DataImport';
import ComponentDetail from './components/ComponentDetail';
import ExportPanel from './components/ExportPanel';
import { analyzeAllComponents } from './utils/riskAnalysis';
import { loadAllData, saveAllData, clearAllData } from './utils/storage';
import { RiskLevel, RiskLevelLabels, RiskLevelColors, ActionType, ActionTypeLabels } from './types';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function StatisticsPanel({ analyzedComponents, userOverrides }) {
  const stats = {
    total: analyzedComponents.length,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
    retest: 0,
    restrict: 0,
    immediate: 0,
  };

  analyzedComponents.forEach((comp) => {
    const analysis = comp.analysis || {};
    const riskLevel = analysis.riskLevel || RiskLevel.LOW;
    const actionType = userOverrides?.[comp.id] || analysis.actionType || ActionType.NORMAL;

    stats[riskLevel] = (stats[riskLevel] || 0) + 1;
    if (actionType !== ActionType.NORMAL) {
      stats[actionType] = (stats[actionType] || 0) + 1;
    }
  });

  if (stats.total === 0) {
    return null;
  }

  return (
    <div style={{ padding: '8px 16px', background: '#f5f5f5', borderBottom: '1px solid #d9d9d9' }}>
      <Row gutter={16}>
        <Col span={6}>
          <Statistic
            title="总构件数"
            value={stats.total}
            prefix={<SafetyCertificateOutlined />}
            valueStyle={{ fontSize: 18 }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="低风险"
            value={stats.low}
            valueStyle={{ color: RiskLevelColors[RiskLevel.LOW], fontSize: 18 }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="中风险"
            value={stats.medium}
            valueStyle={{ color: RiskLevelColors[RiskLevel.MEDIUM], fontSize: 18 }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="高/严重风险"
            value={stats.high + stats.critical}
            valueStyle={{ color: RiskLevelColors[RiskLevel.HIGH], fontSize: 18 }}
            prefix={<WarningOutlined />}
          />
        </Col>
      </Row>
      {stats.retest > 0 || stats.restrict > 0 || stats.immediate > 0 ? (
        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={8}>
            {stats.retest > 0 && (
              <Tag color="blue">
                需要复测: {stats.retest} 个构件
              </Tag>
            )}
          </Col>
          <Col span={8}>
            {stats.restrict > 0 && (
              <Tag color="orange">
                需要限行: {stats.restrict} 个构件
              </Tag>
            )}
          </Col>
          <Col span={8}>
            {stats.immediate > 0 && (
              <Tag color="red">
                立即派单: {stats.immediate} 个构件
              </Tag>
            )}
          </Col>
        </Row>
      ) : null}
    </div>
  );
}

export default function App() {
  const [bridgeName, setBridgeName] = useState('');
  const [components, setComponents] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [closures, setClosures] = useState([]);
  const [userOverrides, setUserOverrides] = useState({});
  const [userNotes, setUserNotes] = useState({});
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const analyzedComponents = analyzeAllComponents(components, inspections, alarms, closures);

  const selectedAnalyzedComponent = selectedComponent
    ? analyzedComponents.find((c) => c.id === selectedComponent.id) || selectedComponent
    : null;

  useEffect(() => {
    const data = loadAllData();
    setBridgeName(data.bridgeName || '');
    setComponents(data.components || []);
    setInspections(data.inspections || []);
    setAlarms(data.alarms || []);
    setClosures(data.closures || []);
    setUserOverrides(data.userOverrides || {});
    setUserNotes(data.userNotes || {});
  }, []);

  useEffect(() => {
    saveAllData({
      components,
      inspections,
      alarms,
      closures,
      userOverrides,
      userNotes,
      bridgeName,
    });
  }, [components, inspections, alarms, closures, userOverrides, userNotes, bridgeName]);

  const handleDataChange = (type, data) => {
    switch (type) {
      case ImportTypes.COMPONENTS:
        setComponents(data);
        break;
      case ImportTypes.INSPECTIONS:
        setInspections(data);
        break;
      case ImportTypes.ALARMS:
        setAlarms(data);
        break;
      case ImportTypes.CLOSURES:
        setClosures(data);
        break;
    }
    setSelectedComponent(null);
  };

  const handleUpdateAction = (componentId, actionType) => {
    setUserOverrides((prev) => ({
      ...prev,
      [componentId]: actionType,
    }));
    message.success('处置建议已更新');
  };

  const handleUpdateNote = (componentId, note) => {
    setUserNotes((prev) => ({
      ...prev,
      [componentId]: note,
    }));
    message.success('备注已保存');
  };

  const handleClearData = () => {
    clearAllData();
    setBridgeName('');
    setComponents([]);
    setInspections([]);
    setAlarms([]);
    setClosures([]);
    setUserOverrides({});
    setUserNotes({});
    setSelectedComponent(null);
    setShowClearConfirm(false);
    message.success('数据已清除');
  };

  const importStats = {
    [ImportTypes.COMPONENTS]: components.length,
    [ImportTypes.INSPECTIONS]: inspections.length,
    [ImportTypes.ALARMS]: alarms.length,
    [ImportTypes.CLOSURES]: closures.length,
  };

  const leftTabs = [
    {
      key: 'import',
      label: '数据导入',
      children: (
        <div style={{ padding: 12, height: '100%', overflow: 'auto' }}>
          <DataImport onDataChange={handleDataChange} importStats={importStats} />
        </div>
      ),
    },
    {
      key: 'export',
      label: '数据导出',
      children: (
        <div style={{ padding: 12 }}>
          <ExportPanel
            bridgeName={bridgeName}
            components={analyzedComponents}
            inspections={inspections}
            alarms={alarms}
            closureWindows={closures}
            userOverrides={userOverrides}
            userNotes={userNotes}
          />
        </div>
      ),
    },
  ];

  return (
    <Layout style={{ height: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#001529',
          padding: '0 24px',
        }}
      >
        <Title level={4} style={{ color: 'white', margin: 0, marginRight: 24 }}>
          🌉 桥梁巡检 3D 复盘工具
        </Title>
        <Input
          placeholder="请输入桥梁名称"
          value={bridgeName}
          onChange={(e) => setBridgeName(e.target.value)}
          style={{ width: 200 }}
          prefix={<span style={{ color: '#999' }}>桥梁:</span>}
        />
        <Space style={{ marginLeft: 'auto' }}>
          <Button icon={<InfoCircleOutlined />} onClick={() => setShowHelp(true)}>
            帮助
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            刷新
          </Button>
          <Button danger icon={<DeleteOutlined />} onClick={() => setShowClearConfirm(true)}>
            清除数据
          </Button>
        </Space>
      </Header>

      <Layout>
        <Sider width={320} theme="light" style={{ borderRight: '1px solid #d9d9d9' }}>
          <Tabs
            items={leftTabs}
            defaultActiveKey="import"
            style={{ height: '100%' }}
          />
        </Sider>

        <Layout>
          {analyzedComponents.length > 0 && (
            <StatisticsPanel
              analyzedComponents={analyzedComponents}
              userOverrides={userOverrides}
            />
          )}
          <Content
            style={{
              position: 'relative',
              height: analyzedComponents.length > 0 ? 'calc(100% - 80px)' : '100%',
            }}
          >
            <Bridge3D
              components={analyzedComponents}
              selectedComponent={selectedAnalyzedComponent}
              onSelectComponent={setSelectedComponent}
            />
            {components.length === 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: '#999',
                }}
              >
                <HighlightOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>请从左侧面板导入桥跨结构数据</p>
                <p style={{ fontSize: 12 }}>导入后将在 3D 视图中显示桥梁模型</p>
              </div>
            )}
          </Content>
        </Layout>

        <Sider width={380} theme="light" style={{ borderLeft: '1px solid #d9d9d9' }}>
          <div
            style={{
              height: '100%',
              overflow: 'auto',
              borderLeft: '1px solid #d9d9d9',
            }}
          >
            <ComponentDetail
              component={selectedAnalyzedComponent}
              onUpdateAction={handleUpdateAction}
              onUpdateNote={handleUpdateNote}
              userOverrides={userOverrides}
              userNotes={userNotes}
            />
          </div>
        </Sider>
      </Layout>

      <Modal
        title="使用帮助"
        open={showHelp}
        onCancel={() => setShowHelp(false)}
        footer={[
          <Button key="close" onClick={() => setShowHelp(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        <div style={{ lineHeight: 2 }}>
          <p>
            <strong>1. 数据导入</strong>
          </p>
          <ul>
            <li>桥跨结构简表：定义桥梁的各个构件（桥面、桥墩、主梁等）</li>
            <li>裂缝/锈蚀巡检记录：导入裂缝宽度、长度、锈蚀等级等数据</li>
            <li>传感器振动告警：导入振动传感器的告警记录</li>
            <li>临时封道窗口：导入可用的封道时间窗口</li>
          </ul>

          <p>
            <strong>2. 3D 视图操作</strong>
          </p>
          <ul>
            <li>鼠标左键拖动：旋转视角</li>
            <li>鼠标右键拖动：平移</li>
            <li>滚轮：缩放</li>
            <li>点击构件：查看详细信息</li>
          </ul>

          <p>
            <strong>3. 风险等级说明</strong>
          </p>
          <ul>
            <li>
              <Tag color={RiskLevelColors[RiskLevel.LOW]}>低风险</Tag>：状态正常
            </li>
            <li>
              <Tag color={RiskLevelColors[RiskLevel.MEDIUM]}>中风险</Tag>：需要复测
            </li>
            <li>
              <Tag color={RiskLevelColors[RiskLevel.HIGH]}>高风险</Tag>：需要限行
            </li>
            <li>
              <Tag color={RiskLevelColors[RiskLevel.CRITICAL]}>严重风险</Tag>：立即派单
            </li>
          </ul>

          <p>
            <strong>4. 数据持久化</strong>
          </p>
          <p>所有导入的数据和人工改判都会自动保存到浏览器本地存储，刷新页面不丢失。</p>

          <p>
            <strong>5. 数据导出</strong>
          </p>
          <ul>
            <li>Markdown 处置单：包含风险统计、高风险详情、完整构件清单</li>
            <li>JSON 明细：完整的结构化数据，用于程序处理</li>
          </ul>
        </div>
      </Modal>

      <Modal
        title="确认清除"
        open={showClearConfirm}
        onCancel={() => setShowClearConfirm(false)}
        onOk={handleClearData}
        okText="确认清除"
        okType="danger"
      >
        <p>确定要清除所有数据吗？</p>
        <p style={{ color: 'red' }}>此操作不可恢复，将清除：</p>
        <ul>
          <li>桥跨结构数据 ({components.length} 个构件)</li>
          <li>巡检记录 ({inspections.length} 条)</li>
          <li>传感器告警 ({alarms.length} 条)</li>
          <li>封道窗口 ({closures.length} 条)</li>
          <li>人工改判记录 ({Object.keys(userOverrides).length} 条)</li>
          <li>备注信息 ({Object.keys(userNotes).length} 条)</li>
        </ul>
      </Modal>
    </Layout>
  );
}
