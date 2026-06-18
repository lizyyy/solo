export default function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.35} color="#1a4a6b" />
      <directionalLight
        position={[0, 12, 2]}
        intensity={1.1}
        color="#7fdfff"
      />
      <pointLight position={[-8, 2, -8]} intensity={40} color="#22D3EE" distance={26} />
      <pointLight position={[8, -2, 8]} intensity={30} color="#38BDF8" distance={24} />
      <hemisphereLight args={["#0a3a5c", "#020608", 0.5]} />
    </>
  );
}
