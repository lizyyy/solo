import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { levelsApi, rehearsalsApi } from '../services/api';
import { GameEngine, DEDUCTION_NAMES, DEDUCTION_TYPES } from '../utils/gameEngine';

function GamePage() {
  const { levelId } = useParams();
  const navigate = useNavigate();
  
  const [level, setLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameEngine, setGameEngine] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState(100);
  const [stageItems, setStageItems] = useState({
    curtains: [],
    props: [],
    lights: [],
  });
  const [toolbarItems, setToolbarItems] = useState({
    curtains: [],
    props: [],
    lights: [],
  });
  const [currentEvent, setCurrentEvent] = useState(null);
  const [completedEvents, setCompletedEvents] = useState([]);
  const [deductionAlert, setDeductionAlert] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameResults, setGameResults] = useState(null);
  
  const stageRef = useRef(null);
  const draggedItemRef = useRef(null);

  useEffect(() => {
    loadLevel();
  }, [levelId]);

  async function loadLevel() {
    try {
      setLoading(true);
      const response = await levelsApi.getById(levelId);
      if (response.success) {
        setLevel(response.data);
        initializeGame(response.data);
      }
    } catch (error) {
      console.error('加载关卡失败:', error);
    } finally {
      setLoading(false);
    }
  }

  function initializeGame(levelData) {
    const engine = new GameEngine(levelData);
    
    engine.on('timeUpdate', (time) => {
      setCurrentTime(time);
    });
    
    engine.on('deduction', (deduction) => {
      setScore(engine.score);
      showDeductionAlert(deduction);
    });
    
    engine.on('eventStart', (event) => {
      setCurrentEvent(event);
    });
    
    engine.on('eventComplete', ({ event, success }) => {
      setCompletedEvents(prev => [...prev, event]);
    });
    
    engine.on('gameOver', () => {
      setIsPlaying(false);
      setGameOver(true);
      setGameResults(engine.getResults());
    });
    
    engine.on('itemMoved', () => {
      setStageItems({ ...engine.stageItems });
    });
    
    engine.on('itemAdded', () => {
      setStageItems({ ...engine.stageItems });
    });
    
    engine.on('itemRemoved', () => {
      setStageItems({ ...engine.stageItems });
    });
    
    setGameEngine(engine);
    initializeToolbarItems(levelData);
  }

  function initializeToolbarItems(levelData) {
    const items = {
      curtains: [
        { id: 'curtain-left', name: '左侧幕布', icon: '🟥', width: 80, height: 120 },
        { id: 'curtain-right', name: '右侧幕布', icon: '🟥', width: 80, height: 120 },
      ],
      props: [],
      lights: [
        { id: 'spotlight-1', name: '聚光灯 1', icon: '💡', color: '#FFD700' },
        { id: 'spotlight-2', name: '聚光灯 2', icon: '💡', color: '#87CEEB' },
      ],
    };
    
    if (levelData.propsList && Array.isArray(levelData.propsList)) {
      items.props = levelData.propsList.map((prop, index) => ({
        id: prop.id || `prop-${index}`,
        name: prop.name || `道具 ${index + 1}`,
        icon: prop.icon || '📦',
        width: prop.width || 60,
        height: prop.height || 60,
      }));
    } else {
      items.props = [
        { id: 'prop-a', name: '道具 A', icon: '🎪', width: 60, height: 60 },
        { id: 'prop-b', name: '道具 B', icon: '🎭', width: 60, height: 60 },
        { id: 'prop-c', name: '道具 C', icon: '🎨', width: 60, height: 60 },
      ];
    }
    
    setToolbarItems(items);
  }

  function showDeductionAlert(deduction) {
    setDeductionAlert(deduction);
    setTimeout(() => setDeductionAlert(null), 3000);
  }

  function startGame() {
    if (!gameEngine) return;
    
    setIsPlaying(true);
    setGameOver(false);
    setScore(100);
    setCurrentTime(0);
    setCompletedEvents([]);
    setStageItems({ curtains: [], props: [], lights: [] });
    gameEngine.start();
  }

  function pauseGame() {
    if (!gameEngine) return;
    setIsPlaying(false);
    gameEngine.pause();
  }

  function resumeGame() {
    if (!gameEngine) return;
    setIsPlaying(true);
    gameEngine.start();
  }

  async function saveResults() {
    if (!gameResults || !level) return;
    
    try {
      const rehearsalData = {
        levelId: level.id,
        levelName: level.name,
        startTime: gameResults.startTime,
        endTime: gameResults.endTime,
        totalScore: gameResults.score,
        actions: gameResults.actions,
        deductions: gameResults.deductions,
        replayData: gameResults.replayData,
        notes: '',
      };
      
      const response = await rehearsalsApi.create(rehearsalData);
      if (response.success) {
        alert('排练记录已保存！');
        navigate('/history');
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败: ' + error.message);
    }
  }

  function handleToolboxDragStart(e, item, type) {
    draggedItemRef.current = { item, type, source: 'toolbar' };
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleStageDragStart(e, item, type) {
    draggedItemRef.current = { item, type, source: 'stage' };
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e) {
    e.preventDefault();
    
    if (!draggedItemRef.current || !stageRef.current) return;
    
    const { item, type, source } = draggedItemRef.current;
    const stageRect = stageRef.current.getBoundingClientRect();
    
    const x = e.clientX - stageRect.left - (item.width || 60) / 2;
    const y = e.clientY - stageRect.top - (item.height || 60) / 2;
    
    const clampedX = Math.max(0, Math.min(x, stageRect.width - (item.width || 60)));
    const clampedY = Math.max(0, Math.min(y, stageRect.height - (item.height || 60)));
    
    if (source === 'toolbar' && gameEngine) {
      const newItem = {
        ...item,
        x: clampedX,
        y: clampedY,
      };
      gameEngine.addItem(type, newItem);
    } else if (source === 'stage' && gameEngine) {
      gameEngine.moveItem(type, item.id, clampedX, clampedY);
    }
    
    draggedItemRef.current = null;
  }

  function getTotalTime() {
    if (!level || !level.timeline || level.timeline.length === 0) return 60;
    const lastEvent = level.timeline[level.timeline.length - 1];
    return lastEvent.time + (lastEvent.duration || 10);
  }

  if (loading) {
    return (
      <div className="card">
        <p>加载关卡中...</p>
      </div>
    );
  }

  if (!level) {
    return (
      <div className="card">
        <p>关卡不存在</p>
        <button className="btn-primary" onClick={() => navigate('/levels')}>
          返回关卡列表
        </button>
      </div>
    );
  }

  return (
    <div className="game-page">
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{level.name}</h2>
          <p style={{ color: '#666' }}>{level.description}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="stage-score">
            分数: <span style={{ color: score >= 70 ? '#28a745' : score >= 40 ? '#ffc107' : '#dc3545' }}>
              {score}
            </span>
          </div>
          <div className="stage-score">
            时间: {currentTime.toFixed(1)}s
          </div>
          
          {!gameOver ? (
            <>
              {!isPlaying ? (
                <button className="btn-success" onClick={startGame}>
                  开始
                </button>
              ) : (
                <button className="btn-warning" onClick={pauseGame}>
                  暂停
                </button>
              )}
              <button className="btn-danger" onClick={() => navigate('/levels')}>
                退出
              </button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={saveResults}>
                保存记录
              </button>
              <button className="btn-secondary" onClick={loadLevel}>
                重新开始
              </button>
            </>
          )}
        </div>
      </div>

      {currentEvent && (
        <div className="card">
          <h3>当前任务: {currentEvent.name}</h3>
          <p>{currentEvent.description}</p>
          {currentEvent.requiredItems && currentEvent.requiredItems.length > 0 && (
            <div>
              <strong>需要完成的动作:</strong>
              <ul>
                {currentEvent.requiredItems.map((item, index) => (
                  <li key={index}>
                    {item.type === 'props' ? '道具' : item.type === 'curtains' ? '幕布' : '灯光'} 
                    {item.id} - {item.targetZone ? `移动到 ${item.targetZone.name || '目标区域'}` : item.state}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {gameOver && gameResults && (
        <div className="card">
          <h3>排练结束</h3>
          <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
            最终得分: <span style={{ 
              color: gameResults.score >= 70 ? '#28a745' : 
                     gameResults.score >= 40 ? '#ffc107' : '#dc3545' 
            }}>
              {gameResults.score}
            </span>
          </div>
          
          {gameResults.deductions && gameResults.deductions.length > 0 && (
            <div>
              <h4>扣分记录:</h4>
              <div className="deduction-list">
                {gameResults.deductions.map((d, index) => (
                  <div key={index} className="deduction-item">
                    <div className="deduction-type">
                      {DEDUCTION_NAMES[d.type] || d.type} (-{d.points}分)
                    </div>
                    <div className="deduction-detail">
                      {d.description} (时间: {d.timestamp.toFixed(1)}s)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {deductionAlert && (
        <div className="deduction-alert">
          ⚠️ {DEDUCTION_NAMES[deductionAlert.type] || deductionAlert.type}
          <div style={{ fontSize: 12, marginTop: 4 }}>
            -{deductionAlert.points}分: {deductionAlert.description}
          </div>
        </div>
      )}

      <div className="timeline-container">
        <div className="timeline-header">
          <div className="timeline-current-time">{currentTime.toFixed(1)}s</div>
          <div className="timeline-total-time">总时长: {getTotalTime()}s</div>
        </div>
        <div className="timeline-bar">
          <div 
            className="timeline-progress"
            style={{ width: `${(currentTime / getTotalTime()) * 100}%` }}
          />
          {level.timeline && level.timeline.map((event, index) => (
            <div
              key={index}
              className="timeline-marker"
              style={{ left: `${(event.time / getTotalTime()) * 100}%` }}
            >
              <div className="timeline-marker-label">{event.name}</div>
            </div>
          ))}
        </div>
        {level.timeline && level.timeline.length > 0 && (
          <div className="timeline-events">
            {level.timeline.map((event, index) => {
              const isCompleted = completedEvents.some(e => e.time === event.time);
              const isCurrent = currentEvent && currentEvent.time === event.time;
              return (
                <div 
                  key={index}
                  className={`timeline-event ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                >
                  <div style={{ fontWeight: 600 }}>{event.name}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>
                    {event.time}s - {isCompleted ? '✓ 已完成' : isCurrent ? '进行中' : '待执行'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="toolbar-container">
        <div className="toolbar-header">道具栏 - 拖动到舞台上</div>
        <div className="toolbar-items">
          {toolbarItems.props.map((item) => (
            <div
              key={item.id}
              className="toolbar-item"
              draggable
              onDragStart={(e) => handleToolboxDragStart(e, item, 'props')}
            >
              <div style={{ fontSize: 28 }}>{item.icon}</div>
              <div className="toolbar-item-label">{item.name}</div>
            </div>
          ))}
          
          {toolbarItems.curtains.map((item) => (
            <div
              key={item.id}
              className="toolbar-item"
              draggable
              onDragStart={(e) => handleToolboxDragStart(e, item, 'curtains')}
            >
              <div style={{ fontSize: 28 }}>🟥</div>
              <div className="toolbar-item-label">{item.name}</div>
            </div>
          ))}
          
          {toolbarItems.lights.map((item) => (
            <div
              key={item.id}
              className="toolbar-item"
              draggable
              onDragStart={(e) => handleToolboxDragStart(e, item, 'lights')}
            >
              <div style={{ fontSize: 28 }}>{item.icon}</div>
              <div className="toolbar-item-label">{item.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="stage-container">
        <div className="stage-header">
          <div>舞台区域</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
            拖动道具到目标位置
          </div>
        </div>
        
        <div 
          ref={stageRef}
          className="stage-area"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="stage-backdrop">背景区域</div>
          <div className="stage-floor" />
          
          {level.stageConfig && level.stageConfig.targetZones && level.stageConfig.targetZones.map((zone, index) => (
            <div
              key={`target-${index}`}
              style={{
                position: 'absolute',
                left: zone.x,
                top: zone.y,
                width: zone.width,
                height: zone.height,
                border: '2px dashed rgba(40, 167, 69, 0.6)',
                background: 'rgba(40, 167, 69, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: 12,
                borderRadius: 4,
              }}
            >
              {zone.name}
            </div>
          ))}
          
          {level.stageConfig && level.stageConfig.dangerZones && level.stageConfig.dangerZones.map((zone, index) => (
            <div
              key={`danger-${index}`}
              style={{
                position: 'absolute',
                left: zone.x,
                top: zone.y,
                width: zone.width,
                height: zone.height,
                background: 'rgba(220, 53, 69, 0.2)',
                border: '2px solid rgba(220, 53, 69, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: 10,
                writingMode: 'vertical-rl',
              }}
            >
              ⚠️ {zone.name}
            </div>
          ))}
          
          {stageItems.curtains.map((item) => (
            <div
              key={item.id}
              className="draggable-item curtain-item"
              style={{
                left: item.x,
                top: item.y,
                width: item.width || 80,
                height: item.height || 120,
              }}
              draggable
              onDragStart={(e) => handleStageDragStart(e, item, 'curtains')}
            >
              {item.name}
            </div>
          ))}
          
          {stageItems.props.map((item) => (
            <div
              key={item.id}
              className="draggable-item prop-item"
              style={{
                left: item.x,
                top: item.y,
                width: item.width || 60,
                height: item.height || 60,
              }}
              draggable
              onDragStart={(e) => handleStageDragStart(e, item, 'props')}
            >
              {item.icon || '📦'}
            </div>
          ))}
          
          {stageItems.lights.map((item) => (
            <div
              key={item.id}
              className="draggable-item light-item"
              style={{
                left: item.x,
                top: item.y,
                background: item.color || '#FFD700',
              }}
              draggable
              onDragStart={(e) => handleStageDragStart(e, item, 'lights')}
            >
              {item.icon || '💡'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GamePage;
