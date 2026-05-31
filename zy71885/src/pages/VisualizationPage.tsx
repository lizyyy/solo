import { useState, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import { Box, Sliders, Info } from "lucide-react";

function ConvexLens({ position }: { position: [number, number, number] }) {
  const points = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const thickness = 0.4;
    const radius = 2.5;
    const curvature = 0.15;

    for (let y = -radius; y <= radius; y += 0.05) {
      const rSq = radius * radius - y * y;
      const x = rSq > 0 ? Math.sqrt(rSq) * curvature + thickness / 2 : thickness / 2;
      pts.push(new THREE.Vector2(x, y));
    }
    for (let y = radius; y >= -radius; y -= 0.05) {
      const rSq = radius * radius - y * y;
      const x = -(rSq > 0 ? Math.sqrt(rSq) * curvature + thickness / 2 : thickness / 2);
      pts.push(new THREE.Vector2(x, y));
    }
    return pts;
  }, []);

  return (
    <group position={position}>
      <mesh>
        <latheGeometry args={[points, 32]} />
        <meshPhysicalMaterial
          color="#88ccff"
          transparent
          opacity={0.5}
          roughness={0.1}
          metalness={0.1}
          thickness={0.5}
          transmission={0.9}
          ior={1.5}
        />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0.01]}>
        <ringGeometry args={[2.45, 2.55, 32]} />
        <meshBasicMaterial color="#666" />
      </mesh>
    </group>
  );
}

function OpticalAxis({ length }: { length: number }) {
  const points = [
    new THREE.Vector3(-length / 2, 0, 0),
    new THREE.Vector3(length / 2, 0, 0),
  ];
  return (
    <Line
      points={points}
      color="#555"
      lineWidth={1}
      dashed
      dashSize={0.3}
      gapSize={0.2}
    />
  );
}

function ObjectArrow({
  position,
  height,
  label,
}: {
  position: [number, number, number];
  height: number;
  label: string;
}) {
  const shaftPoints = [
    new THREE.Vector3(position[0], 0, 0),
    new THREE.Vector3(position[0], height, 0),
  ];
  return (
    <group>
      <Line
        points={shaftPoints}
        color="#d4a843"
        lineWidth={2}
      />
      <mesh position={[position[0], height + 0.15, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.15, 0.3, 8]} />
        <meshBasicMaterial color="#d4a843" />
      </mesh>
      <Text
        position={[position[0] - 0.4, height / 2, 0]}
        fontSize={0.25}
        color="#d4a843"
        anchorX="right"
        anchorY="middle"
      >
        {label}
      </Text>
      <Text
        position={[position[0], -0.4, 0]}
        fontSize={0.2}
        color="#9aa7b8"
        anchorX="center"
        anchorY="top"
      >
        物
      </Text>
    </group>
  );
}

function ImageArrow({
  position,
  height,
  label,
  isReal,
}: {
  position: [number, number, number];
  height: number;
  label: string;
  isReal: boolean;
}) {
  const shaftPoints = [
    new THREE.Vector3(position[0], 0, 0),
    new THREE.Vector3(position[0], height, 0),
  ];
  return (
    <group>
      <Line
        points={shaftPoints}
        color={isReal ? "#3a9a5c" : "#c94040"}
        lineWidth={2}
        dashed={!isReal}
        dashSize={0.2}
        gapSize={0.1}
      />
      {height > 0 ? (
        <mesh position={[position[0], height + 0.15, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.15, 0.3, 8]} />
          <meshBasicMaterial color={isReal ? "#3a9a5c" : "#c94040"} />
        </mesh>
      ) : (
        <mesh position={[position[0], height - 0.15, 0]}>
          <coneGeometry args={[0.15, 0.3, 8]} />
          <meshBasicMaterial color={isReal ? "#3a9a5c" : "#c94040"} />
        </mesh>
      )}
      <Text
        position={[position[0] + 0.4, height / 2, 0]}
        fontSize={0.25}
        color={isReal ? "#3a9a5c" : "#c94040"}
        anchorX="left"
        anchorY="middle"
      >
        {label}
      </Text>
      <Text
        position={[position[0], -0.4, 0]}
        fontSize={0.2}
        color="#9aa7b8"
        anchorX="center"
        anchorY="top"
      >
        {isReal ? "实像" : "虚像"}
      </Text>
    </group>
  );
}

function FocalPoint({ position, label }: { position: [number, number, number]; label: string }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#d4a843" />
      </mesh>
      <Text
        position={[0, -0.25, 0]}
        fontSize={0.18}
        color="#d4a843"
        anchorX="center"
        anchorY="top"
      >
        {label}
      </Text>
    </group>
  );
}

