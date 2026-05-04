import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';

function RoomGeometry({ feature, height = 3, opacity = 0.6 }) {
  const meshRef = useRef();
  
  const [geometry, position] = useMemo(() => {
    const coords = feature.geometry.coordinates;
    const type = feature.geometry.type;
    
    if (type === 'Polygon') {
      const points = coords[0].map(c => new THREE.Vector2(c[0], c[1]));
      const shape = new THREE.Shape(points);
      
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false
      });
      
      geometry.center();
      
      const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
      const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
      
      return [geometry, new THREE.Vector3(0, height / 2, 0)];
    }
    
    return [null, new THREE.Vector3()];
  }, [feature, height]);

  if (!geometry) return null;

  const properties = feature.properties || {};
  const isExit = properties.type === 'exit' || properties.category === 'exit';
  const isObstacle = properties.type === 'obstacle';
  
  let color = '#4a5568';
  if (isExit) color = '#10b981';
  if (isObstacle) color = '#6b7280';

  return (
    <mesh ref={meshRef} position={position}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        color={color}
        opacity={opacity}
        transparent={true}
        side={THREE.DoubleSide}
      />
      {properties.name && (
        <Html position={[0, height + 0.5, 0]}>
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            whiteSpace: 'nowrap'
          }}>
            {properties.name}
          </div>
        </Html>
      )}
    </mesh>
  );
}

