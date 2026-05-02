import React, { useEffect, useRef } from 'react';
import { StageRenderer } from '@/renderer/StageRenderer';
import type { StageProject, Risk } from '@/types';

interface Stage3DViewProps {
  project: StageProject;
  currentTime: number;
  currentRisks: Risk[];
  selectedType: 'light' | 'rig' | 'actor' | null;
  selectedId: string | null;
  onSelect: (type: 'light' | 'rig' | 'actor', id: string) => void;
}

export const Stage3DView: React.FC<Stage3DViewProps> = ({
  project,
  currentTime,
  currentRisks,
  selectedType,
  selectedId,
  onSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<StageRenderer | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const renderer = new StageRenderer({
      canvas: document.createElement('canvas'),
      width,
      height,
    });

    container.appendChild(renderer['renderer'].domElement);
    renderer.setProject(project);
    renderer.setOnSelect(onSelect);
    renderer.start();

    rendererRef.current = renderer;
    initializedRef.current = true;

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer['renderer'].domElement)) {
        container.removeChild(renderer['renderer'].domElement);
      }
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.setProject(project);
  }, [project]);

  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.updateTime(currentTime);
  }, [currentTime]);

  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.updateRisks(currentRisks);
  }, [currentRisks]);

  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.setSelected(selectedType, selectedId);
  }, [selectedType, selectedId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        backgroundColor: '#1a1a2e',
        position: 'relative',
      }}
    />
  );
};
