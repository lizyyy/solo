import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRobotScene } from './hooks/useRobotScene';
import { TrajectoryPlayer, PlayerState } from './trajectory/TrajectoryPlayer';
import { ReportGenerator } from './report/ReportGenerator';
import { defaultProjectConfig, sampleTrajectory } from './data/sampleData';
import {
  ProjectConfig,
  Trajectory,
  AnalysisResult,
  Anomaly,
  AnomalyType,
  JointState
} from './types';

type PlaybackMode = 'idle' | 'playing' | 'paused';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TrajectoryPlayer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    initScene,
    updateRobotPose,
    getEndEffectorPose,
    analyzeTrajectory,
    checkCollisionForPoint,
    setRobotHighlight
  } = useRobotScene(containerRef);

  const [projectConfig, setProjectConfig] = useState<ProjectConfig>(defaultProjectConfig);
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState<string | null>(
    defaultProjectConfig.trajectories[0]?.id || null
  );
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentPose, setCurrentPose] = useState<{ x: number; y: number; z: number } | null>(null);
  const [currentJointState, setCurrentJointState] = useState<JointState | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('idle');
  const [currentPointIndex, setCurrentPointIndex] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [hasCollision, setHasCollision] = useState(false);
  const [hasNearMiss, setHasNearMiss] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    trajectory: true,
    playback: true,
    obstacles: true,
    analysis: true,
    report: true
  });

  const selectedTrajectory = projectConfig.trajectories.find((t) => t.id === selectedTrajectoryId) || null;

  useEffect(() => {
    initScene(projectConfig);
  }, [initScene, projectConfig]);

  useEffect(() => {
    if (!playerRef.current) {
      playerRef.current = new TrajectoryPlayer();
      playerRef.current.setSpeed(playbackSpeed);
    }

    const player = playerRef.current;
    const handleUpdate = (state: PlayerState) => {
      if (state.currentPoint) {
        updateRobotPose(state.currentPoint.joints);
        setCurrentJointState(state.currentPoint.joints);
        setCurrentPointIndex(state.currentPointIndex);
        setCurrentTime(state.currentTime);
        setPlaybackMode(state.state === 'playing' ? 'playing' : state.state === 'paused' ? 'paused' : 'idle');

        const pose = getEndEffectorPose();
        if (pose) {
          setCurrentPose(pose.position);
        }

        const result = checkCollisionForPoint(state.currentPoint, state.currentPointIndex);
        setHasCollision(result.hasCollision);
        setHasNearMiss(result.anomalies.some((a) => a.type === AnomalyType.NEAR_MISS));
        setRobotHighlight(result.hasCollision);
      }
    };

    player.addUpdateCallback(handleUpdate);

    if (selectedTrajectory) {
      player.setTrajectory(selectedTrajectory);
      if (selectedTrajectory.points.length > 0) {
        const firstPoint = selectedTrajectory.points[0];
        updateRobotPose(firstPoint.joints);
        setCurrentJointState(firstPoint.joints);
        const pose = getEndEffectorPose();
        if (pose) {
          setCurrentPose(pose.position);
        }
      }
    }

    return () => {
      player.removeUpdateCallback(handleUpdate);
    };
  }, [selectedTrajectory, updateRobotPose, getEndEffectorPose, checkCollisionForPoint, setRobotHighlight]);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return;

    if (playbackMode === 'playing') {
      playerRef.current.pause();
      setPlaybackMode('paused');
    } else {
      playerRef.current.play();
      setPlaybackMode('playing');
    }
  }, [playbackMode]);

  const handleStop = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.stop();
      setPlaybackMode('idle');
      setCurrentPointIndex(0);
      setCurrentTime(0);
      if (selectedTrajectory && selectedTrajectory.points.length > 0) {
        updateRobotPose(selectedTrajectory.points[0].joints);
        setCurrentJointState(selectedTrajectory.points[0].joints);
        const pose = getEndEffectorPose();
        if (pose) setCurrentPose(pose.position);
      }
    }
  }, [selectedTrajectory, updateRobotPose, getEndEffectorPose]);

  const handleStepForward = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.stepForward();
    }
  }, []);

  const handleStepBackward = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.stepBackward();
    }
  }, []);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!playerRef.current || !selectedTrajectory) return;
      const index = parseInt(e.target.value, 10);
      playerRef.current.pause();
      playerRef.current.goToIndex(index);
    },
    [selectedTrajectory]
  );

  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseFloat(e.target.value);
    setPlaybackSpeed(speed);
    if (playerRef.current) {
      playerRef.current.setSpeed(speed);
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!selectedTrajectory) return;

    const result = analyzeTrajectory(selectedTrajectory, projectConfig);
    setAnalysisResult(result);
  }, [selectedTrajectory, projectConfig, analyzeTrajectory]);

  const handleExportHTML = useCallback(() => {
    if (!analysisResult || !selectedTrajectory) return;
    ReportGenerator.downloadHTMLReport(
      {
        projectConfig,
        analysisResult,
        trajectory: selectedTrajectory
      },
      `report_${selectedTrajectory.name}_${Date.now()}.html`
    );
  }, [analysisResult, selectedTrajectory, projectConfig]);

  const handleExportJSON = useCallback(() => {
    if (!analysisResult || !selectedTrajectory) return;
    ReportGenerator.downloadJSONReport(
      {
        projectConfig,
        analysisResult,
        trajectory: selectedTrajectory
      },
      `report_${selectedTrajectory.name}_${Date.now()}.json`
    );
  }, [analysisResult, selectedTrajectory, projectConfig]);

  const handleExportCSV = useCallback(() => {
    if (!analysisResult || !selectedTrajectory) return;
    ReportGenerator.downloadCSVReport(
      {
        projectConfig,
        analysisResult,
        trajectory: selectedTrajectory
      },
      `report_${selectedTrajectory.name}_${Date.now()}.csv`
    );
  }, [analysisResult, selectedTrajectory, projectConfig]);

  const handleImportTrajectory = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);

          if (data.points && Array.isArray(data.points)) {
            const newTrajectory: Trajectory = {
              id: `traj_${Date.now()}`,
              name: data.name || file.name.replace('.json', ''),
              createdAt: Date.now(),
              points: data.points,
              totalTime: data.totalTime || (data.points.length > 0 ? data.points[data.points.length - 1].timestamp : 0)
            };

            setProjectConfig((prev) => ({
              ...prev,
              trajectories: [...prev.trajectories, newTrajectory],
              updatedAt: Date.now()
            }));
            setSelectedTrajectoryId(newTrajectory.id);
          }
        } catch (err) {
          console.error('Failed to parse trajectory file:', err);
          alert('轨迹文件解析失败，请确保是有效的 JSON 格式');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    []
  );

  const handleSaveProject = useCallback(() => {
    const json = JSON.stringify(projectConfig, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project_${projectConfig.name}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [projectConfig]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const getStatusBadgeClass = () => {
    if (hasCollision) return 'status-danger';
    if (hasNearMiss) return 'status-warning';
    return 'status-safe';
  };

  const getStatusText = () => {
    if (hasCollision) return '碰撞检测中';
    if (hasNearMiss) return '接近警告';
    return '安全';
  };

  const getAnomalyBadgeClass = (type: AnomalyType) => {
    switch (type) {
      case AnomalyType.COLLISION:
        return 'collision';
      case AnomalyType.NEAR_MISS:
        return 'near';
      case AnomalyType.BOUNDARY_VIOLATION:
        return 'collision';
      default:
        return '';
    }
  };

  const getAnomalyTypeName = (type: AnomalyType) => {
    switch (type) {
      case AnomalyType.COLLISION:
        return '碰撞';
      case AnomalyType.NEAR_MISS:
        return '接近警告';
      case AnomalyType.BOUNDARY_VIOLATION:
        return '边界违规';
      default:
        return '未知';
    }
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>机械臂避障回放工具</h1>
          <p>Robot Arm Obstacle Avoidance Tool</p>
        </div>

        <div className="sidebar-content">
          <div className="section">
            <div className="section-title accordion-header" onClick={() => toggleSection('trajectory')}>
              轨迹管理 {expandedSections.trajectory ? '▼' : '▶'}
            </div>
            {expandedSections.trajectory && (
              <div style={{ paddingTop: '8px' }}>
                <div className="select-group">
                  <select
                    value={selectedTrajectoryId || ''}
                    onChange={(e) => setSelectedTrajectoryId(e.target.value || null)}
                  >
                    {projectConfig.trajectories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedTrajectory && (
                  <div className="trajectory-info">
                    <div className="trajectory-info-row">
                      <span>轨迹点数</span>
                      <span className="trajectory-info-value">{selectedTrajectory.points.length}</span>
                    </div>
                    <div className="trajectory-info-row">
                      <span>总时长</span>
                      <span className="trajectory-info-value">{selectedTrajectory.totalTime.toFixed(2)}s</span>
                    </div>
                  </div>
                )}
                <div className="btn-group">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImportTrajectory}
                  />
                  <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
                    导入轨迹
                  </button>
                  <button className="btn btn-secondary" onClick={handleSaveProject}>
                    保存方案
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-title accordion-header" onClick={() => toggleSection('playback')}>
              回放控制 {expandedSections.playback ? '▼' : '▶'}
            </div>
            {expandedSections.playback && (
              <div style={{ paddingTop: '8px' }}>
                <div className="playback-controls">
                  <button className="playback-btn" onClick={handleStepBackward} title="上一帧">
                    ⏮
                  </button>
                  <button className="playback-btn" onClick={handleStop} title="停止">
                    ⏹
                  </button>
                  <button
                    className={`playback-btn ${playbackMode === 'playing' ? 'active' : ''}`}
                    onClick={handlePlayPause}
                    title={playbackMode === 'playing' ? '暂停' : '播放'}
                  >
                    {playbackMode === 'playing' ? '⏸' : '▶'}
                  </button>
                  <button className="playback-btn" onClick={handleStepForward} title="下一帧">
                    ⏭
                  </button>
                </div>

                {selectedTrajectory && (
                  <>
                    <div className="timeline">
                      <div className="trajectory-marker">
                        <div
                          className="trajectory-progress"
                          style={{
                            width: `${(currentPointIndex / Math.max(1, selectedTrajectory.points.length - 1)) * 100}%`
                          }}
                        />
                        {analysisResult?.anomalies.map((anomaly, idx) => {
                          const pos = (anomaly.pointIndex / selectedTrajectory.points.length) * 100;
                          return (
                            <div
                              key={idx}
                              className={`anomaly-marker ${anomaly.type === AnomalyType.NEAR_MISS ? 'near' : 'collision'}`}
                              style={{ left: `${Math.min(pos, 99)}%` }}
                              title={`${getAnomalyTypeName(anomaly.type)} @ ${anomaly.timestamp.toFixed(2)}s`}
                            />
                          );
                        })}
                      </div>
                      <input
                        type="range"
                        className="timeline-slider"
                        min={0}
                        max={Math.max(0, selectedTrajectory.points.length - 1)}
                        value={currentPointIndex}
                        onChange={handleSliderChange}
                      />
                      <div className="timeline-info">
                        <span>帧: {currentPointIndex + 1} / {selectedTrajectory.points.length}</span>
                        <span>时间: {currentTime.toFixed(2)}s / {selectedTrajectory.totalTime.toFixed(2)}s</span>
                      </div>
                    </div>

                    <div className="control-item">
                      <label>播放速度</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="range"
                          min={0.1}
                          max={3}
                          step={0.1}
                          value={playbackSpeed}
                          onChange={handleSpeedChange}
                          style={{ width: '80px' }}
                        />
                        <span style={{ fontSize: '12px', color: '#00d4ff', minWidth: '35px' }}>
                          {playbackSpeed.toFixed(1)}x
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {currentPose && (
                  <div className="trajectory-info" style={{ marginTop: '12px' }}>
                    <div className="trajectory-info-row">
                      <span>末端 X</span>
                      <span className="trajectory-info-value">{currentPose.x.toFixed(4)}m</span>
                    </div>
                    <div className="trajectory-info-row">
                      <span>末端 Y</span>
                      <span className="trajectory-info-value">{currentPose.y.toFixed(4)}m</span>
                    </div>
                    <div className="trajectory-info-row">
                      <span>末端 Z</span>
                      <span className="trajectory-info-value">{currentPose.z.toFixed(4)}m</span>
                    </div>
                  </div>
                )}

                {currentJointState && (
                  <div className="control-group" style={{ marginTop: '8px' }}>
                    <div className="control-item">
                      <label>J1</label>
                      <span style={{ color: '#00d4ff', fontSize: '12px' }}>
                        {currentJointState.joint1.toFixed(1)}°
                      </span>
                    </div>
                    <div className="control-item">
                      <label>J2</label>
                      <span style={{ color: '#00d4ff', fontSize: '12px' }}>
                        {currentJointState.joint2.toFixed(1)}°
                      </span>
                    </div>
                    <div className="control-item">
                      <label>J3</label>
                      <span style={{ color: '#00d4ff', fontSize: '12px' }}>
                        {currentJointState.joint3.toFixed(1)}°
                      </span>
                    </div>
                    <div className="control-item">
                      <label>J4</label>
                      <span style={{ color: '#00d4ff', fontSize: '12px' }}>
                        {currentJointState.joint4.toFixed(1)}°
                      </span>
                    </div>
                    <div className="control-item">
                      <label>J5</label>
                      <span style={{ color: '#00d4ff', fontSize: '12px' }}>
                        {currentJointState.joint5.toFixed(1)}°
                      </span>
                    </div>
                    <div className="control-item">
                      <label>J6</label>
                      <span style={{ color: '#00d4ff', fontSize: '12px' }}>
                        {currentJointState.joint6.toFixed(1)}°
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-title accordion-header" onClick={() => toggleSection('obstacles')}>
              障碍物/禁区 {expandedSections.obstacles ? '▼' : '▶'}
            </div>
            {expandedSections.obstacles && (
              <div className="obstacle-list" style={{ paddingTop: '8px' }}>
                {projectConfig.obstacles.map((obs) => (
                  <div key={obs.id} className="obstacle-item">
                    <div className="obstacle-name">
                      <div className="obstacle-color" style={{ backgroundColor: obs.color }} />
                      <span>{obs.name}</span>
                    </div>
                    <span className="zone-type">
                      {obs.type === 'forbidden' ? '禁止区' : obs.type === 'warning' ? '警告区' : '避让区'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-title accordion-header" onClick={() => toggleSection('analysis')}>
              碰撞分析 {expandedSections.analysis ? '▼' : '▶'}
            </div>
            {expandedSections.analysis && (
              <div style={{ paddingTop: '8px' }}>
                <button className="btn btn-primary btn-block" onClick={handleAnalyze}>
                  开始碰撞分析
                </button>

                {analysisResult && (
                  <>
                    <div className="stats-grid" style={{ marginTop: '12px' }}>
                      <div className="stat-card">
                        <div className="stat-value safe">{analysisResult.safePoints}</div>
                        <div className="stat-label">安全点</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value warn">{analysisResult.nearMissCount}</div>
                        <div className="stat-label">接近</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value danger">{analysisResult.collisionCount}</div>
                        <div className="stat-label">碰撞</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value danger">{analysisResult.boundaryViolationCount}</div>
                        <div className="stat-label">越界</div>
                      </div>
                    </div>

                    {analysisResult.anomalies.length > 0 && (
                      <div className="anomaly-list" style={{ marginTop: '12px' }}>
                        {analysisResult.anomalies.slice(0, 20).map((anomaly, idx) => (
                          <div
                            key={anomaly.id}
                            className={`anomaly-item ${getAnomalyBadgeClass(anomaly.type)}`}
                          >
                            <div className="anomaly-header">
                              <span className={`anomaly-type ${getAnomalyBadgeClass(anomaly.type)}`}>
                                {getAnomalyTypeName(anomaly.type)}
                              </span>
                              <span className="anomaly-time">
                                {anomaly.timestamp.toFixed(2)}s (#{anomaly.pointIndex})
                              </span>
                            </div>
                            <div className="anomaly-details">{anomaly.description}</div>
                            {anomaly.distance !== undefined && anomaly.distance > 0 && (
                              <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                                距离: {anomaly.distance.toFixed(4)}m
                              </div>
                            )}
                          </div>
                        ))}
                        {analysisResult.anomalies.length > 20 && (
                          <div style={{ textAlign: 'center', padding: '8px', color: '#888', fontSize: '12px' }}>
                            ... 还有 {analysisResult.anomalies.length - 20} 条异常
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-title accordion-header" onClick={() => toggleSection('report')}>
              报告导出 {expandedSections.report ? '▼' : '▶'}
            </div>
            {expandedSections.report && (
              <div className="btn-group" style={{ paddingTop: '8px' }}>
                <button
                  className="btn btn-success"
                  onClick={handleExportHTML}
                  disabled={!analysisResult}
                >
                  导出 HTML
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleExportJSON}
                  disabled={!analysisResult}
                >
                  导出 JSON
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleExportCSV}
                  disabled={!analysisResult}
                >
                  导出 CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="viewer" ref={containerRef}>
        <div className="status-bar">
          <div className={`status-badge ${getStatusBadgeClass()}`}>
            <span className="dot" />
            <span>{getStatusText()}</span>
          </div>
          {selectedTrajectory && (
            <div className="status-badge">
              <span>轨迹: {selectedTrajectory.name}</span>
            </div>
          )}
          <div className="status-badge">
            <span>安全裕度: {projectConfig.safetyMargin}m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
