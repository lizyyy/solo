import { useState, useRef, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Link2, AlertTriangle, Boxes, BarChart3, ShieldAlert } from 'lucide-react'
import * as THREE from 'three'

function SceneNode({ position, color, label, isLeaked, onClick }: {
  position: [number, number, number]
  color: string
  label: string
  isLeaked: boolean
  onClick: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(hovered ? 1.3 : 1)
    }
  })

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial
          color={hovered ? '#ffffff' : color}
          emissive={isLeaked ? '#ef4444' : '#f59e0b'}
          emissiveIntensity={hovered ? 0.8 : 0.3}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>
      <Text
        position={[0, -0.7, 0]}
        fontSize={0.18}
        color="#94a3b8"
        anchorX="center"
        anchorY="top"
      >
        {label}
      </Text>
    </group>
  )
}

function Scene({ onNodeClick }: { onNodeClick: (recordId: string) => void }) {
  const records = useStore((s) => s.records)
  const phoneExposures = useStore((s) => s.phoneExposures)

  const nodes = useMemo(() => {
    return records.map((record, i) => {
      const angle = (i / records.length) * Math.PI * 2
      const radius = 3
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const leaked = phoneExposures.filter((e) => e.recordId === record.id && e.isLeaked).length
      return {
        position: [x, 0, z] as [number, number, number],
        color: leaked > 0 ? '#ef4444' : '#10b981',
        label: record.title.split('-')[0],
        isLeaked: leaked > 0,
        recordId: record.id,
      }
    })
  }, [records, phoneExposures])

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#f59e0b" />
      <OrbitControls enableZoom enablePan={false} />

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.4} wireframe />
      </mesh>

      {nodes.map((node) => (
        <SceneNode
          key={node.recordId}
          position={node.position}
          color={node.color}
          label={node.label}
          isLeaked={node.isLeaked}
          onClick={() => onNodeClick(node.recordId)}
        />
      ))}
    </>
  )
}

export default function VisualPage() {
  const records = useStore((s) => s.records)
  const phoneExposures = useStore((s) => s.phoneExposures)
  const knowledgeLinks = useStore((s) => s.knowledgeLinks)
  const feedbackTickets = useStore((s) => s.feedbackTickets)
  const navigate = useNavigate()
  const [view, setView] = useState<'3d' | 'chart'>('chart')

  const barData = records.map((record) => {
    const exposures = phoneExposures.filter((e) => e.recordId === record.id)
    return {
      name: record.title.split('-')[0],
      全部: exposures.length,
      漏遮: exposures.filter((e) => e.isLeaked).length,
      已遮盖: exposures.filter((e) => !e.isLeaked).length,
    }
  })

  const pieData = [
    { name: '漏遮', value: phoneExposures.filter((e) => e.isLeaked).length, color: '#ef4444' },
    { name: '已遮盖', value: phoneExposures.filter((e) => !e.isLeaked).length, color: '#10b981' },
  ]

  const handleNodeClick = (recordId: string) => {
    const record = records.find((r) => r.id === recordId)
    if (!record) return

    const exposures = phoneExposures.filter((e) => e.recordId === recordId && e.isLeaked)
    const links = knowledgeLinks.filter((l) => l.recordId === recordId)
    const tickets = feedbackTickets.filter((t) => t.recordId === recordId)

    if (exposures.length > 0 && links.length > 0) {
      window.open(links[0].url, '_blank')
    } else if (tickets.length > 0) {
      navigate('/export')
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">3D / 图表展示</h2>
          <p className="text-sm text-slate-500 mt-1">点击漏遮节点可回溯到知识库链接或工单</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setView('chart')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              view === 'chart' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 size={14} />
            图表
          </button>
          <button
            onClick={() => setView('3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              view === '3d' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Boxes size={14} />
            3D
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#16162a] border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">手机号遮盖分布</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="漏遮" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="已遮盖" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#16162a] border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">漏遮占比</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2 bg-[#16162a] border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">漏遮回溯入口</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {records.map((record) => {
                const leaked = phoneExposures.filter((e) => e.recordId === record.id && e.isLeaked)
                const links = knowledgeLinks.filter((l) => l.recordId === record.id)
                const tickets = feedbackTickets.filter((t) => t.recordId === record.id)

                return (
                  <div key={record.id} className="bg-slate-900/30 border border-slate-800 rounded-lg p-4">
                    <h4 className="text-sm text-slate-200 mb-2">{record.title}</h4>
                    {leaked.length > 0 ? (
                      <div className="space-y-2">
                        {leaked.map((exp) => (
                          <div key={exp.id} className="flex items-center gap-2">
                            <ShieldAlert size={12} className="text-red-400" />
                            <span className="font-mono text-xs text-red-400">{exp.maskedPhone}</span>
                            {links.length > 0 && (
                              <button
                                onClick={() => window.open(links[0].url, '_blank')}
                                className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 ml-auto"
                              >
                                <Link2 size={10} />
                                知识库链接
                              </button>
                            )}
                            {tickets.length > 0 && (
                              <button
                                onClick={() => navigate('/export')}
                                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                              >
                                <AlertTriangle size={10} />
                                工单
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-emerald-400">全部已遮盖</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#16162a] border border-slate-800 rounded-xl overflow-hidden" style={{ height: 500 }}>
          <Canvas camera={{ position: [0, 3, 8], fov: 50 }}>
            <Scene onNodeClick={handleNodeClick} />
          </Canvas>
        </div>
      )}
    </div>
  )
}
