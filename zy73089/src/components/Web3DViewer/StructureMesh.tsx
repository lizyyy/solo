import { useRef, useMemo } from 'react';
import type { Mesh, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import type { ModelComponent } from '@/shared/types';
import { useChecklistStore } from '@/store/checklistStore';
import { useUiStore } from '@/store/uiStore';

interface Props {
  component: ModelComponent;
}

function getMat(mesh: Mesh): MeshStandardMaterial {
  return mesh.material as MeshStandardMaterial;
}

export function StructureMesh({ component }: Props) {
  const ref = useRef<Mesh>(null!);
  const currentBatchId = useChecklistStore((s) => s.currentBatchId);
  const batches = useChecklistStore((s) => s.batches);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const filteredComponentIds = useUiStore((s) => s.filters.componentIds);
  const timelineDate = useUiStore((s) => s.timelineDate);
  const visaForms = useChecklistStore((s) => s.visaForms);
  const matSubs = useChecklistStore((s) => s.materialSubmissions);
  const selectComponent = useUiStore((s) => s.selectComponent);

  const batch = currentBatchId ? batches[currentBatchId] : null;
  const item = batch?.items.find((i) => i.componentId === component.id);
  const issues = batch?.issues.filter((i) => {
    const cid = batch.items.find((it) => it.itemId === i.itemId)?.componentId;
    return cid === component.id;
  });
  const hasBlockingIssue = issues?.some((i) => i.blocksFinalReport);
  const hasAnyIssue = (issues?.length ?? 0) > 0;

  const isSelected = selectedId === component.id;
  const isInFilter = filteredComponentIds.length === 0 || filteredComponentIds.includes(component.id);

  const visa = Object.values(visaForms).find((v) => v.componentId === component.id);
  const mat = Object.values(matSubs).find((m) => m.componentId === component.id);
  let dimByTimeline = false;
  if (timelineDate) {
    const td = new Date(timelineDate).getTime();
    const vd = visa?.issueDate ? new Date(visa.issueDate).getTime() : Infinity;
    const md = mat?.submitDate ? new Date(mat.submitDate).getTime() : Infinity;
    if (vd > td && md > td) dimByTimeline = true;
  }

  const { baseColor, emissiveColor, opacity } = useMemo(() => {
    if (hasBlockingIssue)
      return { baseColor: '#EA580C', emissiveColor: '#F97316', opacity: isInFilter && !dimByTimeline ? 0.92 : 0.25 };
    if (hasAnyIssue)
      return { baseColor: '#B45309', emissiveColor: '#F59E0B', opacity: isInFilter && !dimByTimeline ? 0.9 : 0.25 };
    if (item?.matchStatus === 'matched')
      return { baseColor: '#0F766E', emissiveColor: '#10B981', opacity: isInFilter && !dimByTimeline ? 0.85 : 0.2 };
    if (item?.matchStatus === 'pending')
      return { baseColor: component.color, emissiveColor: '#60A5FA', opacity: isInFilter && !dimByTimeline ? 0.7 : 0.2 };
    return {
      baseColor: component.color,
      emissiveColor: isSelected ? '#3B82F6' : '#1E3A8A',
      opacity: isInFilter && !dimByTimeline ? 0.8 : 0.2,
    };
  }, [component.color, hasBlockingIssue, hasAnyIssue, item?.matchStatus, isSelected, isInFilter, dimByTimeline]);

  useFrame((state) => {
    if (!ref.current) return;
    const mat = getMat(ref.current);
    if (hasBlockingIssue) {
      const t = state.clock.getElapsedTime();
      const pulse = 0.35 + 0.25 * Math.sin(t * 3);
      mat.emissiveIntensity = pulse;
    } else if (isSelected) {
      const t = state.clock.getElapsedTime();
      mat.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * 2.4);
    } else {
      mat.emissiveIntensity = 0.08;
    }
  });

  const center = [
    component.position.x + component.size.x / 2,
    component.position.y + component.size.y / 2,
    component.position.z + component.size.z / 2,
  ] as const;

  return (
    <mesh
      ref={ref}
      position={center}
      onClick={(e) => {
        e.stopPropagation();
        selectComponent(component.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[component.size.x, component.size.y, component.size.z]} />
      <meshStandardMaterial
        color={isSelected ? '#F59E0B' : baseColor}
        emissive={isSelected ? '#F97316' : emissiveColor}
        emissiveIntensity={0.1}
        transparent
        opacity={opacity}
        metalness={0.25}
        roughness={0.55}
        flatShading
      />
    </mesh>
  );
}
