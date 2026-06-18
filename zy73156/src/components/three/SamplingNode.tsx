import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { Sample } from "@/data/types";
import { RECORD_KIND_META, READING_STATUS_META } from "@/data/types";
import { useOceanStore } from "@/store/useOceanStore";
import { fmtNum } from "@/lib/format";
import { STATUS_COLOR, STATUS_EMISSIVE } from "./colors";

interface Props {
  sample: Sample;
  position: [number, number, number];
}

export default function SamplingNode({ sample, position }: Props) {
  const selectedId = useOceanStore((s) => s.selectedSampleId);
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const selectSample = useOceanStore((s) => s.selectSample);
  const [hovered, setHovered] = useState(false);

  const reading = sample.readings[timeIndex];
  const status = reading?.status ?? "normal";
  const color = STATUS_COLOR[status];
  const isSelected = selectedId === sample.id;

  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      const s = 1 + (hovered ? 0.18 : 0) + Math.sin(t * 2) * 0.03;
      coreRef.current.scale.setScalar(s);
    }
    if (ringRef.current && isSelected) {
      const p = (t * 0.9) % 1;
      ringRef.current.scale.setScalar(1 + p * 1.8);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - p);
    }
    if (haloRef.current) {
      haloRef.current.rotation.z = t * 0.4;
    }
  });

  const kindMeta = RECORD_KIND_META[sample.kind];

  return (
    <group position={position}>
      {/* halo ring */}
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.15, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.5 : 0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* selection pulse ring */}
      {isSelected && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.0, 1.18, 48]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* core sphere */}
      <mesh
        ref={coreRef}
        onClick={(e) => {
          e.stopPropagation();
          selectSample(sample.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <icosahedronGeometry args={[0.62, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={STATUS_EMISSIVE[status]}
          roughness={0.25}
          metalness={0.4}
        />
      </mesh>

      {/* vertical beam to seabed */}
      <mesh position={[0, (-position[1] - 10) / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, -position[1] + 10, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>

      <Html center distanceFactor={11} position={[0, 1.5, 0]} zIndexRange={[20, 0]}>
        <div
          className={`pointer-events-none select-none whitespace-nowrap rounded-lg border px-2 py-1 text-center backdrop-blur-md transition ${
            isSelected
              ? "border-glow-cyan/60 bg-abyss-900/85 shadow-glow"
              : "border-white/10 bg-abyss-900/65"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${kindMeta.color.replace(
                "text-",
                "bg-",
              )}`}
            />
            <span className="font-mono text-[11px] font-semibold tracking-wide text-slate-100">
              {sample.code}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-white">
            {fmtNum(reading?.value ?? 0)}{" "}
            <span className="text-[9px] font-normal text-slate-400">{sample.unit}</span>
          </div>
          <div
            className={`mt-0.5 font-mono text-[9px] uppercase tracking-widest ${
              READING_STATUS_META[status].color
            }`}
          >
            {READING_STATUS_META[status].label}
          </div>
        </div>
      </Html>
    </group>
  );
}
