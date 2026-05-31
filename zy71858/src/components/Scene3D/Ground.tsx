export function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
      <planeGeometry args={[300, 300]} />
      <meshStandardMaterial color="#789461" roughness={1} />
    </mesh>
  );
}
