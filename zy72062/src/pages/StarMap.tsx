import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import { Upload, Save, X, Eye } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { mockEntities, mockEquityLinks } from '@/utils/mockData'
import { runAllDetections } from '@/utils/anomalyDetector'
import type { Entity, Anomaly } from '@/types'

const BG = '#0f1219'
const GOLD = '#d4a543'
const ANOMALY_RED = '#e8634f'
const CYAN = '#3ec9c2'
const SILVER = '#8b95a5'
const PURPLE = '#7c6df0'

const COORD_COLORS: Record<string, string> = { WGS84: CYAN, CGCS2000: PURPLE }

const ANOMALY_TYPE_LABELS: Record<Anomaly['type'], string> = {
  coordinate_offset: '坐标偏移',
  duplicate_name: '名称重复',
  missing_photo: '照片缺失',
  cross_floor: '跨楼层',
}

const STATUS_STYLE: Record<Anomaly['status'], { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-900/60', text: 'text-yellow-300', label: '待处理' },
  confirmed: { bg: 'bg-green-900/60', text: 'text-green-300', label: '已确认' },
  ignored: { bg: 'bg-gray-700/60', text: 'text-gray-400', label: '已忽略' },
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  shareRatio: number
  coordinateSystem: string
  floor: number
  isAnomaly: boolean
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  ratio: number
  label: string
}