function LightBeams({
  objectX,
  objectHeight,
  focalLength,
  imageX,
  imageHeight,
}: {
  objectX: number;
  objectHeight: number;
  focalLength: number;
  imageX: number;
  imageHeight: number;
}) {
  const topY = objectHeight;
  const beamColor = "#ffd700";

  const beam1Points = useMemo(() => {
    return [
      new THREE.Vector3(objectX - 2, topY, 0),
      new THREE.Vector3(0, topY, 0),
      new THREE.Vector3(imageX, imageHeight, 0),
    ];
  }, [objectX, topY, imageX, imageHeight]);

  const beam2Points = useMemo(() => {
    return [
      new THREE.Vector3(objectX - 2, topY, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(imageX, imageHeight, 0),
    ];
  }, [objectX, topY, imageX, imageHeight]);

  const beam3Points = useMemo(() => {
    return [
      new THREE.Vector3(objectX - 2, topY, 0),
      new THREE.Vector3(-focalLength, 0, 0),
      new THREE.Vector3(0, topY * (1 + objectX / focalLength), 0),
      new THREE.Vector3(imageX, imageHeight, 0),
    ];
  }, [objectX, topY, focalLength, imageX, imageHeight]);

  return (
    <group>
      <Line
        points={beam1Points}
        color={beamColor}
        lineWidth={1.5}
        transparent
        opacity={0.8}
      />
      <Line
        points={beam2Points}
        color={beamColor}
        lineWidth={1.5}
        transparent
        opacity={0.6}
      />
      <Line
        points={beam3Points}
        color={beamColor}
        lineWidth={1.5}
        transparent
        opacity={0.5}
      />
    </group>
  );
}

function Scene({
  focalLength,
  objectDistance,
  measuredError,
}: {
  focalLength: number;
  objectDistance: number;
  measuredError: number;
}) {
  const lensPosition: [number, number, number] = [0, 0, 0];
  const u = Math.abs(objectDistance);
  const f = Math.abs(focalLength);

  const theoreticalImageDistance = (u * f) / (u - f);
  const measuredImageDistance = theoreticalImageDistance + measuredError;

  const magnification = -theoreticalImageDistance / u;
  const objectHeight = 1.5;
  const imageHeight = objectHeight * magnification;
  const measuredImageHeight = objectHeight * (-measuredImageDistance / u);

  const objectX = -u;
  const imageX = theoreticalImageDistance;
  const measuredImageX = measuredImageDistance;

  const isReal = theoreticalImageDistance > 0;
  const isConvex = focalLength > 0;

  const animRef = useRef(0);
  useFrame((_, delta) => {
    animRef.current += delta;
  });

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[-8, 3, 5]} intensity={0.5} color="#d4a843" />
      <pointLight position={[8, 3, 5]} intensity={0.3} color="#88aaff" />

      <OpticalAxis length={20} />

      {isConvex && (
        <ConvexLens position={lensPosition} />
      )}

      <ObjectArrow
        position={[objectX, 0, 0]}
        height={objectHeight}
        label={`h = ${objectHeight.toFixed(1)}`}
      />

      <ImageArrow
        position={[imageX, 0, 0]}
        height={imageHeight}
        label={`h' = ${Math.abs(imageHeight).toFixed(2)}`}
        isReal={isReal}
      />

      {Math.abs(measuredError) > 0.001 && (
        <group>
          <Line
            points={[
              new THREE.Vector3(measuredImageX, -1.5, 0),
              new THREE.Vector3(measuredImageX, 1.5, 0),
            ]}
            color="#c94040"
            lineWidth={1}
            dashed
            dashSize={0.2}
            gapSize={0.15}
          />
          <ImageArrow
            position={[measuredImageX, 0, 0]}
            height={measuredImageHeight}
            label={`实测: ${Math.abs(measuredImageHeight).toFixed(2)}`}
            isReal={measuredImageDistance > 0}
          />
        </group>
      )}

      {isConvex && (
        <>
          <FocalPoint position={[f, 0, 0]} label="F'" />
          <FocalPoint position={[-f, 0, 0]} label="F" />
        </>
      )}

      <LightBeams
        objectX={objectX}
        objectHeight={objectHeight}
        focalLength={f}
        imageX={imageX}
        imageHeight={imageHeight}
      />

      <Text
        position={[-u / 2, -1.8, 0]}
        fontSize={0.22}
        color="#9aa7b8"
        anchorX="center"
        anchorY="middle"
      >
        u = {u.toFixed(1)}
      </Text>
      <Text
        position={[imageX / 2, -1.8, 0]}
        fontSize={0.22}
        color="#9aa7b8"
        anchorX="center"
        anchorY="middle"
      >
        v = {Math.abs(theoreticalImageDistance).toFixed(2)}
      </Text>
      <Text
        position={[f / 2, -2.3, 0]}
        fontSize={0.22}
        color="#d4a843"
        anchorX="center"
        anchorY="middle"
      >
        f = {f.toFixed(1)}
      </Text>

      {Math.abs(measuredError) > 0.001 && (
        <Text
          position={[
            (imageX + measuredImageX) / 2,
            -2.8,
            0,
          ]}
          fontSize={0.25}
          color="#c94040"
          anchorX="center"
          anchorY="middle"
        >
          {`Δv = ${measuredError.toFixed(3)}`}
        </Text>
      )}
    </>
  );
}

