import React from 'react'
import { Canvas, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { ModelData, Issue, InspectionPoint } from '../types'
import { getIssueTypeName } from '../utils/detection'

interface ModelProps {
  model: ModelData
  isSelected: boolean
  hasIssue: boolean
  onClick: () => void
}

const ModelMesh = ({ model, isSelected, hasIssue, onClick }: ModelProps) => {
  const meshRef = React.useRef<THREE.Mesh>(null)
  
  const color = isSelected ? '#ff6b35' : (hasIssue ? '#dc3545' : (model.color || '#3498db'))
  
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick()
  }
  
  return (
    <mesh
      ref={meshRef}
      position={[model.position.x, model.position.y, model.position.z]}
      rotation={[model.rotation.x, model.rotation.y, model.rotation.z]}
      scale={[model.scale.x, model.scale.y, model.scale.z]}
      onClick={handleClick}
    >
      {model.geometry?.type === 'box' && (
        <boxGeometry 
          args={[
            model.geometry.dimensions.width,
            model.geometry.dimensions.height,
            model.geometry.dimensions.depth
          ]} 
        />
      )}
      {model.geometry?.type === 'cylinder' && (
        <cylinderGeometry 
          args={[
            model.geometry.dimensions.radius || 0.5,
            model.geometry.dimensions.radius || 0.5,
            model.geometry.dimensions.height
          ]} 
        />
      )}
      {model.geometry?.type === 'sphere' && (
        <sphereGeometry args={[model.geometry.dimensions.radius || 0.5]} />
      )}
      <meshStandardMaterial 
        color={color} 
        transparent 
        opacity={isSelected ? 0.9 : 0.8}
      />
      {isSelected && (
        <lineSegments>
          <edgesGeometry attach="geometry" args={[meshRef.current?.geometry]} />
          <lineBasicMaterial attach="material" color="#ff6b35" linewidth={2} />
        </lineSegments>
      )}
    </mesh>
  )
}

interface IssueMarkerProps {
  issue: Issue
  model: ModelData
  isSelected: boolean
  onClick: () => void
}

const IssueMarker = ({ issue, model, isSelected, onClick }: IssueMarkerProps) => {
  const markerColor = issue.status === 'PENDING' ? '#ffc107' : 
                      issue.status === 'CONFIRMED' ? '#dc3545' : '#28a745'
  
  return (
    <group position={[model.position.x, model.position.y + 2, model.position.z]}>
      <mesh onClick={(e) => { e.stopPropagation(); onClick() }}>
        <sphereGeometry args={[0.15]} />
        <meshBasicMaterial color={markerColor} />
      </mesh>
      {isSelected && (
        <Html center distanceFactor={10}>
          <div className="bg-white rounded-lg shadow-lg p-3 min-w-48 border-2 border-secondary">
            <div className="font-bold text-sm text-gray-800 mb-1">
              {getIssueTypeName(issue.type)}
            </div>
            <div className="text-xs text-gray-600 mb-2">{issue.reason}</div>
            <div className="text-xs text-secondary font-medium">
              下一步: {issue.nextStep}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

interface PathLineProps {
  points: InspectionPoint[]
}

const PathLine = ({ points }: PathLineProps) => {
  const linePoints = points.map(p => new THREE.Vector3(p.x, p.y, p.z))
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints)
  
  return (
    <line>
      <bufferGeometry attach="geometry" {...lineGeometry} />
      <lineBasicMaterial attach="material" color="#17a2b8" linewidth={3} />
    </line>
  )
}

interface Scene3DProps {
  models: ModelData[]
  issues: Issue[]
  inspectionPath: InspectionPoint[]
  selectedModelId: string | null
  selectedIssueId: string | null
  onModelSelect: (modelId: string | null) => void
  onIssueSelect: (issueId: string | null) => void
}

export const Scene3D = ({
  models,
  issues,
  inspectionPath,
  selectedModelId,
  selectedIssueId,
  onModelSelect,
  onIssueSelect
}: Scene3DProps) => {
  const getModelIssues = (modelId: string) => {
    return issues.filter(i => i.modelId === modelId || i.relatedModelId === modelId)
  }
  
  const selectedIssue = issues.find(i => i.id === selectedIssueId)
  
  return (
    <Canvas
      camera={{ position: [0, 10, 15], fov: 50 }}
      onClick={() => {
        onModelSelect(null)
        onIssueSelect(null)
      }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <hemisphereLight args={['#87CEEB', '#363636', 0.3]} />
      
      <gridHelper args={[30, 30, '#444444', '#333333']} />
      
      <PathLine points={inspectionPath} />
      
      {models.map(model => {
        const modelIssues = getModelIssues(model.id)
        const hasIssue = modelIssues.length > 0
        const isSelected = selectedModelId === model.id
        const isIssueSelected = selectedIssue && 
          (selectedIssue.modelId === model.id || selectedIssue.relatedModelId === model.id)
        
        return (
          <group key={model.id}>
            <ModelMesh
              model={model}
              isSelected={isSelected || isIssueSelected}
              hasIssue={hasIssue}
              onClick={() => onModelSelect(model.id)}
            />
            {modelIssues.map(issue => (
              <IssueMarker
                key={issue.id}
                issue={issue}
                model={model}
                isSelected={selectedIssueId === issue.id}
                onClick={() => onIssueSelect(issue.id)}
              />
            ))}
          </group>
        )
      })}
      
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
      />
    </Canvas>
  )
}
