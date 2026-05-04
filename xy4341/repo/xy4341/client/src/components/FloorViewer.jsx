import React, { useState, useEffect, useRef } from 'react';
import { Select, Spin, Empty } from 'antd';
import { useThree, Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import useStore from '../store';

function FloorPlane({ floor, persons, exits, firePoints, onClick, isAddingFirePoint }) {
  const { selectedFloor } = useStore();
  
  const floorWidth = floor.width || 50;
  const floorHeight = floor.height || 30;
  const scale = 1;
  
  const floorColor = floor.level === 0 ? '#e8f4f8' : '#f5f5f5';
  
  const floorPersons = persons.filter(p => p.floor_id === floor.id);
  const floorExits = exits.filter(e => e.floor_id === floor.id);
  const floorFirePoints = firePoints.filter(fp => fp.floor_id === floor.id);
  
  const handleClick = (event) => {
    if (!isAddingFirePoint) return;
    
    const point = event.point;
    const x = (point.x + floorWidth / 2) / scale;
    const y = (floorHeight / 2 - point.y) / scale;
    
    onClick && onClick(floor.id, x, y);
  };
  
  return (
    <group onClick={handleClick}>
      <mesh
        position={[0, 0, -0.1]}
        onPointerOver={(e) => {
          if (isAddingFirePoint) {
            document.body.style.cursor = 'crosshair';
          }
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <planeGeometry args={[floorWidth, floorHeight]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>
      
      <gridHelper args={[floorWidth, Math.ceil(floorWidth / 5), '#ddd', '#eee']} position={[0, 0, 0.01]} />
      
      {floorExits.map((exit) => (
        <group key={exit.id}>
          <mesh position={[
            (exit.x - floorWidth / 2) * scale,
            (floorHeight / 2 - exit.y) * scale,
            0.1
          ]}>
            <planeGeometry args={[exit.width * scale, 2]} />
            <meshStandardMaterial
              color={exit.status === 'available' ? '#1890ff' : '#ff4d4f'}
              emissive={exit.status === 'available' ? '#1890ff' : '#ff4d4f'}
              emissiveIntensity={0.3}
            />
          </mesh>
          <Html position={[
            (exit.x - floorWidth / 2) * scale,
            (floorHeight / 2 - exit.y - 2) * scale,
            0.5
          ]} center>
            <div style={{
              fontSize: '10px',
              color: exit.status === 'available' ? '#1890ff' : '#ff4d4f',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}>
              {exit.name}
            </div>
          </Html>
        </group>
      ))}
      
      {floorPersons.map((person) => {
        let color = '#1890ff';
        if (person.status === 'evacuating') color = '#faad14';
        else if (person.status === 'evacuated') return null;
        else if (person.status === 'trapped') color = '#ff4d4f';
        else if (person.status === 'injured') color = '#fa8c16';
        
        return (
          <mesh key={person.id} position={[
            (person.x - floorWidth / 2) * scale,
            (floorHeight / 2 - person.y) * scale,
            0.2
          ]}>
            <circleGeometry args={[0.4, 16]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
      
      {floorFirePoints.map((fp) => (
        <group key={fp.id}>
          <mesh position={[
            (fp.x - floorWidth / 2) * scale,
            (floorHeight / 2 - fp.y) * scale,
            0.3
          ]}>
            <circleGeometry args={[fp.radius * scale, 32]} />
            <meshStandardMaterial
              color="#ff4d4f"
              transparent
              opacity={0.3}
            />
          </mesh>
          <mesh position={[
            (fp.x - floorWidth / 2) * scale,
            (floorHeight / 2 - fp.y) * scale,
            0.4
          ]}>
            <circleGeometry args={[1.5, 16]} />
            <meshStandardMaterial
              color="#ff4d4f"
              emissive="#ff4d4f"
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>
      ))}
      
      <Html position={[0, floorHeight / 2 - 2, 0.5]} center>
        <div style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#333'
        }}>
          {floor.name}
        </div>
      </Html>
    </group>
  );
}

function Scene3D({ floors, persons, exits, firePoints, onFloorClick, isAddingFirePoint }) {
  const { selectedFloor } = useStore();
  
  const displayFloors = selectedFloor 
    ? floors.filter(f => f.id === selectedFloor.id)
    : floors;
  
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 20]} intensity={0.8} />
      <directionalLight position={[-10, -10, 20]} intensity={0.4} />
      
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={!selectedFloor}
        maxPolarAngle={Math.PI / 2}
      />
      
      {displayFloors.map((floor, index) => (
        <group 
          key={floor.id} 
          position={[0, 0, (selectedFloor ? 0 : index * 10)]}
        >
          <FloorPlane
            floor={floor}
            persons={persons}
            exits={exits}
            firePoints={firePoints}
            onClick={onFloorClick}
            isAddingFirePoint={isAddingFirePoint}
          />
        </group>
      ))}
    </>
  );
}

function FloorViewer() {
  const {
    floors,
    exits,
    persons,
    firePoints,
    selectedFloor,
    setSelectedFloor,
    isAddingFirePoint,
    addFirePoint,
  } = useStore();
  
  const [loading, setLoading] = useState(false);
  
  const floorOptions = [
    { value: 'all', label: '所有楼层' },
    ...floors.map(f => ({ value: f.id, label: f.name })),
  ];
  
  const handleFloorChange = (value) => {
    if (value === 'all') {
      setSelectedFloor(null);
    } else {
      const floor = floors.find(f => f.id === value);
      setSelectedFloor(floor);
    }
  };
  
  const handleCanvasClick = async (floorId, x, y) => {
    if (!isAddingFirePoint) return;
    
    try {
      setLoading(true);
      await addFirePoint(floorId, x, y, 1.0, 5.0);
    } catch (error) {
      console.error('Failed to add fire point:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (floors.length === 0) {
    return (
      <div className="viewer-container">
        <div className="viewer-header">
          <h3 className="viewer-title">楼层平面图</h3>
        </div>
        <div className="viewer-canvas">
          <Empty 
            description="暂无楼层数据，请先配置楼层"
            className="empty-state"
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="viewer-container">
      <div className="viewer-header">
        <h3 className="viewer-title">楼层平面图</h3>
        <Select
          className="floor-selector"
          value={selectedFloor ? selectedFloor.id : 'all'}
          onChange={handleFloorChange}
          options={floorOptions}
          disabled={loading}
        />
      </div>
      
      <div className="viewer-canvas">
        {isAddingFirePoint && (
          <div className="add-fire-mode">
            点击楼层平面图设置起火点
          </div>
        )}
        
        <Canvas
          camera={{
            position: selectedFloor 
              ? [0, 0, 60]
              : [20, -20, 50],
            fov: 60,
          }}
          shadows
        >
          <color attach="background" args={['#fafafa']} />
          <Scene3D
            floors={floors}
            persons={persons}
            exits={exits}
            firePoints={firePoints}
            onFloorClick={handleCanvasClick}
            isAddingFirePoint={isAddingFirePoint}
          />
        </Canvas>
        
        {loading && (
          <div className="loading-overlay">
            <Spin size="large" />
          </div>
        )}
      </div>
      
      <div className="floor-legend" style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: 4 }}>
        <div className="legend-item">
          <span className="legend-color idle"></span>
          <span>待疏散</span>
        </div>
        <div className="legend-item">
          <span className="legend-color evacuating"></span>
          <span>疏散中</span>
        </div>
        <div className="legend-item">
          <span className="legend-color trapped"></span>
          <span>被困</span>
        </div>
        <div className="legend-item">
          <span className="legend-color exit"></span>
          <span>可用出口</span>
        </div>
        <div className="legend-item">
          <span className="legend-color exit-blocked"></span>
          <span>阻塞出口</span>
        </div>
        <div className="legend-item">
          <span className="legend-color fire"></span>
          <span>起火点</span>
        </div>
      </div>
    </div>
  );
}

export default FloorViewer;
