import { useRef, useEffect, useCallback } from 'react'
import { useLineageStore } from '@/store/useLineageStore'
import { forceLayout } from '@/utils/graphLayout'

const COLORS = {
  accent: '#00d4ff', danger: '#ff4757', safe: '#2ed573',
  muted: '#8b95a5', amber: '#ffa502', edge: '#4a5568', bg: '#0d1117',
}
const NODE_SIZE: Record<string, number> = { field: 20, etl: 16, report: 12, api: 18 }

function drawNode(ctx: CanvasRenderingContext2D, x: number, y: number, node: { type: string; status: string; isHidden: boolean; label: string }, highlight: boolean) {
  ctx.save()
  const glow = highlight || node.status === 'changed'
  if (glow) { ctx.shadowColor = COLORS.accent; ctx.shadowBlur = 16 }
  if (node.isHidden) { ctx.shadowColor = COLORS.danger; ctx.shadowBlur = 12 }

  const fill = node.status === 'changed' ? COLORS.accent : node.isHidden ? 'transparent' : '#e2e8f0'
  const stroke = node.isHidden ? COLORS.danger : glow ? COLORS.accent : COLORS.muted

  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = node.isHidden ? 2 : 1.5
  if (node.type === 'field') { ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
  else if (node.type === 'etl') { ctx.fillRect(x - 16, y - 16, 32, 32); ctx.strokeRect(x - 16, y - 16, 32, 32) }
  else if (node.type === 'report') {
    ctx.beginPath(); ctx.moveTo(x, y - 17); ctx.lineTo(x + 17, y); ctx.lineTo(x, y + 17); ctx.lineTo(x - 17, y); ctx.closePath(); ctx.fill(); ctx.stroke()
  } else { ctx.beginPath(); ctx.roundRect(x - 18, y - 12, 36, 24, 6); ctx.fill(); ctx.stroke() }

  ctx.shadowBlur = 0; ctx.fillStyle = node.isHidden ? COLORS.danger : '#cbd5e1'
  ctx.font = '11px "JetBrains Mono", monospace'; ctx.textAlign = 'center'
  ctx.fillText(node.label.slice(0, 12), x, y + NODE_SIZE[node.type] + 14)
  ctx.restore()
}

function drawEdge(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, status: string) {
  ctx.save()
  ctx.strokeStyle = status === 'broken' ? COLORS.danger : status === 'unregistered' ? COLORS.amber : COLORS.edge
  ctx.lineWidth = 1.5
  if (status === 'broken') ctx.setLineDash([6, 4])
  else if (status === 'unregistered') ctx.setLineDash([2, 4])
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()

  const angle = Math.atan2(y2 - y1, x2 - x1), len = 10
  ctx.setLineDash([]); ctx.fillStyle = ctx.strokeStyle
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - len * Math.cos(angle - 0.35), y2 - len * Math.sin(angle - 0.35))
  ctx.lineTo(x2 - len * Math.cos(angle + 0.35), y2 - len * Math.sin(angle + 0.35))
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

function drawLegend(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save(); ctx.fillStyle = 'rgba(13,17,23,0.85)'; ctx.fillRect(12, h - 118, 160, 108)
  ctx.strokeStyle = '#242940'; ctx.strokeRect(12, h - 118, 160, 108)
  ctx.font = '10px "Noto Sans SC", sans-serif'; ctx.textAlign = 'left'

  const items = [
    ['circle', '#e2e8f0', '字段 (field)'], ['square', '#e2e8f0', 'ETL'],
    ['diamond', '#e2e8f0', '报表 (report)'], ['roundRect', '#e2e8f0', 'API'],
  ]
  items.forEach(([shape, color, label], i) => {
    const y = h - 100 + i * 20; ctx.fillStyle = color as string
    if (shape === 'circle') { ctx.beginPath(); ctx.arc(28, y, 5, 0, Math.PI * 2); ctx.fill() }
    else if (shape === 'square') { ctx.fillRect(23, y - 5, 10, 10) }
    else if (shape === 'diamond') { ctx.beginPath(); ctx.moveTo(28, y - 6); ctx.lineTo(34, y); ctx.lineTo(28, y + 6); ctx.lineTo(22, y); ctx.closePath(); ctx.fill() }
    else { ctx.beginPath(); ctx.roundRect(22, y - 4, 12, 8, 2); ctx.fill() }
    ctx.fillStyle = '#8b95a5'; ctx.fillText(label as string, 44, y + 4)
  })
  const edges: [string, string][] = [['solid', '#4a5568'], ['dashed', '#ff4757'], ['dotted', '#ffa502']]
  edges.forEach(([style, color], i) => {
    ctx.strokeStyle = color
    if (style === 'dashed') ctx.setLineDash([4, 3]); else if (style === 'dotted') ctx.setLineDash([2, 3]); else ctx.setLineDash([])
    ctx.beginPath(); ctx.moveTo(18, h - 22 + i * 14); ctx.lineTo(38, h - 22 + i * 14); ctx.stroke()
    ctx.fillStyle = '#8b95a5'; ctx.fillText(style, 44, h - 18 + i * 14)
  })
  ctx.restore()
}

export default function LineageGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const transformRef = useRef({ ox: 0, oy: 0, scale: 1 })
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragRef = useRef<{ dragging: boolean; lx: number; ly: number }>({ dragging: false, lx: 0, ly: 0 })

  const nodes = useLineageStore((s) => s.nodes)
  const edges = useLineageStore((s) => s.edges)
  const highlightedNodeIds = useLineageStore((s) => s.highlightedNodeIds)
  const setSelectedNode = useLineageStore((s) => s.setSelectedNode)

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const { ox, oy, scale } = transformRef.current
    const w = canvas.width, h = canvas.height

    ctx.clearRect(0, 0, w, h); ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, w, h)
    ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale)

    for (const edge of edges) {
      const sp = posRef.current.get(edge.source), tp = posRef.current.get(edge.target)
      if (sp && tp) drawEdge(ctx, sp.x, sp.y, tp.x, tp.y, edge.status)
    }
    for (const node of nodes) {
      const p = posRef.current.get(node.id); if (!p) continue
      drawNode(ctx, p.x, p.y, node, highlightedNodeIds.has(node.id))
    }
    ctx.restore()
    drawLegend(ctx, w, h)
  }, [nodes, edges, highlightedNodeIds])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.parentElement!.getBoundingClientRect()
    canvas.width = rect.width; canvas.height = rect.height

    const ids = nodes.map((n) => n.id)
    posRef.current = forceLayout(ids, edges.map((e) => ({ source: e.source, target: e.target })), canvas.width, canvas.height)
    draw()
  }, [nodes, edges, draw])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); transformRef.current.scale *= e.deltaY < 0 ? 1.1 : 0.9; draw() }
    const onDown = (e: MouseEvent) => { dragRef.current = { dragging: true, lx: e.clientX, ly: e.clientY } }
    const onMove = (e: MouseEvent) => {
      if (dragRef.current.dragging) { transformRef.current.ox += e.clientX - dragRef.current.lx; transformRef.current.oy += e.clientY - dragRef.current.ly; dragRef.current.lx = e.clientX; dragRef.current.ly = e.clientY; draw() }
    }
    const onUp = () => { dragRef.current.dragging = false }
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect(); const { ox, oy, scale } = transformRef.current
      const mx = (e.clientX - rect.left - ox) / scale, my = (e.clientY - rect.top - oy) / scale
      let best = '', bestD = Infinity
      for (const [id, p] of posRef.current) { const d = Math.hypot(p.x - mx, p.y - my); if (d < 30 && d < bestD) { bestD = d; best = id } }
      setSelectedNode(best || null)
    }
    canvas.addEventListener('wheel', onWheel); canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mousemove', onMove); canvas.addEventListener('mouseup', onUp)
    canvas.addEventListener('click', onClick)
    return () => { canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('mousedown', onDown); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mouseup', onUp); canvas.removeEventListener('click', onClick) }
  }, [draw, setSelectedNode])

  return <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
}
