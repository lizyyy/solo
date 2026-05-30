import type { StageScene } from "@/types"

export function exportScene(scene: StageScene): void {
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${scene.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")}_v${scene.version}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importScene(file: File): Promise<StageScene> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as StageScene
        if (!data.id || !data.stage || !data.fixtures) {
          reject(new Error("无效的场景文件格式"))
          return
        }
        resolve(data)
      } catch {
        reject(new Error("JSON 解析失败"))
      }
    }
    reader.onerror = () => reject(new Error("文件读取失败"))
    reader.readAsText(file)
  })
}