export function VisualizationPage() {
  const [focalLength, setFocalLength] = useState(100);
  const [objectDistance, setObjectDistance] = useState(200);
  const [measuredError, setMeasuredError] = useState(0.032);

  const f = focalLength / 10;
  const u = objectDistance / 10;
  const err = measuredError / 10;

  const theoreticalImageDistance = (u * f) / (u - f);
  const measuredImageDistance = theoreticalImageDistance + err;
  const isRealImage = theoreticalImageDistance > 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 px-2">
        <div>
          <h1 className="text-2xl font-bold text-lab-text flex items-center gap-2">
            <Box className="w-6 h-6 text-lab-accent" />
            3D 可视化
          </h1>
          <p className="text-sm text-lab-textMuted mt-1">
            凸透镜成像光路示意，调整参数观察成像变化
          </p>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 card p-0 overflow-hidden">
          <Canvas
            camera={{ position: [0, 2, 12], fov: 50 }}
            style={{ background: "#1a2332" }}
          >
            <Scene
              focalLength={f}
              objectDistance={u}
              measuredError={err}
            />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={5}
              maxDistance={25}
            />
          </Canvas>
        </div>

        <div className="w-80 space-y-4">
          <div className="card">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-lab-accent" />
              参数调节
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-lab-textMuted">
                    焦距 f (mm)
                  </label>
                  <span className="text-sm font-mono text-lab-accent">
                    {focalLength}
                  </span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="200"
                  value={focalLength}
                  onChange={(e) => setFocalLength(parseInt(e.target.value))}
                  className="w-full accent-lab-accent"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-lab-textMuted">
                    物距 u (mm)
                  </label>
                  <span className="text-sm font-mono text-lab-accent">
                    {objectDistance}
                  </span>
                </div>
                <input
                  type="range"
                  min={focalLength + 20}
                  max="500"
                  value={objectDistance}
                  onChange={(e) => setObjectDistance(parseInt(e.target.value))}
                  className="w-full accent-lab-accent"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-lab-textMuted">
                    像距误差 Δv (mm)
                  </label>
                  <span className="text-sm font-mono text-lab-danger">
                    {measuredError.toFixed(3)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.1"
                  max="0.1"
                  step="0.001"
                  value={measuredError}
                  onChange={(e) => setMeasuredError(parseFloat(e.target.value))}
                  className="w-full accent-lab-danger"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-lab-accent" />
              计算结果
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-lab-textMuted">透镜公式</span>
                <span className="font-mono">1/f = 1/u + 1/v</span>
              </div>
              <div className="flex justify-between">
                <span className="text-lab-textMuted">理论像距 v</span>
                <span className="font-mono">
                  {(theoreticalImageDistance * 10).toFixed(3)} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-lab-textMuted">实测像距 v'</span>
                <span className="font-mono text-lab-danger">
                  {(measuredImageDistance * 10).toFixed(3)} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-lab-textMuted">成像性质</span>
                <span
                  className={
                    isRealImage
                      ? "text-lab-success"
                      : "text-lab-danger"
                  }
                >
                  {isRealImage ? "倒立实像" : "正立虚像"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-lab-textMuted">放大率</span>
                <span className="font-mono">
                  {Math.abs(-theoreticalImageDistance / u).toFixed(3)}x
                </span>
              </div>

              <div className="border-t border-lab-bgLighter mt-3 pt-3">
                <div className="flex justify-between font-medium">
                  <span className="text-lab-textMuted">误差</span>
                  <span
                    className={`font-mono ${
                      Math.abs(measuredError) > 0.02
                        ? "text-lab-danger"
                        : "text-lab-success"
                    }`}
                  >
                    {measuredError.toFixed(3)} mm
                    {Math.abs(measuredError) > 0.02 && (
                      <span className="text-xs ml-1">(超限)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-lab-accent/5 border-lab-accent/30">
            <h3 className="font-medium mb-2 text-sm text-lab-accent">操作提示</h3>
            <ul className="text-xs text-lab-textMuted space-y-1">
              <li>• 左键拖拽：旋转视角</li>
              <li>• 滚轮：缩放</li>
              <li>• 右键拖拽：平移</li>
              <li>• 绿色：理论成像位置</li>
              <li>• 红色虚线：实测成像位置</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
