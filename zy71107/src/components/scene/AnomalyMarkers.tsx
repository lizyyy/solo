import React from 'react';
import { Html } from '@react-three/drei';
import { useSceneStore } from '../../store/useSceneStore';

const AnomalyMarkers: React.FC = () => {
  const anomalies = useSceneStore((state) => state.anomalies);
  const highlightAnomalies = useSceneStore((state) => state.highlightAnomalies);

  if (!highlightAnomalies) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#ff3333';
      case 'medium': return '#ff9900';
      case 'low': return '#ffcc00';
      default: return '#ff6b35';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'trajectory_break': return '⚠️';
      case 'showcase_mismatch': return '❌';
      case 'congestion_confusion': return '🔄';
      default: return '❗';
    }
  };

  return (
    <group>
      {anomalies.map((anomaly, index) => {
        if (!anomaly.location) return null;
        
        const color = getSeverityColor(anomaly.severity);
        
        return (
          <group
            key={index}
            position={[anomaly.location.x, 2, anomaly.location.z]}
          >
            <mesh>
              <sphereGeometry args={[0.3]} />
              <meshBasicMaterial color={color} transparent opacity={0.8} />
            </mesh>
            
            <Html center distanceFactor={15}>
              <div
                style={{
                  background: 'rgba(255, 50, 50, 0.9)',
                  border: '1px solid #ff6666',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 0 15px rgba(255, 50, 50, 0.5)',
                  transform: 'translateY(-40px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{getTypeIcon(anomaly.type)}</span>
                  <span style={{ fontWeight: 'bold' }}>{anomaly.severity.toUpperCase()}</span>
                </div>
                <div style={{ marginTop: '2px', maxWidth: '200px' }}>{anomaly.message}</div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

export default AnomalyMarkers;
