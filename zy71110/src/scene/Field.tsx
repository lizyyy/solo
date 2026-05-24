import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

export function Field() {
  const field = useStore((state) => state.field);
  const environment = useStore((state) => state.environment);

  const { width, height } = field;
  const { slope, slopeDirection } = environment;

  const fieldGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(width, height, 50, 50);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const slopeRad = (slope * Math.PI) / 180;
    const dirRad = (slopeDirection * Math.PI) / 180;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      const proj = x * Math.cos(dirRad) + z * Math.sin(dirRad);
      const elevation = proj * Math.tan(slopeRad);

      positions.setY(i, elevation);
    }

    geometry.computeVertexNormals();
    return geometry;
  }, [width, height, slope, slopeDirection]);

  const fieldMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x4a7c39,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  }, []);

  const borderGeometry = useMemo(() => {
    const halfW = width / 2;
    const halfH = height / 2;
    const points = [
      new THREE.Vector3(-halfW, 0.02, -halfH),
      new THREE.Vector3(halfW, 0.02, -halfH),
      new THREE.Vector3(halfW, 0.02, halfH),
      new THREE.Vector3(-halfW, 0.02, halfH),
      new THREE.Vector3(-halfW, 0.02, -halfH),
    ];

    const slopeRad = (slope * Math.PI) / 180;
    const dirRad = (slopeDirection * Math.PI) / 180;

    points.forEach((p) => {
      const proj = p.x * Math.cos(dirRad) + p.z * Math.sin(dirRad);
      p.y += proj * Math.tan(slopeRad);
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [width, height, slope, slopeDirection]);

  const borderMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0x2d5a27,
        linewidth: 3,
      }),
    []
  );

  const gridHelper = useMemo(() => {
    const helper = new THREE.GridHelper(Math.max(width, height) + 10, 20, 0x666666, 0x444444);
    helper.position.y = -0.01;
    return helper;
  }, [width, height]);

  return (
    <group>
      <mesh geometry={fieldGeometry} material={fieldMaterial} receiveShadow />
      <primitive object={new THREE.Line(borderGeometry, borderMaterial)} />
      <primitive object={gridHelper} />
    </group>
  );
}
