import type { SamplePackage, GraphNode, GraphEdge, CapacityConfig } from "@/types"
import { DEFAULT_CAPACITY } from "@/types"

export function parseSamplePackage(raw: unknown): SamplePackage {
  const data = raw as Record<string, unknown>

  const rawNodes = Array.isArray(data.nodes) ? data.nodes : []
  const rawEdges = Array.isArray(data.edges) ? data.edges : []
  const rawBlacklist = Array.isArray(data.blacklist) ? data.blacklist : []
  const rawProjectLabels =
    data.projectLabels && typeof data.projectLabels === "object"
      ? data.projectLabels as Record<string, string[]>
      : {}
  const rawCapacity =
    data.capacityConfig && typeof data.capacityConfig === "object"
      ? data.capacityConfig as CapacityConfig
      : DEFAULT_CAPACITY
  const rawPreviousGroups = Array.isArray(data.previousGroups)
    ? data.previousGroups
    : undefined

  const nodes: GraphNode[] = rawNodes.map((n: Record<string, unknown>, i: number) => ({
    id: String(n.id ?? `node-${i}`),
    name: String(n.name ?? n.id ?? `节点${i + 1}`),
    projectLabels: Array.isArray(n.projectLabels) ? n.projectLabels.map(String) : [],
    groupHint: n.groupHint ? String(n.groupHint) : undefined,
    sourceType: n.sourceType === "result" ? "result" : "raw",
  }))

  const edgeSet = new Set<string>()
  const edges: GraphEdge[] = rawEdges
    .map((e: Record<string, unknown>, i: number) => {
      const source = String(e.source ?? "")
      const target = String(e.target ?? "")
      const key = [source, target].sort().join("-")
      if (edgeSet.has(key) || source === target) return null
      edgeSet.add(key)
      return {
        id: String(e.id ?? `edge-${i}`),
        source,
        target,
        weight: typeof e.weight === "number" ? e.weight : 1,
        sourceType: e.sourceType === "result" ? "result" : "raw",
      }
    })
    .filter(Boolean) as GraphEdge[]

  const blacklist = rawBlacklist.map((b: Record<string, unknown>) => ({
    nodeA: String(b.nodeA ?? b.node1 ?? ""),
    nodeB: String(b.nodeB ?? b.node2 ?? ""),
    reason: String(b.reason ?? ""),
  }))

  return {
    nodes,
    edges,
    projectLabels: rawProjectLabels,
    blacklist,
    capacityConfig: {
      minSize: typeof rawCapacity.minSize === "number" ? rawCapacity.minSize : DEFAULT_CAPACITY.minSize,
      maxSize: typeof rawCapacity.maxSize === "number" ? rawCapacity.maxSize : DEFAULT_CAPACITY.maxSize,
    },
    previousGroups: rawPreviousGroups,
  }
}

export function readFileAsJson(file: File): Promise<SamplePackage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string)
        resolve(parseSamplePackage(raw))
      } catch (err) {
        reject(new Error("文件解析失败，请确保上传的是有效的 JSON 文件"))
      }
    }
    reader.onerror = () => reject(new Error("文件读取失败"))
    reader.readAsText(file)
  })
}
