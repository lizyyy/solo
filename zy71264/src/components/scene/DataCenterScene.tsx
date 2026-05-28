import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { RackArray } from './RackArray'
import { CRACUnits } from './CRACUnits'
import { AirflowArrows } from './AirflowArrows'
import { HeatmapOverlay } from './HeatmapOverlay'
import { SectionPlane } from './SectionPlane'
import { useStore } from '@/store/useStore'

interface DataCenterSceneProps {
  readonly?: boolean
}

export function DataCenterScene({ readonly = false }: DataCenterSceneProps) {
  const { paramSet, sectionPlaneY, showAirflow, showHeatmap } = useStore()

  return (
    <>
      <ambientLight intensity={0.3} color="#8aa5c0" />
      <directionalLight
        intensity={0.6}
        position={[10, 20, 10]}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {paramSet.cracUnits.map((crac) => (
        <pointLight
          key={crac.id}
          position={crac.position}
          color="#00d4ff"
          intensity={0.5}
          distance={10}
        />
      ))}

      <gridHelper
        args={[20, 20, '#1e3a52', '#152232']}
        position={[0, 0.01, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0a141f" />
      </mesh>

      <SectionPlane sectionY={sectionPlaneY} />
      <RackArray readonly={readonly} />
      <CRACUnits />
      {showAirflow && <AirflowArrows />}
      {showHeatmap && <HeatmapOverlay />}

      <OrbitControls
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={40}
        enableDamping
        dampingFactor={0.05}
        makeDefault
      />

      <EffectComposer>
        <Bloom luminanceThreshold={0.4} intensity={0.8} mipmapBlur />
      </EffectComposer>
    </>
  )
}
