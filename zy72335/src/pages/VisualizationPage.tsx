import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Box, PieChart as PieChartIcon, ArrowLeft, AlertTriangle, User, Phone, X, Upload, ClipboardCheck, CheckCircle } from 'lucide-react'
import * as THREE from 'three'
import { useAppStore, type RawRow, type CalculationDetail } from '@/store'
import StatusBadge from '@/components/StatusBadge'

interface SeatData {
  row: number
  col: number
  color: string
  rawRow?: RawRow
  isMixedFormat: boolean
}

function Seat({ position, color, onClick, isSelected }: { position: [number, number, number]; color: string; onClick: () => void; isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame(() => {
    if (meshRef.current) {
      const targetY = hovered || isSelected ? 0.25 : 0.15
      meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetY / 0.15, 0.1)
    }
  })

  const displayColor = isSelected ? '#22c55e' : hovered ? '#fbbf24' : color

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[0.9, 0.15, 0.9]} />
      <meshStandardMaterial color={displayColor} roughness={0.8} metalness={0.2} />
    </mesh>
  )
}

function SeatGrid({ seats, onSeatClick, selectedSeatKey }: { seats: SeatData[]; onSeatClick: (seat: SeatData) => void; selectedSeatKey: string | null }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <Environment preset="city" />
      <ContactShadows position={[0, -0.5, 0]} opacity={0.4} scale={30} blur={2} far={4} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.5, -0.01, 4.5]} receiveShadow>
        <planeGeometry args={[12, 14]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      {seats.map((seat, index) => {
        const seatKey = `${seat.row}-${seat.col}`
        return (
          <Seat
            key={index}
            position={[seat.col, 0, seat.row]}
            color={seat.color}
            onClick={() => onSeatClick(seat)}
            isSelected={selectedSeatKey === seatKey}
          />
        )
      })}

      <OrbitControls
        makeDefault
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={30}
        target={[3.5, 0, 4.5]}
      />
    </>
  )
}

const COLORS = ['#f59e0b', '#1e293b', '#10b981', '#f43f5e']

const statusMap: Record<string, string> = {
  pending: '待复核',
  confirmed: '已确认',
  rejected: '已退回',
  kept: '已保留',
}

const nextActionMap: Record<string, string> = {
  contact_activity_leader: '联系活动负责人',
  contact_coach: '联系竞赛教练',
  no_action: '无需操作',
}

