import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { TREES } from '../data/trees';
import { useStore } from '../store/useStore';
import { TERRAIN_DATA, getTerrainHeight } from '../data/terrain';

export function Trees() {
  const showTrees = useStore(state => state.showTrees);
  const season = useStore(state => state.season);
  
  const trunkInstancedRef = useRef<THREE.InstancedMesh>(null);
  const foliageInstancedRef = useRef<THREE.InstancedMesh>(null);

  const trunkGeometry = useMemo(() => new THREE.CylinderGeometry(0.2, 0.3, 1, 6), []);
  const foliageGeometry = useMemo(() => new THREE.ConeGeometry(1.5, 3, 8), []);

  useEffect(() => {
    if (!trunkInstancedRef.current || !foliageInstancedRef.current) return;

    const dummy = new THREE.Object3D();
    const treeHeightFactor = season.treeHeightFactor;

    TREES.forEach((tree, i) => {
      const terrainY = getTerrainHeight(tree.position.x, tree.position.z, TERRAIN_DATA);
      
      const trunkHeight = tree.height * 0.6 * treeHeightFactor;
      dummy.position.set(tree.position.x, terrainY + trunkHeight / 2, tree.position.z);
      dummy.scale.set(1, trunkHeight, 1);
      dummy.updateMatrix();
      trunkInstancedRef.current!.setMatrixAt(i, dummy.matrix);
      
      const foliageHeight = tree.height * treeHeightFactor;
      dummy.position.set(tree.position.x, terrainY + foliageHeight * 0.7, tree.position.z);
      dummy.scale.set(foliageHeight / 4, foliageHeight / 2.5, foliageHeight / 4);
      dummy.updateMatrix();
      foliageInstancedRef.current!.setMatrixAt(i, dummy.matrix);
    });

    trunkInstancedRef.current.instanceMatrix.needsUpdate = true;
    foliageInstancedRef.current.instanceMatrix.needsUpdate = true;
  }, [season.treeHeightFactor, trunkGeometry, foliageGeometry]);

  if (!showTrees) return null;

  const seasonColor = season.id === 'autumn' ? '#DAA520' :
                      season.id === 'winter' ? '#90EE90' :
                      season.id === 'spring' ? '#98FB98' : '#228B22';

  return (
    <>
      <instancedMesh
        ref={trunkInstancedRef}
        args={[trunkGeometry, undefined, TREES.length]}
        castShadow
      >
        <meshStandardMaterial color="#8B4513" roughness={0.9} />
      </instancedMesh>
      
      <instancedMesh
        ref={foliageInstancedRef}
        args={[foliageGeometry, undefined, TREES.length]}
        castShadow
      >
        <meshStandardMaterial
          color={seasonColor}
          roughness={0.8}
          transparent
          opacity={0.5 + season.foliageDensity * 0.5}
        />
      </instancedMesh>
    </>
  );
}
