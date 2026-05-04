import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { DrillData, PlaybackState, PositionData, SensorData, DeviceStatus, RiskEvent } from '../types';
import './TunnelScene.css';

interface TunnelSceneProps {
  drill: DrillData;
  playback: PlaybackState;
  onPlaybackChange: (playback: PlaybackState) => void;
}

// 颜色配置
const COLORS = {
  tunnel: 0x2c3e50,
  tunnelWall: 0x34495e,
  person: 0x3498db,
  personSelected: 0xe74c3c,
  sensor_smoke_normal: 0x27ae60,
  sensor_smoke_alarm: 0xe74c3c,
  sensor_water_normal: 0x3498db,
  sensor_water_alarm: 0xe74c3c,
  device_open: 0x27ae60,
  device_closed: 0xe74c3c,
  risk_alert: 0xe74c3c,
  path: 0x3498db,
  ground: 0x1a1a2e,
  light: 0xffffff
};

// 人员模型组件
function Person({
  position,
  name,
  isActive,
  color = COLORS.person
}: {
  position: [number, number, number];
  name: string;
  isActive?: boolean;
  color?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} position={position}>
      {/* 身体 */}
      <mesh position={[0, 1, 0]}>
        <capsuleGeometry args={[0.3, 1, 8, 16]} />
        <meshStandardMaterial color={isActive ? COLORS.personSelected : color} />
      </mesh>
      {/* 头部 */}
      <mesh position={[0, 2, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={isActive ? COLORS.personSelected : color} />
      </mesh>
      {/* 名称标签 */}
      <Text
        position={[0, 2.8, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="bottom"
      >
        {name}
      </Text>
    </group>
  );
}

// 传感器模型组件
function Sensor({
  position,
  type,
  status,
  value
}: {
  position: [number, number, number];
  type: 'smoke' | 'water';
  status: 'normal' | 'warning' | 'alarm';
  value: number;
}) {
  const isAlarm = status === 'alarm' || status === 'warning';
  const color = type === 'smoke'
    ? (isAlarm ? COLORS.sensor_smoke_alarm : COLORS.sensor_smoke_normal)
    : (isAlarm ? COLORS.sensor_water_alarm : COLORS.sensor_water_normal);

  return (
    <group position={position}>
      {/* 传感器主体 */}
      <mesh>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isAlarm ? 0.5 : 0.1} />
      </mesh>
      {/* 告警时的发光效果 */}
      {isAlarm && (
        <pointLight
          position={[0, 0, 0]}
          color={color}
          intensity={2}
          distance={5}
        />
      )}
      {/* 类型标签 */}
      <Text
        position={[0, 0.5, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="bottom"
      >
        {type === 'smoke' ? '烟感' : '水位'}
      </Text>
    </group>
  );
}

// 设备模型组件（阀门/防火门）
function Device({
  position,
  type,
  status
}: {
  position: [number, number, number];
  type: 'valve' | 'fireDoor';
  status: 'open' | 'closed' | 'partial';
}) {
  const isOpen = status === 'open';
  const color = isOpen ? COLORS.device_open : COLORS.device_closed;

  return (
    <group position={position}>
      {type === 'fireDoor' ? (
        // 防火门模型
        <>
          {/* 门框 */}
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[2.2, 3.2, 0.1]} />
            <meshStandardMaterial color={COLORS.tunnelWall} />
          </mesh>
          {/* 门扇 */}
          <mesh
            position={isOpen ? [-1.2, 1.5, 0] : [0, 1.5, 0]}
            rotation={isOpen ? [0, Math.PI / 2, 0] : [0, 0, 0]}
          >
            <boxGeometry args={[2, 3, 0.08]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} />
          </mesh>
          {/* 状态标签 */}
          <Text
            position={[0, 3.5, 0]}
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="bottom"
          >
            {isOpen ? '开启' : '关闭'}
          </Text>
        </>
      ) : (
        // 阀门模型
        <>
          {/* 阀体 */}
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {/* 手轮 */}
          <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.05, 8, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} />
          </mesh>
          {/* 状态标签 */}
          <Text
            position={[0, 2, 0]}
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="bottom"
          >
            {isOpen ? '开启' : '关闭'}
          </Text>
        </>
      )}
    </group>
  );
}

// 路径线组件
function PathLine({
  points,
  color = COLORS.path
}: {
  points: PositionData[];
  color?: number;
}) {
  const linePoints = useMemo(() => {
    return points.map(p => new THREE.Vector3(p.x, p.y + 0.1, p.z));
  }, [points]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    return geometry;
  }, [linePoints]);

  return (
    <line>
      <bufferGeometry attach="geometry" {...lineGeometry} />
      <lineBasicMaterial attach="material" color={color} opacity={0.6} transparent />
    </line>
  );
}

// 告警扩散效果
function AlarmSphere({
  position,
  radius,
  type
}: {
  position: [number, number, number];
  radius: number;
  type: 'smoke' | 'water';
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const opacityRef = useRef(0.3);

  useFrame((_, delta) => {
    if (meshRef.current) {
      opacityRef.current = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = opacityRef.current;
    }
  });

  const color = type === 'smoke' ? 0xff6b6b : 0x4ecdc4;

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// 风险事件标记
function RiskMarker({
  risk,
  isActive,
  onClick
}: {
  risk: RiskEvent;
  isActive: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current && isActive) {
      meshRef.current.rotation.y += delta * 2;
    }
  });

  const severityColors: Record<string, number> = {
    low: 0x3498db,
    medium: 0xf39c12,
    high: 0xe67e22,
    critical: 0xe74c3c
  };

  const color = severityColors[risk.severity] || 0xe74c3c;

  return (
    <group
      position={[risk.location.x, risk.location.y + 0.5, risk.location.z]}
      onClick={onClick}
    >
      <mesh ref={meshRef}>
        <coneGeometry args={[0.3, 0.6, 4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 0.5 : 0.2}
        />
      </mesh>
      <pointLight
        position={[0, 0.5, 0]}
        color={color}
        intensity={isActive ? 3 : 1}
        distance={3}
      />
    </group>
  );
}

// 管廊模型
function Tunnel({ sections }: { sections: string[] }) {
  // 根据区域创建管廊段
  const tunnelSegments = useMemo(() => {
    const segments: {
      position: [number, number, number];
      size: [number, number, number];
      rotation?: [number, number, number];
    }[] = [];

    // 创建主直通道
    for (let i = 0; i < 10; i++) {
      segments.push({
        position: [i * 10 - 45, 2, 0],
        size: [10, 4, 6]
      });
    }

    // 创建横向分支
    segments.push({
      position: [-10, 2, 15],
      size: [30, 4, 6],
      rotation: [0, Math.PI / 2, 0]
    });

    segments.push({
      position: [20, 2, -15],
      size: [20, 4, 6],
      rotation: [0, Math.PI / 2, 0]
    });

    return segments;
  }, [sections]);

  return (
    <group>
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={COLORS.ground} />
      </mesh>

      {/* 管廊段 */}
      {tunnelSegments.map((segment, index) => (
        <group key={index} position={segment.position} rotation={segment.rotation || [0, 0, 0]}>
          {/* 顶板 */}
          <mesh position={[0, segment.size[1] / 2, 0]}>
            <boxGeometry args={[segment.size[0], 0.2, segment.size[2]]} />
            <meshStandardMaterial color={COLORS.tunnel} />
          </mesh>
          {/* 左侧墙 */}
          <mesh position={[segment.size[0] / 2, 0, 0]}>
            <boxGeometry args={[0.2, segment.size[1], segment.size[2]]} />
            <meshStandardMaterial color={COLORS.tunnelWall} />
          </mesh>
          {/* 右侧墙 */}
          <mesh position={[-segment.size[0] / 2, 0, 0]}>
            <boxGeometry args={[0.2, segment.size[1], segment.size[2]]} />
            <meshStandardMaterial color={COLORS.tunnelWall} />
          </mesh>
          {/* 照明 */}
          {[-segment.size[0] / 4, 0, segment.size[0] / 4].map((x, i) => (
            <pointLight
              key={i}
              position={[x, segment.size[1] / 2 - 0.5, 0]}
              color={COLORS.light}
              intensity={2}
              distance={15}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

// 场景控制器 - 处理回放逻辑
function SceneController({
  drill,
  playback,
  onPlaybackChange
}: {
  drill: DrillData;
  playback: PlaybackState;
  onPlaybackChange: (playback: PlaybackState) => void;
}) {
  const { camera } = useThree();

  // 播放逻辑
  useFrame((_, delta) => {
    if (playback.isPlaying) {
      const timeIncrement = delta * 1000 * playback.speed;
      const newTime = playback.currentTime + timeIncrement;

      if (newTime >= playback.endTime) {
        onPlaybackChange({
          ...playback,
          currentTime: playback.endTime,
          isPlaying: false
        });
      } else {
        onPlaybackChange({
          ...playback,
          currentTime: newTime
        });
      }
    }
  });

  return null;
}

// 场景内容
function SceneContent({
  drill,
  playback
}: {
  drill: DrillData;
  playback: PlaybackState;
}) {
  // 获取当前时间点的数据
  const getCurrentPositionData = useCallback((): PositionData[] => {
    // 按人员分组
    const personMap = new Map<string, PositionData[]>();
    drill.positionData.forEach(p => {
      if (!personMap.has(p.personId)) {
        personMap.set(p.personId, []);
      }
      personMap.get(p.personId)!.push(p);
    });

    // 对每个人员，找到当前时间的插值位置
    const currentPositions: PositionData[] = [];
    personMap.forEach((positions, personId) => {
      positions.sort((a, b) => a.timestamp - b.timestamp);

      // 找到当前时间前后的两个点
      let before: PositionData | null = null;
      let after: PositionData | null = null;

      for (const pos of positions) {
        if (pos.timestamp <= playback.currentTime) {
          before = pos;
        } else {
          after = pos;
          break;
        }
      }

      if (before) {
        if (after) {
          // 线性插值
          const t = (playback.currentTime - before.timestamp) / (after.timestamp - before.timestamp);
          const interpolated: PositionData = {
            ...before,
            x: before.x + (after.x - before.x) * t,
            y: before.y + (after.y - before.y) * t,
            z: before.z + (after.z - before.z) * t
          };
          currentPositions.push(interpolated);
        } else {
          currentPositions.push(before);
        }
      }
    });

    return currentPositions;
  }, [drill.positionData, playback.currentTime]);

  // 获取当前传感器状态
  const getCurrentSensorData = useCallback((): SensorData[] => {
    const sensorMap = new Map<string, SensorData[]>();
    drill.sensorData.forEach(s => {
      if (!sensorMap.has(s.sensorId)) {
        sensorMap.set(s.sensorId, []);
      }
      sensorMap.get(s.sensorId)!.push(s);
    });

    const currentSensors: SensorData[] = [];
    sensorMap.forEach((sensors, sensorId) => {
      sensors.sort((a, b) => a.timestamp - b.timestamp);
      
      // 找到当前时间最近的状态
      let current: SensorData | null = null;
      for (const sensor of sensors) {
        if (sensor.timestamp <= playback.currentTime) {
          current = sensor;
        }
      }
      
      if (current) {
        currentSensors.push(current);
      }
    });

    return currentSensors;
  }, [drill.sensorData, playback.currentTime]);

  // 获取当前设备状态
  const getCurrentDeviceStatus = useCallback((): DeviceStatus[] => {
    const deviceMap = new Map<string, DeviceStatus[]>();
    drill.deviceStatus.forEach(d => {
      if (!deviceMap.has(d.deviceId)) {
        deviceMap.set(d.deviceId, []);
      }
      deviceMap.get(d.deviceId)!.push(d);
    });

    const currentDevices: DeviceStatus[] = [];
    deviceMap.forEach((devices, deviceId) => {
      devices.sort((a, b) => a.timestamp - b.timestamp);
      
      let current: DeviceStatus | null = null;
      for (const device of devices) {
        if (device.timestamp <= playback.currentTime) {
          current = device;
        }
      }
      
      if (current) {
        currentDevices.push(current);
      }
    });

    return currentDevices;
  }, [drill.deviceStatus, playback.currentTime]);

  // 获取当前活跃的风险事件
  const getActiveRisks = useCallback((): RiskEvent[] => {
    return drill.riskEvents.filter(risk => {
      const endTime = risk.endTime || risk.startTime + 60000;
      return playback.currentTime >= risk.startTime && playback.currentTime <= endTime;
    });
  }, [drill.riskEvents, playback.currentTime]);

  const currentPositions = getCurrentPositionData();
  const currentSensors = getCurrentSensorData();
  const currentDevices = getCurrentDeviceStatus();
  const activeRisks = getActiveRisks();

  // 获取所有区域
  const allSections = useMemo(() => {
    const sections = new Set<string>();
    drill.positionData.forEach(p => sections.add(p.section));
    drill.sensorData.forEach(s => sections.add(s.position.section));
    drill.deviceStatus.forEach(d => sections.add(d.position.section));
    return Array.from(sections);
  }, [drill]);

  return (
    <>
      {/* 管廊 */}
      <Tunnel sections={allSections} />

      {/* 路径线（显示到当前时间为止的路径） */}
      {(() => {
        const personMap = new Map<string, PositionData[]>();
        drill.positionData
          .filter(p => p.timestamp <= playback.currentTime)
          .forEach(p => {
            if (!personMap.has(p.personId)) {
              personMap.set(p.personId, []);
            }
            personMap.get(p.personId)!.push(p);
          });

        return Array.from(personMap.entries()).map(([personId, positions]) => (
          <PathLine key={personId} points={positions.sort((a, b) => a.timestamp - b.timestamp)} />
        ));
      })()}

      {/* 人员 */}
      {currentPositions.map((pos, index) => (
        <Person
          key={`${pos.personId}-${index}`}
          position={[pos.x, pos.y, pos.z]}
          name={pos.personName}
          isActive={activeRisks.some(r => r.personId === pos.personId)}
        />
      ))}

      {/* 传感器 */}
      {currentSensors.map((sensor, index) => (
        <Sensor
          key={`${sensor.sensorId}-${index}`}
          position={[sensor.position.x, sensor.position.y + 1.5, sensor.position.z]}
          type={sensor.sensorType}
          status={sensor.status}
          value={sensor.value}
        />
      ))}

      {/* 告警扩散效果 */}
      {currentSensors
        .filter(s => s.status === 'alarm')
        .map((sensor, index) => (
          <AlarmSphere
            key={`alarm-${sensor.sensorId}-${index}`}
            position={[sensor.position.x, sensor.position.y + 1, sensor.position.z]}
            radius={3 + sensor.value * 2}
            type={sensor.sensorType}
          />
        ))}

      {/* 设备 */}
      {currentDevices.map((device, index) => (
        <Device
          key={`${device.deviceId}-${index}`}
          position={[device.position.x, device.position.y, device.position.z]}
          type={device.deviceType}
          status={device.status}
        />
      ))}

      {/* 风险事件标记 */}
      {drill.riskEvents.map((risk, index) => (
        <RiskMarker
          key={`risk-${risk.id}-${index}`}
          risk={risk}
          isActive={activeRisks.some(r => r.id === risk.id)}
          onClick={() => {}}
        />
      ))}
    </>
  );
}

// 主组件
const TunnelScene = ({ drill, playback, onPlaybackChange }: TunnelSceneProps) => {
  return (
    <div className="tunnel-scene">
      <Canvas shadows>
        {/* 环境光 */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={0.5}
          castShadow
        />

        {/* 相机 */}
        <PerspectiveCamera
          makeDefault
          position={[30, 20, 30]}
          fov={60}
        />

        {/* 控制器 */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={100}
        />

        {/* 场景控制器 */}
        <SceneController
          drill={drill}
          playback={playback}
          onPlaybackChange={onPlaybackChange}
        />

        {/* 场景内容 */}
        <SceneContent
          drill={drill}
          playback={playback}
        />
      </Canvas>

      {/* 场景信息 overlay */}
      <div className="scene-overlay">
        <div className="time-display">
          {new Date(playback.currentTime).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>
        <div className="legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#3498db' }}></div>
            <span>人员</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#27ae60' }}></div>
            <span>正常设备</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#e74c3c' }}></div>
            <span>告警/关闭</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TunnelScene;