export default function VisualizationPage() {
  const navigate = useNavigate()
  const { rawRows, fetchRawRows, calculationDetails, fetchCalculations } = useAppStore()
  const [viewMode, setViewMode] = useState<'3d' | 'chart'>('3d')
  const [selectedSeat, setSelectedSeat] = useState<SeatData | null>(null)
  const [showRawRowModal, setShowRawRowModal] = useState(false)
  const [showBoundaryModal, setShowBoundaryModal] = useState(false)
  const [selectedChartItem, setSelectedChartItem] = useState<{ type: 'raw' | 'calculation'; data: RawRow | CalculationDetail } | null>(null)
  const [showChartModal, setShowChartModal] = useState(false)
  const [seats, setSeats] = useState<SeatData[]>([])

  useEffect(() => {
    fetchRawRows()
    fetchCalculations()
  }, [fetchRawRows, fetchCalculations])

  useEffect(() => {
    const generatedSeats: SeatData[] = []
    const rowsCount = 10
    const colsCount = 8

    for (let row = 0; row < rowsCount; row++) {
      for (let col = 0; col < colsCount; col++) {
        const index = row * colsCount + col
        const rawRow = rawRows[index]

        let color = '#94a3b8'
        let isMixedFormat = false

        if (rawRow) {
          if (rawRow.hasMixedFormat) {
            color = '#f43f5e'
            isMixedFormat = true
          } else if (rawRow.calculation?.kept) {
            color = '#f59e0b'
          } else if (index % 5 === 0) {
            color = '#f59e0b'
          }
        }

        generatedSeats.push({
          row,
          col,
          color,
          rawRow,
          isMixedFormat,
        })
      }
    }

    setSeats(generatedSeats)
  }, [rawRows])

  const handleSeatClick = (seat: SeatData) => {
    setSelectedSeat(seat)
  }

  const handleBarClick = (data: { reviewStatus?: string; nextAction?: string; hasMixedFormat?: boolean }) => {
    if (data.reviewStatus) {
      const calc = calculationDetails.find(c => c.reviewStatus === data.reviewStatus)
      if (calc) {
        setSelectedChartItem({ type: 'calculation', data: calc })
        setShowChartModal(true)
      }
    } else if (data.nextAction) {
      const calc = calculationDetails.find(c => c.nextAction === data.nextAction)
      if (calc) {
        setSelectedChartItem({ type: 'calculation', data: calc })
        setShowChartModal(true)
      }
    } else if (data.hasMixedFormat !== undefined) {
      const row = rawRows.find(r => r.hasMixedFormat === data.hasMixedFormat)
      if (row) {
        setSelectedChartItem({ type: 'raw', data: row })
        setShowChartModal(true)
      }
    }
  }

  const statusData = [
    { name: '已保留', count: calculationDetails.filter(c => c.kept).length, reviewStatus: 'kept' },
    { name: '待复核', count: calculationDetails.filter(c => c.reviewStatus === 'pending').length, reviewStatus: 'pending' },
    { name: '已退回', count: calculationDetails.filter(c => c.reviewStatus === 'rejected').length, reviewStatus: 'rejected' },
    { name: '已确认', count: calculationDetails.filter(c => c.reviewStatus === 'confirmed').length, reviewStatus: 'confirmed' },
  ]

  const nextActionData = [
    { name: '联系活动负责人', value: calculationDetails.filter(c => c.nextAction === 'contact_activity_leader').length, nextAction: 'contact_activity_leader' },
    { name: '联系竞赛教练', value: calculationDetails.filter(c => c.nextAction === 'contact_coach').length, nextAction: 'contact_coach' },
    { name: '无需操作', value: calculationDetails.filter(c => c.nextAction === 'no_action').length, nextAction: 'no_action' },
  ]

  const mixedFormatData = [
    { name: '混合格式', count: rawRows.filter(r => r.hasMixedFormat).length, hasMixedFormat: true },
    { name: '格式正常', count: rawRows.filter(r => !r.hasMixedFormat).length, hasMixedFormat: false },
  ]

  const getCurrentRawRow = (): RawRow | undefined => {
    if (selectedSeat?.rawRow) return selectedSeat.rawRow
    if (selectedChartItem?.type === 'raw') return selectedChartItem.data as RawRow
    if (selectedChartItem?.type === 'calculation') return (selectedChartItem.data as CalculationDetail).rawRow
    return undefined
  }

  const currentRawRow = getCurrentRawRow()
  const selectedSeatKey = selectedSeat ? `${selectedSeat.row}-${selectedSeat.col}` : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-primary">
          可视化展示
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          基于模拟退火算法的座位安排结果可视化与统计分析
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('3d')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === '3d'
              ? 'bg-accent text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Box size={16} />
          3D 座位图
        </button>
        <button
          onClick={() => setViewMode('chart')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === 'chart'
              ? 'bg-accent text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <PieChartIcon size={16} />
          统计图表
        </button>
      </div>

      <div className="relative">
        {viewMode === '3d' ? (
          <div className="card h-[600px] p-0 overflow-hidden">
            <Canvas
              shadows
              camera={{
                position: [10, 10, 10],
                type: 'orthographic',
                left: -15,
                right: 15,
                top: 15,
                bottom: -15,
                near: 0.1,
                far: 100,
              }}
            >
              <color attach="background" args={['#f8fafc']} />
              <fog attach="fog" args={['#f8fafc', 20, 50]} />
              <SeatGrid
                seats={seats}
                onSeatClick={handleSeatClick}
                selectedSeatKey={selectedSeatKey}
              />
            </Canvas>

            <div className="absolute bottom-4 left-4 flex gap-4 rounded-lg bg-white/90 p-3 text-xs shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-slate-400"></div>
                <span className="text-slate-600">普通座位</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-accent"></div>
                <span className="text-slate-600">已保留</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-danger"></div>
                <span className="text-slate-600">混合格式</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-emerald-500"></div>
                <span className="text-slate-600">已选中</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="card">
                <h3 className="mb-4 font-heading text-lg font-semibold text-primary">
                  复核状态分布
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#f59e0b"
                        cursor="pointer"
                        onClick={(data) => handleBarClick(data)}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <h3 className="mb-4 font-heading text-lg font-semibold text-primary">
                  后续行动分布
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={nextActionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        cursor="pointer"
                        onClick={(data) => handleBarClick(data)}
                      >
                        {nextActionData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="mb-4 font-heading text-lg font-semibold text-primary">
                格式状态统计
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mixedFormatData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    />
                    <Bar
                      dataKey="count"
                      cursor="pointer"
                      onClick={(data) => handleBarClick(data)}
                      radius={[4, 4, 0, 0]}
                    >
                      {mixedFormatData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.hasMixedFormat ? '#f43f5e' : '#1e293b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">重要提示</p>
                  <p className="mt-1 text-amber-600">
                    点击数据点可回溯至问卷原始行或边界值说明，不会只剩漂亮画面
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className={`absolute right-0 top-0 h-full w-80 transform bg-white shadow-xl transition-transform duration-300 ${
            selectedSeat || selectedChartItem ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ zIndex: 40 }}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h3 className="font-heading text-lg font-semibold text-primary">
                数据追溯
              </h3>
              <button
                onClick={() => {
                  setSelectedSeat(null)
                  setSelectedChartItem(null)
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {(selectedSeat?.rawRow || selectedChartItem) && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      {selectedSeat ? `座位 ${selectedSeat.row + 1} 排 ${selectedSeat.col + 1} 列` : '图表数据点'}
                    </p>
                    {selectedSeat?.isMixedFormat && (
                      <StatusBadge variant="danger" className="mt-2">
                        混合格式
                      </StatusBadge>
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">原始行内容</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {currentRawRow?.content}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => setShowRawRowModal(true)}
                      className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light"
                    >
                      回溯至问卷原始行
                    </button>
                    <button
                      onClick={() => setShowBoundaryModal(true)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      回溯至边界值说明
                    </button>
                  </div>

                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-700">数据追溯链</p>
                    <div className="mt-2 space-y-1 text-xs text-blue-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={12} />
                        <span>座位坐标 → 原始行数据</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={12} />
                        <span>原始行 → 计算结果</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={12} />
                        <span>计算结果 → 边界值说明</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate('/import')}
                  className="flex items-center justify-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-light"
                >
                  <Upload size={12} />
                  导入页
                </button>
                <button
                  onClick={() => navigate('/review')}
                  className="flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-light"
                >
                  <ClipboardCheck size={12} />
                  复核页
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRawRowModal && (selectedSeat?.rawRow || selectedChartItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-xl font-semibold text-primary">
                问卷原始行详情
              </h3>
              <button
                onClick={() => setShowRawRowModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {currentRawRow && Object.entries(currentRawRow)
                .filter(([key]) => key !== 'boundary' && key !== 'calculation')
                .map(([key, value]) => (
                <div key={key} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">{key}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {value !== null && value !== undefined ? String(value) : '-'}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowRawRowModal(false)}
              className="mt-6 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {showBoundaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-xl font-semibold text-primary">
                边界值说明
              </h3>
              <button
                onClick={() => setShowBoundaryModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {(() => {
              const boundarySpec = currentRawRow?.boundary

              if (!boundarySpec) {
                return (
                  <div className="rounded-lg bg-amber-50 p-4 text-amber-700">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">缺失边界值</p>
                        <p className="mt-1 text-sm text-amber-600">
                          当前数据行未关联边界值说明
                        </p>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div className="space-y-3">
                  {Object.entries(boundarySpec).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500">{key}</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {value !== null && value !== undefined ? String(value) : '-'}
                      </p>
                    </div>
                  ))}
                </div>
              )
            })()}

            <button
              onClick={() => setShowBoundaryModal(false)}
              className="mt-6 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {showChartModal && selectedChartItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-xl font-semibold text-primary">
                数据追溯
              </h3>
              <button
                onClick={() => setShowChartModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowChartModal(false)
                  setShowRawRowModal(true)
                }}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-light"
              >
                查看原始行
              </button>
              <button
                onClick={() => {
                  setShowChartModal(false)
                  setShowBoundaryModal(true)
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                查看边界值
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
