import React, { useState } from 'react';
import type { LightFixture, Rig, Actor } from '@/types';
import { Settings, Move, RotateCw, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface PropertyPanelProps {
  selectedType: 'light' | 'rig' | 'actor' | null;
  selectedItem: LightFixture | Rig | Actor | null;
  onUpdateLightAngle?: (lightId: string, pan: number, tilt: number, reason: string) => void;
  onUpdateRigHeight?: (rigId: string, height: number, reason: string) => void;
  onUpdateLightIntensity?: (lightId: string, intensity: number, reason: string) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedType,
  selectedItem,
  onUpdateLightAngle,
  onUpdateRigHeight,
  onUpdateLightIntensity,
}) => {
  const [adjustReason, setAdjustReason] = useState('手动调整');
  const [expanded, setExpanded] = useState(true);

  if (!selectedItem || !selectedType) {
    return (
      <div
        style={{
          width: '320px',
          backgroundColor: '#16213e',
          borderRight: '1px solid #2a3a5a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div>
          <Settings size={48} color="#444466" style={{ marginBottom: '12px' }} />
          <p style={{ color: '#666688', fontSize: '14px', margin: 0 }}>
            点击3D视图中的
          </p>
          <p style={{ color: '#666688', fontSize: '14px', margin: '4px 0 0 0' }}>
            灯具、吊杆或演员
          </p>
          <p style={{ color: '#8888aa', fontSize: '12px', marginTop: '12px' }}>
            以编辑属性
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '320px',
        backgroundColor: '#16213e',
        borderRight: '1px solid #2a3a5a',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #2a3a5a',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={18} color="#e94560" />
          <span style={{ fontWeight: '600', color: '#e94560', fontSize: '14px' }}>
            属性面板
          </span>
        </div>
        {expanded ? <ChevronUp size={16} color="#8888aa" /> : <ChevronDown size={16} color="#8888aa" />}
      </div>

      {expanded && (
        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <span
              style={{
                fontSize: '11px',
                color: '#666688',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
              }}
            >
              选中对象
            </span>
            <div
              style={{
                marginTop: '4px',
                padding: '10px 12px',
                backgroundColor: '#1a1a2e',
                borderRadius: '6px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#ddddee' }}>
                {'name' in selectedItem ? selectedItem.name : '对象'}
              </div>
              <div style={{ fontSize: '12px', color: '#666688', marginTop: '2px' }}>
                {selectedType === 'light'
                  ? '灯具'
                  : selectedType === 'rig'
                  ? '吊杆/桁架'
                  : '演员'}
              </div>
            </div>
          </div>

          {selectedType === 'light' && 'pan' in selectedItem && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <RotateCw size={14} color="#8888aa" />
                  <span style={{ fontSize: '12px', color: '#aaaacc' }}>角度调整</span>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#8888aa',
                      marginBottom: '6px',
                    }}
                  >
                    <span>Pan (水平旋转)</span>
                    <span style={{ fontFamily: 'monospace', color: '#e94560' }}>
                      {selectedItem.pan.toFixed(1)}°
                    </span>
                  </label>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={selectedItem.pan}
                    onChange={(e) => {
                      const newPan = Number(e.target.value);
                      onUpdateLightAngle?.(
                        selectedItem.id,
                        newPan,
                        selectedItem.tilt,
                        adjustReason
                      );
                    }}
                    style={{
                      width: '100%',
                      height: '4px',
                      appearance: 'none',
                      backgroundColor: '#2a3a5a',
                      borderRadius: '2px',
                      cursor: 'pointer',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#8888aa',
                      marginBottom: '6px',
                    }}
                  >
                    <span>Tilt (垂直俯仰)</span>
                    <span style={{ fontFamily: 'monospace', color: '#e94560' }}>
                      {selectedItem.tilt.toFixed(1)}°
                    </span>
                  </label>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    value={selectedItem.tilt}
                    onChange={(e) => {
                      const newTilt = Number(e.target.value);
                      onUpdateLightAngle?.(
                        selectedItem.id,
                        selectedItem.pan,
                        newTilt,
                        adjustReason
                      );
                    }}
                    style={{
                      width: '100%',
                      height: '4px',
                      appearance: 'none',
                      backgroundColor: '#2a3a5a',
                      borderRadius: '2px',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <Zap size={14} color="#8888aa" />
                  <span style={{ fontSize: '12px', color: '#aaaacc' }}>强度</span>
                </div>

                <div>
                  <label
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#8888aa',
                      marginBottom: '6px',
                    }}
                  >
                    <span>亮度</span>
                    <span style={{ fontFamily: 'monospace', color: '#e94560' }}>
                      {Math.round(selectedItem.intensity * 100)}%
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedItem.intensity}
                    onChange={(e) => {
                      const newIntensity = Number(e.target.value);
                      onUpdateLightIntensity?.(
                        selectedItem.id,
                        newIntensity,
                        adjustReason
                      );
                    }}
                    style={{
                      width: '100%',
                      height: '4px',
                      appearance: 'none',
                      backgroundColor: '#2a3a5a',
                      borderRadius: '2px',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#1a1a2e',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#666688',
                }}
              >
                <div style={{ marginBottom: '4px', fontWeight: '600', color: '#8888aa' }}>
                  灯具信息
                </div>
                <div>类型: {selectedItem.type.name}</div>
                <div>功率: {selectedItem.type.wattage}W</div>
                <div>光束角: {selectedItem.type.beamAngle}°</div>
                <div>DMX: 宇宙 {selectedItem.dmxUniverse}, 地址 {selectedItem.dmxAddress}</div>
              </div>
            </>
          )}

          {selectedType === 'rig' && 'currentHeight' in selectedItem && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <Move size={14} color="#8888aa" />
                  <span style={{ fontSize: '12px', color: '#aaaacc' }}>高度调整</span>
                </div>

                <div>
                  <label
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#8888aa',
                      marginBottom: '6px',
                    }}
                  >
                    <span>当前高度</span>
                    <span style={{ fontFamily: 'monospace', color: '#e94560' }}>
                      {selectedItem.currentHeight.toFixed(2)}m
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={0.1}
                    value={selectedItem.currentHeight}
                    onChange={(e) => {
                      const newHeight = Number(e.target.value);
                      onUpdateRigHeight?.(selectedItem.id, newHeight, adjustReason);
                    }}
                    style={{
                      width: '100%',
                      height: '4px',
                      appearance: 'none',
                      backgroundColor: '#2a3a5a',
                      borderRadius: '2px',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#1a1a2e',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#666688',
                }}
              >
                <div style={{ marginBottom: '4px', fontWeight: '600', color: '#8888aa' }}>
                  吊杆信息
                </div>
                <div>类型: {selectedItem.type}</div>
                <div>长度: {selectedItem.length.toFixed(1)}m</div>
                <div>重量: {selectedItem.weight}kg / 最大 {selectedItem.maxLoad}kg</div>
                <div>电动: {selectedItem.motorized ? '是' : '否'}</div>
              </div>
            </>
          )}

          {selectedType === 'actor' && 'height' in selectedItem && !('pan' in selectedItem) && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#1a1a2e',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#666688',
              }}
            >
              <div style={{ marginBottom: '4px', fontWeight: '600', color: '#8888aa' }}>
                演员信息
              </div>
              <div>身高: {selectedItem.height.toFixed(2)}m</div>
              <div>碰撞半径: {selectedItem.radius.toFixed(2)}m</div>
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <label
              style={{
                fontSize: '11px',
                color: '#666688',
                marginBottom: '4px',
                display: 'block',
              }}
            >
              调整原因（记录）
            </label>
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="如：避免碰撞、调整照度..."
              style={{
                width: '100%',
                padding: '8px 10px',
                backgroundColor: '#1a1a2e',
                border: '1px solid #2a3a5a',
                borderRadius: '4px',
                color: '#ddddee',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
