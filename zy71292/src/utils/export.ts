export function exportAsPNG(svgElement: SVGElement, filename: string): void {
  const svgData = new XMLSerializer().serializeToString(svgElement)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const svgRect = svgElement.getBoundingClientRect()
  const scale = 2
  canvas.width = svgRect.width * scale
  canvas.height = svgRect.height * scale
  ctx.scale(scale, scale)

  const img = new Image()
  img.onload = () => {
    ctx.fillStyle = "#0f172a"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, svgRect.width, svgRect.height)
    const link = document.createElement("a")
    link.download = filename
    link.href = canvas.toDataURL("image/png")
    link.click()
  }
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
}

export function exportAsSVG(svgElement: SVGElement, filename: string): void {
  const svgData = new XMLSerializer().serializeToString(svgElement)
  const blob = new Blob([svgData], { type: "image/svg+xml" })
  const link = document.createElement("a")
  link.download = filename
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
}

export function exportAsJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const link = document.createElement("a")
  link.download = filename
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
}
