import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Light } from '../../types';

interface LightBeamProps {
  light: Light;
}

export default function LightBeam({ light }: LightBeamProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { position, geometry, material } = useMemo(() => {
    const start = new THREE.Vector3(light.position.x, light.position.y, light.position.z);
    const end = new THREE.Vector3(light.target.x, light.target.y, light.target.z);
    const direction = end.clone().sub(start).normalize();
    const length = 25;
    
    const actualEnd = start.clone().add(direction.multiplyScalar(length));
    const midPoint = start.clone().lerp(actualEnd, 0.5);
    
    const beamLength = start.distanceTo(actualEnd);
    const angleRad = (light.beamAngle * Math.PI) / 180;
    const topRadius = 0.05;
    const bottomRadius = Math.tan(angleRad / 2) * beamLength + topRadius;

    const color = new THREE.Color(light.color);

    return {
      position: midPoint,
      geometry: new THREE.CylinderGeometry(topRadius, bottomRadius, beamLength, 32, 1, true),
      material: new THREE.ShaderMaterial({
        uniforms: {
          color: { value: color },
          intensity: { value: light.intensity },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying float vHeight;
          void main() {
            vNormal = normal;
            vHeight = position.y / 2.0 + 0.5;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float intensity;
          varying vec3 vNormal;
          varying float vHeight;
          void main() {
            float alpha = (1.0 - vHeight) * 0.4 * intensity;
            float edge = smoothstep(0.0, 0.1, abs(vNormal.x + vNormal.z));
            alpha *= 0.3 + edge * 0.7;
            gl_FragColor = vec4(color, alpha * intensity);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    };
  }, [light.position, light.target, light.beamAngle, light.color, light.intensity]);

  const rotation = useMemo(() => {
    const start = new THREE.Vector3(light.position.x, light.position.y, light.position.z);
    const end = new THREE.Vector3(light.target.x, light.target.y, light.target.z);
    const direction = end.clone().sub(start).normalize();
    
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    return [euler.x, euler.y, euler.z] as [number, number, number];
  }, [light.position, light.target]);

  if (!light.enabled || light.intensity <= 0) return null;

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      geometry={geometry}
      material={material}
    />
  );
}
