import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { levelsApi, dataApi } from '../services/api';

function LevelManager() {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [newLevel, setNewLevel] = useState({
    name: '',
    description: '',
    sceneData: null,
    propsList: null,
    timeline: [],
    stageConfig: {},
  });
  const [importMessage, setImportMessage] = useState('');
  
  const sceneFileInput = useRef(null);
  const propsFileInput = useRef(null);

  useEffect(() => {
    loadLevels();
  }, []);

  async function loadLevels() {
    try {
      setLoading(true);
      const response = await levelsApi.getAll();
      if (response.success) {
        setLevels(response.data);
      }
    } catch (error) {
      console.error('加载关卡失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSceneFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      setImportMessage('正在解析场景数据...');
      const response = await dataApi.importScene(file);
      if (response.success) {
        setNewLevel(prev => ({ ...prev, sceneData: response.data }));
        setImportMessage('场景数据导入成功！');
      } else {
        setImportMessage(`导入失败: ${response.message}`);
      }
    } catch (error) {
      setImportMessage(`导入失败: ${error.message}`);
    }
  }

  async function handlePropsFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      setImportMessage('正在解析道具清单...');
      const response = await dataApi.importProps(file);
      if (response.success) {
        setNewLevel(prev => ({ ...prev, propsList: response.data }));
        setImportMessage('道具清单导入成功！');
      } else {
        setImportMessage(`导入失败: ${response.message}`);
      }
    } catch (error) {
      setImportMessage(`导入失败: ${error.message}`);
    }
  }

  async function handleCreateLevel() {
    if (!newLevel.name.trim()) {
      setImportMessage('请输入关卡名称');
      return;
    }
    
    if (!newLevel.sceneData) {
      setImportMessage('请导入场景数据');
      return;
    }

    try {
      const levelData = {
        name: newLevel.name,
        description: newLevel.description,
        sceneData: newLevel.sceneData,
        propsList: newLevel.propsList,
        timeline: generateSampleTimeline(),
        stageConfig: generateSampleStageConfig(),
      };
      
      const response = await levelsApi.create(levelData);
      if (response.success) {
        setImportMessage('关卡创建成功！');
        setNewLevel({
          name: '',
          description: '',
          sceneData: null,
          propsList: null,
          timeline: [],
          stageConfig: {},
        });
        setShowImport(false);
        loadLevels();
      }
    } catch (error) {
      setImportMessage(`创建失败: ${error.message}`);
    }
  }

  function generateSampleTimeline() {
    return [
      {
        time: 0,
        duration: 15,
        name: '开场换景',
        description: '将道具 A 移动到舞台左侧',
        requiredItems: [
          { type: 'props', id: 'prop-a', targetZone: { x: 50, y: 100, width: 100, height: 100 } }
        ]
      },
      {
        time: 20,
        duration: 10,
        name: '换幕',
        description: '打开右侧幕布',
        requiredItems: [
          { type: 'curtains', id: 'curtain-right', state: 'open' }
        ]
      },
      {
        time: 35,
        duration: 12,
        name: '灯光切换',
        description: '开启聚光灯',
        requiredItems: [
          { type: 'lights', id: 'spotlight-1', state: 'on' }
        ]
      }
    ];
  }

  function generateSampleStageConfig() {
    return {
      width: 800,
      height: 400,
      dangerZones: [
        { name: '后台通道', x: 0, y: 0, width: 50, height: 400 },
        { name: '观众席', x: 750, y: 0, width: 50, height: 400 }
      ],
      targetZones: [
        { name: '舞台左侧', x: 50, y: 100, width: 100, height: 100 },
        { name: '舞台中央', x: 350, y: 150, width: 100, height: 100 },
        { name: '舞台右侧', x: 650, y: 100, width: 100, height: 100 }
      ]
    };
  }

  async function handleDeleteLevel(id) {
    if (!confirm('确定要删除这个关卡吗？')) return;
    
    try {
      await levelsApi.delete(id);
      loadLevels();
    } catch (error) {
      console.error('删除失败:', error);
    }
  }

  return (
    <div className="level-manager">
      <div className="card">
        <h2>关卡管理</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowImport(!showImport)}
        >
          {showImport ? '取消' : '+ 新建关卡'}
        </button>
      </div>

      {showImport && (
        <div className="import-section">
          <h3>导入数据</h3>
          
          {importMessage && (
            <div className={`alert ${importMessage.includes('成功') ? 'alert-success' : 'alert-info'}`}>
              {importMessage}
            </div>
          )}
          
          <div className="form-group">
            <label>关卡名称</label>
            <input
              type="text"
              value={newLevel.name}
              onChange={(e) => setNewLevel(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例如：第一场 开幕"
            />
          </div>
          
          <div className="form-group">
            <label>关卡描述</label>
            <textarea
              value={newLevel.description}
              onChange={(e) => setNewLevel(prev => ({ ...prev, description: e.target.value }))}
              placeholder="描述这个关卡的换景要求..."
              rows={3}
            />
          </div>
          
          <div className="import-options">
            <div 
              className="import-option"
              onClick={() => sceneFileInput.current?.click()}
            >
              <div className="import-option-icon">🎬</div>
              <div className="import-option-text">
                导入场景 JSON
                {newLevel.sceneData && <div style={{ color: '#28a745' }}>✓ 已导入</div>}
              </div>
              <input
                ref={sceneFileInput}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleSceneFileUpload}
              />
            </div>
            
            <div 
              className="import-option"
              onClick={() => propsFileInput.current?.click()}
            >
              <div className="import-option-icon">🎭</div>
              <div className="import-option-text">
                导入道具清单 JSON
                {newLevel.propsList && <div style={{ color: '#28a745' }}>✓ 已导入</div>}
              </div>
              <input
                ref={propsFileInput}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handlePropsFileUpload}
              />
            </div>
          </div>
          
          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button className="btn-success" onClick={handleCreateLevel}>
              创建关卡
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => setShowImport(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">
          <p>加载中...</p>
        </div>
      ) : levels.length === 0 ? (
        <div className="card">
          <p>暂无关卡，请点击上方按钮创建新关卡。</p>
        </div>
      ) : (
        <div className="level-list">
          {levels.map((level) => (
            <div key={level.id} className="level-card">
              <div className="level-card-header">
                <div className="level-card-title">{level.name}</div>
                <div className="level-card-actions">
                  <button 
                    className="btn-danger btn-sm"
                    onClick={() => handleDeleteLevel(level.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
              
              <p className="level-card-stats">
                {level.description && <span>{level.description}</span>}
              </p>
              
              <div className="level-card-stats">
                <span>📋 {level.timeline?.length || 0} 个事件</span>
                <span>🎭 {level.propsList?.length || 0} 个道具</span>
              </div>
              
              <div className="level-card-footer">
                <Link to={`/game/${level.id}`}>
                  <button className="btn-primary">
                    开始排练
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LevelManager;
