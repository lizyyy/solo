import { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line, Text, Stars } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { TreeNodeData } from '@/types'
import { useExposureStore } from '@/store/exposureStore'

function TreeNodeMesh({ node, isSelected, onClick }: { node: TreeNodeData; isSelected: boolean; onClick: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame(() => {
    if (meshRef.current) {
      const target = hovered ? 1.2 : 1.0
      meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.1)
    }
  })

  const emissiveIntensity = isSelected ? 0.8 : hovered ? 0.5 : 0.2
  const color = node.type === 'root' ? '#4A90D9' : node.type === 'subsidiary' ? '#5B9BD5' : node.color

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[node.size, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.3}
          metalness={0.6}
          transparent
          opacity={0.9}
        />
      </mesh>
      {node.hedged && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[node.size * 1.5, 0.05, 16, 64]} />
          <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.6} transparent opacity={0.8} />
        </mesh>
      )}
      <Text
        position={[0, node.size + 0.4, 0]}
        fontSize={0.28}
        color={hovered || isSelected ? '#ffffff' : '#8899AA'}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/notosanssc/v36/k3kJo84MPvpLmixcA63oeALZTYKLgASIOQ.119.woff2"
      >
        {node.label}
      </Text>
      {node.netExposure !== undefined && (
        <Text
          position={[0, -(node.size + 0.3), 0]}
          fontSize={0.22}
          color={node.direction === 'LONG' ? '#00E5A0' : '#FF6B6B'}
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/notosanssc/v36/k3kJo84MPvpLmixcA63oeALZTYKLgASIOQ.119.woff2"
        >
          {node.direction === 'LONG' ? '+' : ''}{formatAmount(node.netExposure)}
        </Text>
      )}
    </group>
  )
}

function TreeEdges({ root }: { root: TreeNodeData }) {
  const lines = useMemo(() => {
    const result: { start: [number, number, number]; end: [number, number, number]; color: string }[] = []
    root.children.forEach((sub) => {
      result.push({ start: root.position, end: sub.position, color: '#2A4A6A' })
      sub.children.forEach((cur) => {
        result.push({ start: sub.position, end: cur.position, color: cur.color })
      })
    })
    return result
  }, [root])

  return (
    <>
      {lines.map((l, i) => (
        <Line
          key={i}
          points={[l.start, l.end]}
          color={l.color}
          lineWidth={1.5}
          transparent
          opacity={0.5}
        />
      ))}
    </>
  )
}

function SceneContent({ treeData }: { treeData: TreeNodeData }) {
  const selectedNodeId = useExposureStore((s) => s.selectedNodeId)
  const setSelectedNodeId = useExposureStore((s) => s.setSelectedNodeId)

  const renderNodes = (node: TreeNodeData): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [
      <TreeNodeMesh
        key={node.id}
        node={node}
        isSelected={selectedNodeId === node.id}
        onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
      />
    ]
    node.children.forEach((child) => {
      nodes.push(...renderNodes(child))
    })
    return nodes
  }

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 15, 10]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-8, 5, -5]} intensity={0.4} color="#00E5A0" />
      <pointLight position={[5, -5, 8]} intensity={0.3} color="#FF6B6B" />
      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      <TreeEdges root={treeData} />
      {renderNodes(treeData)}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={25}
        makeDefault
      />
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.2} />
      </EffectComposer>
    </>
  )
}

export default function TreeScene({ treeData }: { treeData: TreeNodeData }) {
  return (
    <div id="tree-3d-scene" className="w-full h-full">
      <Canvas
        camera={{ position: [0, 10, 14], fov: 50, near: 0.1, far: 1000 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => { gl.setClearColor('#0A1628') }}
      >
        <SceneContent treeData={treeData} />
      </Canvas>
    </div>
  )
}

function formatAmount(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}