function SmokeHeatmap({ sensorData, currentTime, threshold = 100 }) {
  const groupRef = useRef();
  
  const smokePoints = useMemo(() => {
    if (!sensorData || !sensorData.readings) return [];
    
    const points = [];
    const sensors = sensorData.sensors || [];
    
    sensors.forEach(sensor => {
      const reading = sensorData.readings.find(r => 
        r.sensorId === sensor.id || r.sensorName === sensor.name
      );
      
      if (reading && reading.values && reading.values.length > 0) {
        const values = reading.values;
        const timeIndex = Math.min(
          Math.floor(currentTime * values.length),
          values.length - 1
        );
        const value = values[timeIndex];
        
        points.push({
          x: sensor.x || 0,
          y: sensor.y || 0,
          z: sensor.z || 1.5,
          concentration: value?.concentration || 0,
          name: sensor.name || sensor.id
        });
      }
    });
    
    return points;
  }, [sensorData, currentTime, threshold]);

  return (
    <group ref={groupRef}>
      {smokePoints.map((point, index) => {
        const normalized = Math.min(point.concentration / (threshold * 2), 1);
        const size = 0.5 + normalized * 2;
        
        let color = '#10b981';
        if (normalized > 0.7) color = '#ef4444';
        else if (normalized > 0.4) color = '#f59e0b';
        
        return (
          <group key={index} position={[point.x, point.z, point.y]}>
            <mesh>
              <sphereGeometry args={[size, 16, 16]} />
              <meshStandardMaterial
                color={color}
                opacity={0.1 + normalized * 0.4}
                transparent={true}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[size * 0.3, 12, 12]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={normalized}
                opacity={0.8}
                transparent={true}
              />
            </mesh>
            <Html position={[0, size + 0.3, 0]}>
              <div style={{
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 10,
                textAlign: 'center'
              }}>
                <div>{point.name}</div>
                <div style={{ color: color, fontWeight: 'bold' }}>
                  {Math.round(point.concentration)} ppm
                </div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function FanVisualization({ fans, windows }) {
  const groupRef = useRef();
  
  const allDevices = useMemo(() => {
    const devices = [];
    
    fans?.forEach(fan => {
      devices.push({
        type: 'fan',
        ...fan,
        isIntake: fan.mode === 'intake' || fan.direction === 'in',
        isOn: fan.status !== 'off'
      });
    });
    
    windows?.forEach(window => {
      devices.push({
        type: 'window',
        ...window,
        isOpen: window.status === 'open'
      });
    });
    
    return devices;
  }, [fans, windows]);

  return (
    <group ref={groupRef}>
      {allDevices.map((device, index) => {
        const isFan = device.type === 'fan';
        const height = isFan ? 2.5 : 0.1;
        
        let color = '#6b7280';
        if (isFan) {
          color = device.isOn ? '#3b82f6' : '#475569';
        } else {
          color = device.isOpen ? '#10b981' : '#6b7280';
        }
        
        return (
          <group key={index} position={[device.x, height, device.y]}>
            <mesh>
              <boxGeometry args={[isFan ? 0.8 : 2, isFan ? 0.8 : 0.2, isFan ? 0.8 : 0.5]} />
              <meshStandardMaterial color={color} />
            </mesh>
            
            {isFan && device.isOn && (
              <FanAnimation direction={device.isIntake ? 1 : -1} />
            )}
            
            <Html position={[0, 1.5, 0]}>
              <div style={{
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 10,
                whiteSpace: 'nowrap'
              }}>
                {device.name || device.id}
                <span style={{ 
                  marginLeft: 4,
                  color: isFan ? (device.isOn ? '#10b981' : '#6b7280') : (device.isOpen ? '#10b981' : '#6b7280')
                }}>
                  {isFan ? (device.isOn ? '🔵 运行中' : '⚫ 关闭') : (device.isOpen ? '🟢 开启' : '⚫ 关闭')}
                </span>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function FanAnimation({ direction }) {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.05 * direction;
    }
  });

  return (
    <group ref={meshRef}>
      <mesh position={[0, 0, 0.5 * direction]}>
        <coneGeometry args={[0.3, 0.6, 4]} />
        <meshStandardMaterial
          color="#60a5fa"
          emissive="#3b82f6"
          emissiveIntensity={0.5}
          opacity={0.6}
          transparent={true}
        />
      </mesh>
    </group>
  );
}

function EvacuationRoute({ geojsonData, sensorData, currentTime, threshold = 100 }) {
  const groupRef = useRef();
  
  const routeData = useMemo(() => {
    if (!geojsonData || !geojsonData.features) return { exits: [], blocked: [] };
    
    const exits = geojsonData.features.filter(f => 
      f.properties && (f.properties.type === 'exit' || f.properties.category === 'exit')
    );
    
    const blocked = [];
    
    if (sensorData && sensorData.readings) {
      const sensors = sensorData.sensors || [];
      
      exits.forEach(exit => {
        const exitCoords = exit.geometry.coordinates;
        if (!exitCoords) return;
        
        const nearbySensors = sensors.filter(s => {
          if (!s.x || !s.y) return false;
          const distance = Math.sqrt(
            Math.pow(s.x - exitCoords[0], 2) + 
            Math.pow(s.y - exitCoords[1], 2)
          );
          return distance < 5;
        });
        
        nearbySensors.forEach(sensor => {
          const reading = sensorData.readings.find(r => 
            r.sensorId === sensor.id || r.sensorName === sensor.name
          );
          
          if (reading && reading.values && reading.values.length > 0) {
            const timeIndex = Math.min(
              Math.floor(currentTime * reading.values.length),
              reading.values.length - 1
            );
            const value = reading.values[timeIndex];
            
            if (value && value.concentration >= threshold) {
              blocked.push({
                exit: exit,
                sensor: sensor,
                concentration: value.concentration
              });
            }
          }
        });
      });
    }
    
    return { exits, blocked };
  }, [geojsonData, sensorData, currentTime, threshold]);

  const blockedExitIds = new Set(routeData.blocked.map(b => b.exit.id));

  return (
    <group ref={groupRef}>
      {routeData.exits.map((exit, index) => {
        const isBlocked = blockedExitIds.has(exit.id);
        const coords = exit.geometry.coordinates;
        
        if (!coords) return null;
        
        return (
          <group key={exit.id || index} position={[coords[0], 0.1, coords[1]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.8, 32]} />
              <meshBasicMaterial
                color={isBlocked ? '#ef4444' : '#10b981'}
                transparent={true}
                opacity={0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Html position={[0, 1, 0]}>
              <div style={{
                background: isBlocked ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}>
                {isBlocked ? '🚫 出口阻塞' : '🚪 出口可用'}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function FloorGrid({ bounds }) {
  const size = bounds ? Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) + 20 : 100;
  
  return (
    <group>
      <gridHelper args={[size, Math.floor(size / 2), '#2d3748', '#1a202c']} position={[0, 0.01, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#1a202c" />
      </mesh>
    </group>
  );
}

function Visualization3D({ 
  geojsonData, 
  fanWindowData, 
  sensorData, 
  currentTime = 0,
  threshold = 100
}) {
  const bounds = useMemo(() => {
    if (!geojsonData || !geojsonData.features) return null;
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    geojsonData.features.forEach(feature => {
      const coords = feature.geometry.coordinates;
      if (feature.geometry.type === 'Polygon' && coords && coords[0]) {
        coords[0].forEach(coord => {
          minX = Math.min(minX, coord[0]);
          maxX = Math.max(maxX, coord[0]);
          minY = Math.min(minY, coord[1]);
          maxY = Math.max(maxY, coord[1]);
        });
      }
    });
    
    return { minX, maxX, minY, maxY };
  }, [geojsonData]);

  const centerPosition = useMemo(() => {
    if (!bounds) return [0, 5, 10];
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    return [centerX, 10, centerY + 15];
  }, [bounds]);

  if (!geojsonData || !geojsonData.features) {
    return (
      <div className="visualization-placeholder">
        <h3>暂无可视化数据</h3>
        <p>请导入 GeoJSON 场馆数据以启用 3D 可视化</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: centerPosition, fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 20, 10]} intensity={1} />
        <pointLight position={[-10, 20, -10]} intensity={0.5} />
        
        <FloorGrid bounds={bounds} />
        
        {geojsonData.features.map((feature, index) => (
          <RoomGeometry key={feature.id || index} feature={feature} />
        ))}
        
        {fanWindowData && (
          <FanVisualization fans={fanWindowData.fans} windows={fanWindowData.windows} />
        )}
        
        {sensorData && (
          <SmokeHeatmap 
            sensorData={sensorData} 
            currentTime={currentTime}
            threshold={threshold}
          />
        )}
        
        <EvacuationRoute 
          geojsonData={geojsonData}
          sensorData={sensorData}
          currentTime={currentTime}
          threshold={threshold}
        />
        
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={100}
        />
      </Canvas>
    </div>
  );
}

export default Visualization3D;