export default function StarMap() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null)

  const entities = useStore((s) => s.entities)
  const anomalies = useStore((s) => s.anomalies)
  const equityLinks = useStore((s) => s.equityLinks)
  const viewSnapshots = useStore((s) => s.viewSnapshots)
  const currentView = useStore((s) => s.currentView)
  const importData = useStore((s) => s.importData)
  const addAnomaly = useStore((s) => s.addAnomaly)
  const updateAnomalyStatus = useStore((s) => s.updateAnomalyStatus)
  const saveViewSnapshot = useStore((s) => s.saveViewSnapshot)
  const loadViewSnapshot = useStore((s) => s.loadViewSnapshot)
  const setCurrentView = useStore((s) => s.setCurrentView)

  const [popupAnomaly, setPopupAnomaly] = useState<Anomaly | null>(null)
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })
  const [hoverInfo, setHoverInfo] = useState<{ entity: Entity; x: number; y: number } | null>(null)
  const [zoomLevel, setZoomLevel] = useState(currentView.zoom)
  const [viewSelectId, setViewSelectId] = useState('')

  const anomalyEntityIds = new Set(anomalies.filter((a) => a.status !== 'ignored').map((a) => a.entityId))

  const entitiesKey = entities.map((e) => e.id).join(',')
  const linksKey = equityLinks.map((l) => l.id).join(',')
  const anomalyKey = [...anomalyEntityIds].sort().join(',')

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const svg = d3.select(svgRef.current)
    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const defs = svg.append('defs')
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', GOLD)

    const g = svg.append('g')

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
        setZoomLevel(event.transform.k)
      })

    svg.call(zoomBehavior)
    svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(currentView.panX, currentView.panY).scale(currentView.zoom))

    const handleZoomEnd = () => {
      const t = d3.zoomTransform(svgRef.current!)
      setCurrentView({ zoom: t.k, panX: t.x, panY: t.y })
    }
    svg.on('zoom.end', handleZoomEnd)

    const nodes: SimNode[] = entities.map((e) => ({
      id: e.id,
      name: e.name,
      shareRatio: e.shareRatio,
      coordinateSystem: e.coordinateSystem,
      floor: e.floor,
      isAnomaly: anomalyEntityIds.has(e.id),
    }))
    const idSet = new Set(entities.map((e) => e.id))
    const links: SimLink[] = equityLinks
      .filter((l) => idSet.has(l.sourceId) && idSet.has(l.targetId))
      .map((l) => ({ source: l.sourceId, target: l.targetId, ratio: l.ratio, label: l.label }))

    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => 16 + d.shareRatio * 0.2))

    simRef.current = simulation

    const linkGroup = g.append('g')
    const linkEls = linkGroup.selectAll('line').data(links).join('line')
      .attr('stroke', GOLD).attr('stroke-opacity', (d) => 0.3 + d.ratio * 0.007)
      .attr('stroke-width', 1.5).attr('marker-end', 'url(#arrow)')

    const linkLabels = linkGroup.selectAll('text').data(links).join('text')
      .text((d) => d.label).attr('fill', GOLD).attr('font-size', 10)
      .attr('text-anchor', 'middle').attr('dy', -6).attr('opacity', 0.8)

    const nodeGroup = g.append('g')
    const nodeEls = nodeGroup.selectAll<SVGGElement, SimNode>('g').data(nodes, (d) => d.id).join('g')

    nodeEls.each(function (d) {
      const el = d3.select(this)
      const r = 12 + d.shareRatio * 0.16
      const color = COORD_COLORS[d.coordinateSystem] ?? SILVER
      const border = d.isAnomaly ? ANOMALY_RED : SILVER

      el.append('circle').attr('r', r).attr('fill', color).attr('fill-opacity', 0.2)
        .attr('stroke', border).attr('stroke-width', 2)
        .attr('stroke-dasharray', d.isAnomaly ? '4 2' : 'none')

      el.append('text').text(d.name).attr('fill', '#e2e8f0').attr('font-size', 11)
        .attr('text-anchor', 'middle').attr('dy', r + 14)

      if (d.coordinateSystem === 'CGCS2000') {
        el.append('text').text(d.coordinateSystem).attr('fill', PURPLE).attr('font-size', 8)
          .attr('text-anchor', 'middle').attr('dy', r + 26).attr('opacity', 0.7)
      }

      if (d.isAnomaly) {
        el.append('circle').attr('cx', r * 0.7).attr('cy', -r * 0.7).attr('r', 5)
          .attr('fill', ANOMALY_RED)
        el.append('text').attr('x', r * 0.7).attr('y', -r * 0.7).attr('dy', 3.5)
          .attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', 7).attr('font-weight', 'bold').text('!')
      }
    })

    nodeEls
      .on('click', (_event, d) => {
        const anomaly = anomalies.find((a) => a.entityId === d.id && a.status !== 'ignored')
        if (anomaly) {
          const [tx, ty] = d3.pointer(_event, containerRef.current)
          setPopupAnomaly(anomaly)
          setPopupPos({ x: tx, y: ty })
        }
      })
      .on('mouseenter', (_event, d) => {
        const entity = entities.find((e) => e.id === d.id)
        if (entity) {
          const [tx, ty] = d3.pointer(_event, containerRef.current)
          setHoverInfo({ entity, x: tx, y: ty })
        }
      })
      .on('mouseleave', () => setHoverInfo(null))
      .call(d3.drag<SVGGElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null; d.fy = null
        })
      )

    simulation.on('tick', () => {
      linkEls.attr('x1', (d) => (d.source as SimNode).x!).attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!).attr('y2', (d) => (d.target as SimNode).y!)
      linkLabels.attr('x', (d) => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
        .attr('y', (d) => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2)
      nodeEls.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => { simulation.stop(); simRef.current = null }
  }, [entitiesKey, linksKey, anomalyKey])

  const handleImport = () => {
    const result = importData({
      entities: mockEntities,
      equityLinks: mockEquityLinks,
      sourceFile: '材料包A-股权数据.xlsx',
    })
    const idMap = result.idMap
    const detected = runAllDetections(mockEntities, '材料包A-股权数据.xlsx')
    detected.forEach((a) => {
      addAnomaly({
        ...a,
        entityId: idMap.get(a.entityId) ?? a.entityId,
      })
    })
  }

  const handleSaveView = () => {
    const name = prompt('请输入视角名称')
    if (name) saveViewSnapshot(name)
  }

  const handleLoadView = (id: string) => {
    setViewSelectId(id)
    if (id) loadViewSnapshot(id)
  }

  const popupEntity = popupAnomaly ? entities.find((e) => e.id === popupAnomaly.entityId) : null

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden" style={{ background: BG }}>
      <svg ref={svgRef} className="w-full h-full" />

      {popupAnomaly && popupEntity && (
        <div className="absolute z-30 w-72 rounded-lg border border-gray-700 bg-gray-900/95 p-4 shadow-xl backdrop-blur"
          style={{ left: Math.min(popupPos.x + 12, (containerRef.current?.clientWidth ?? 800) - 300), top: popupPos.y + 12 }}>
          <button onClick={() => setPopupAnomaly(null)} className="absolute right-2 top-2 text-gray-500 hover:text-gray-300"><X size={16} /></button>
          <h3 className="text-sm font-semibold text-white mb-1">{popupEntity.name}</h3>
          <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium mb-2"
            style={{ background: ANOMALY_RED + '30', color: ANOMALY_RED }}>
            {ANOMALY_TYPE_LABELS[popupAnomaly.type]}
          </span>
          <p className="text-xs text-gray-300 mb-1">{popupAnomaly.description}</p>
          <p className="text-xs text-gray-500">来源: {popupAnomaly.sourceFile}</p>
          <p className="text-xs text-gray-500">检测时间: {new Date(popupAnomaly.detectedAt).toLocaleString()}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[popupAnomaly.status].bg} ${STATUS_STYLE[popupAnomaly.status].text}`}>
              {STATUS_STYLE[popupAnomaly.status].label}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => { updateAnomalyStatus(popupAnomaly.id, 'confirmed'); setPopupAnomaly(null) }}
              className="rounded bg-green-700/60 px-3 py-1 text-xs text-green-200 hover:bg-green-600/60">确认</button>
            <button onClick={() => { updateAnomalyStatus(popupAnomaly.id, 'ignored'); setPopupAnomaly(null) }}
              className="rounded bg-gray-700/60 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600/60">忽略</button>
          </div>
        </div>
      )}

      {hoverInfo && (
        <div className="pointer-events-none absolute z-20 rounded border border-gray-700 bg-gray-900/90 px-3 py-2 text-xs shadow-lg backdrop-blur"
          style={{ left: hoverInfo.x + 16, top: hoverInfo.y - 10 }}>
          <p className="font-semibold text-white">{hoverInfo.entity.name}</p>
          <p className="text-gray-400">持股比例: {hoverInfo.entity.shareRatio}%</p>
          <p className="text-gray-400">坐标系: {hoverInfo.entity.coordinateSystem}</p>
          <p className="text-gray-400">楼层: {hoverInfo.entity.floor}</p>
        </div>
      )}

      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-2 backdrop-blur">
        <Eye size={14} className="text-gray-400" />
        <select value={viewSelectId} onChange={(e) => handleLoadView(e.target.value)}
          className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none">
          <option value="">选择视角</option>
          {viewSnapshots.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <button onClick={handleSaveView} className="flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600">
          <Save size={12} /> 保存当前视角
        </button>
        <span className="text-xs text-gray-500">缩放: {zoomLevel.toFixed(2)}x</span>
      </div>

      <div className="absolute left-4 bottom-4 rounded-lg border border-gray-700 bg-gray-900/90 px-4 py-3 text-xs backdrop-blur">
        <p className="mb-1.5 font-semibold text-gray-300">图例</p>
        <div className="flex items-center gap-2 mb-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: CYAN }} /> WGS84</div>
        <div className="flex items-center gap-2 mb-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: PURPLE }} /> CGCS2000</div>
        <div className="flex items-center gap-2 mb-1"><span className="inline-block h-3 w-3 rounded-full border-2 border-dashed" style={{ borderColor: ANOMALY_RED, background: ANOMALY_RED + '30' }} /> 异常节点</div>
        <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: SILVER, background: SILVER + '20' }} /> 正常节点</div>
      </div>

      <div className="absolute left-4 top-4">
        <button onClick={handleImport}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/90 px-4 py-2 text-sm text-gray-200 backdrop-blur hover:border-amber-600/50 hover:text-amber-300">
          <Upload size={16} /> 导入材料包
        </button>
      </div>
    </div>
  )
}
