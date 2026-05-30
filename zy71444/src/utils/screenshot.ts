export function captureScreenshot(canvasSelector: string, filename: string = "risk-tower-snapshot.png") {
  const canvas = document.querySelector(canvasSelector) as HTMLCanvasElement
  if (!canvas) {
    console.error("Canvas not found for screenshot")
    return
  }

  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl")
  if (!gl) {
    console.error("WebGL context not found")
    return
  }

  const width = canvas.width
  const height = canvas.height
  const pixels = new Uint8Array(width * height * 4)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

  const flippedPixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const srcRow = (height - y - 1) * width * 4
    const dstRow = y * width * 4
    flippedPixels.set(pixels.subarray(srcRow, srcRow + width * 4), dstRow)
  }

  const offscreen = document.createElement("canvas")
  offscreen.width = width
  offscreen.height = height
  const ctx = offscreen.getContext("2d")!
  const imageData = ctx.createImageData(width, height)
  imageData.data.set(flippedPixels)
  ctx.putImageData(imageData, 0, 0)

  const link = document.createElement("a")
  link.download = filename
  link.href = offscreen.toDataURL("image/png")
  link.click()
}

export function captureFullPageScreenshot(filename: string = "risk-tower-full.png") {
  import("html2canvas").then((html2canvas) => {
    html2canvas
      .default(document.getElementById("root")!, {
        backgroundColor: "#0a0e17",
        scale: 2,
        useCORS: true,
      })
      .then((canvas) => {
        const link = document.createElement("a")
        link.download = filename
        link.href = canvas.toDataURL("image/png")
        link.click()
      })
  })
}
