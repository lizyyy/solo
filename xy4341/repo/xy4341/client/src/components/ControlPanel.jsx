import React, { useState } from 'react';
import { Button, Space, Switch, Select, Slider, message } from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  StepForwardOutlined, 
  ReloadOutlined,
  FireOutlined,
  StopOutlined
} from '@ant-design/icons';
import useStore from '../store';

const { Option } = Select;

function ControlPanel() {
  const { 
    currentDrill, 
    startDrill, 
    pauseDrill, 
    stepDrill, 
    resumeDrill,
    loadCurrentDrill
  } = useStore();
  
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [autoMode, setAutoMode] = useState(false);
  const [fireMode, setFireMode] = useState(false);
  
  const handleStart = async () => {
    try {
      await startDrill();
      message.success('演练已开始');
    } catch (error) {
      message.error('开始演练失败: ' + (error.message || '未知错误'));
    }
  };
  
  const handlePause = async () => {
    try {
      await pauseDrill();
      message.info('演练已暂停');
    } catch (error) {
      message.error('暂停演练失败');
    }
  };
  
  const handleResume = async () => {
    try {
      await resumeDrill();
      message.success('演练已恢复');
    } catch (error) {
      message.error('恢复演练失败');
    }
  };
  
  const handleStep = async () => {
    try {
      await stepDrill();
    } catch (error) {
      message.error('单步执行失败');
    }
  };
  
  const handleReset = () => {
    setAutoMode(false);
    setFireMode(false);
    message.info('已重置控制面板');
  };
  
  const toggleFireMode = () => {
    const newMode = !fireMode;
    setFireMode(newMode);
    if (newMode) {
      message.info('已进入添加起火点模式，请点击楼层平面设置起火点');
    }
  };
  
  const isRunning = currentDrill?.status === 'running';
  const isPaused = currentDrill?.status === 'paused';
  const isCompleted = currentDrill?.status === 'completed';
  const hasDrill = !!currentDrill;
  
  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3 className="panel-title">演练控制</h3>
        {currentDrill && (
          <span style={{ fontSize: '12px', color: '#666' }}>
            时间步: {currentDrill.current_time_step || 0}
          </span>
        )}
      </div>
      <div className="panel-body">
        {currentDrill && (
          <div className="drill-status-info">
            <div className={`drill-status status-${currentDrill.status}`}>
              <div className="status-dot" />
              <span className="status-text">
                {currentDrill.status === 'running' ? '运行中' :
                 currentDrill.status === 'paused' ? '已暂停' :
                 currentDrill.status === 'completed' ? '已完成' : '未开始'}
              </span>
            </div>
          </div>
        )}
        
        <div className="control-buttons">
          <Space.Compact>
            <Button
              type={!hasDrill ? 'primary' : 'default'}
              icon={<PlayCircleOutlined />}
              onClick={handleStart}
              disabled={isRunning || isCompleted}
            >
              开始演练
            </Button>
            <Button
              icon={<PauseCircleOutlined />}
              onClick={handlePause}
              disabled={!isRunning}
            >
              暂停
            </Button>
            <Button
              icon={<StepForwardOutlined />}
              onClick={handleStep}
              disabled={isRunning}
            >
              单步
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
            >
              重置
            </Button>
          </Space.Compact>
        </div>
        
        {isPaused && (
          <div className="intervention-section">
            <div style={{ marginBottom: 8, fontSize: '12px', color: '#666' }}>
              人工干预（暂停时可改判）
            </div>
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleResume}
              >
                恢复演练
              </Button>
            </Space>
          </div>
        )}
        
        <div className="control-options">
          <div className="option-row">
            <span className="option-label">模拟速度</span>
            <div className="option-control">
              <Slider
                min={0.5}
                max={3}
                step={0.5}
                value={simulationSpeed}
                onChange={setSimulationSpeed}
                style={{ width: 120 }}
                marks={{ 0.5: '0.5x', 1: '1x', 2: '2x', 3: '3x' }}
              />
            </div>
          </div>
          
          <div className="option-row">
            <span className="option-label">自动模式</span>
            <div className="option-control">
              <Switch
                checked={autoMode}
                onChange={(checked) => {
                  setAutoMode(checked);
                  if (checked && isPaused) {
                    handleResume();
                  }
                }}
                disabled={!hasDrill || isCompleted}
              />
            </div>
          </div>
          
          <div className="option-row">
            <span className="option-label">添加起火点</span>
            <div className="option-control">
              <Button
                type={fireMode ? 'primary' : 'default'}
                icon={<FireOutlined />}
                onClick={toggleFireMode}
                danger={fireMode}
              >
                {fireMode ? '退出模式' : '设置起火点'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;
