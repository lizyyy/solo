import { Canvas } from "@react-three/fiber"
import TermWall from "./TermWall"
import GridFloor from "./GridFloor"
import AxisLabels from "./AxisLabels"
import CameraController from "./CameraController"
import SceneEffects from "./SceneEffects"

export default function WallScene() {
  return (
    <Canvas
      camera={{ fov: 50, near: 0.1, far: 500, position: [15, 12, 15] }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      style={{ background: "#0a0e1a" }}
    >
      <color attach="background" args={["#0a0e1a"]} />
      <ambientLight intensity={0.4} />
      <directionalLight intensity={0.8} position={[10, 15, 10]} />
      <pointLight intensity={0.3} position={[-10, 10, -10]} color="#3b82f6" />
      <TermWall />
      <GridFloor />
      <AxisLabels />
      <CameraController />
      <SceneEffects />
    </Canvas>
  )
}
