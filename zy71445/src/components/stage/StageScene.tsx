import { useRef } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import * as THREE from "three"
import { useStore } from "@/store/useStore"
import StagePlatform from "./StagePlatform"
import LightBar from "./LightBar"
import HangingPoint from "./HangingPoint"
import Fixture from "./Fixture"
import ActorRoute from "./ActorRoute"
import CollisionHighlight from "./CollisionHighlight"

function SceneContent() {
  const { camera } = useThree()
  const scene = useStore((s) => s.scene)
  const setSelectedElement = useStore((s) => s.setSelectedElement)

  const handleCanvasClick = () => {
    setSelectedElement(null)
  }

  return (
    <group onClick={handleCanvasClick}>
      <ambientLight intensity={0.2} color="#444466" />
      <directionalLight
        position={[10, 15, 10]}
        intensity={0.6}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <hemisphereLight args={["#333355", "#111122", 0.4]} />

      <StagePlatform />

      {scene.lightBars.map((lb) => (
        <LightBar key={lb.id} data={lb} />
      ))}

      {scene.hangingPoints.map((hp) => (
        <HangingPoint key={hp.id} data={hp} />
      ))}

      {scene.fixtures.map((fix) => (
        <Fixture key={fix.id} data={fix} />
      ))}

      {scene.actorRoutes.map((ar) => (
        <ActorRoute key={ar.id} data={ar} />
      ))}

      {scene.collisions.map((col) => (
        <CollisionHighlight key={col.id} collision={col} />
      ))}

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.4}
        scale={30}
        blur={2}
        far={15}
        color="#000000"
      />

      <OrbitControls
        makeDefault
        minDistance={5}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2 - 0.1}
        enableDamping
        dampingFactor={0.05}
      />

      <Environment preset="night" />
    </group>
  )
}

export default function StageScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [12, 10, 12], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0f0f1a"]} />
      <fog attach="fog" args={["#0f0f1a", 25, 50]} />
      <SceneContent />
    </Canvas>
  )
}
