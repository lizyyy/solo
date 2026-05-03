import type { PixelDifference, PixelDifferenceSummary } from '@/types'

export function compareImageData(
  imageData1: ImageData,
  imageData2: ImageData
): PixelDifference {
  if (imageData1.width !== imageData2.width || imageData1.height !== imageData2.height) {
    return {
      totalPixels: 0,
      differingPixels: 0,
      maxDifference: 0,
      avgDifference: 0,
      differenceMap: []
    }
  }

  const totalPixels = imageData1.width * imageData1.height
  const differenceMap: number[] = new Array(totalPixels)
  let differingPixels = 0
  let maxDifference = 0
  let totalDifference = 0

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    let pixelDiff = 0

    for (let c = 0; c < 4; c++) {
      const channelDiff = Math.abs(imageData1.data[idx + c] - imageData2.data[idx + c])
      pixelDiff = Math.max(pixelDiff, channelDiff)
    }

    differenceMap[i] = pixelDiff

    if (pixelDiff > 0) {
      differingPixels++
      maxDifference = Math.max(maxDifference, pixelDiff)
      totalDifference += pixelDiff
    }
  }

  return {
    totalPixels,
    differingPixels,
    maxDifference,
    avgDifference: differingPixels > 0 ? totalDifference / differingPixels : 0,
    differenceMap
  }
}

export function calculateDifferenceSummary(
  imageData1: ImageData,
  imageData2: ImageData
): PixelDifferenceSummary {
  if (imageData1.width !== imageData2.width || imageData1.height !== imageData2.height) {
    return {
      totalPixels: Math.max(imageData1.width * imageData1.height, imageData2.width * imageData2.height),
      differingPixels: Math.max(imageData1.width * imageData1.height, imageData2.width * imageData2.height),
      differingPercent: 100,
      maxDifference: 255,
      avgDifference: 255,
      rmsDifference: 255,
      psnr: 0
    }
  }

  const totalPixels = imageData1.width * imageData1.height
  let differingPixels = 0
  let maxDifference = 0
  let totalDifference = 0
  let squaredDifference = 0

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    let pixelDiff = 0

    for (let c = 0; c < 4; c++) {
      const channelDiff = Math.abs(imageData1.data[idx + c] - imageData2.data[idx + c])
      pixelDiff = Math.max(pixelDiff, channelDiff)
      squaredDifference += channelDiff * channelDiff
    }

    if (pixelDiff > 0) {
      differingPixels++
      maxDifference = Math.max(maxDifference, pixelDiff)
      totalDifference += pixelDiff
    }
  }

  const mse = squaredDifference / (totalPixels * 4)
  const rmsDifference = Math.sqrt(mse)
  const psnr = mse > 0 ? 10 * Math.log10((255 * 255) / mse) : Infinity

  return {
    totalPixels,
    differingPixels,
    differingPercent: (differingPixels / totalPixels) * 100,
    maxDifference,
    avgDifference: differingPixels > 0 ? totalDifference / differingPixels : 0,
    rmsDifference,
    psnr: psnr === Infinity ? 100 : psnr
  }
}

export function generateDifferenceHeatmap(
  difference: PixelDifference,
  width: number,
  height: number
): ImageData {
  const heatmap = new ImageData(width, height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const diff = difference.differenceMap[y * width + x] || 0

      if (diff === 0) {
        heatmap.data[idx] = 0
        heatmap.data[idx + 1] = 0
        heatmap.data[idx + 2] = 0
        heatmap.data[idx + 3] = 255
      } else {
        const normalized = diff / 255
        if (normalized < 0.25) {
          heatmap.data[idx] = Math.round(normalized * 4 * 255)
          heatmap.data[idx + 1] = 0
          heatmap.data[idx + 2] = 255
        } else if (normalized < 0.5) {
          heatmap.data[idx] = 255
          heatmap.data[idx + 1] = 0
          heatmap.data[idx + 2] = Math.round((1 - (normalized - 0.25) * 4) * 255)
        } else if (normalized < 0.75) {
          heatmap.data[idx] = 255
          heatmap.data[idx + 1] = Math.round((normalized - 0.5) * 4 * 255)
          heatmap.data[idx + 2] = 0
        } else {
          heatmap.data[idx] = Math.round((1 - (normalized - 0.75) * 4) * 255)
          heatmap.data[idx + 1] = 255
          heatmap.data[idx + 2] = 0
        }
        heatmap.data[idx + 3] = 255
      }
    }
  }

  return heatmap
}

export function formatDifferenceSummary(summary: PixelDifferenceSummary): string {
  return [
    `总像素数: ${summary.totalPixels.toLocaleString()}`,
    `差异像素: ${summary.differingPixels.toLocaleString()} (${summary.differingPercent.toFixed(4)}%)`,
    `最大差异: ${summary.maxDifference}`,
    `平均差异: ${summary.avgDifference.toFixed(2)}`,
    `RMS 差异: ${summary.rmsDifference.toFixed(4)}`,
    `PSNR: ${summary.psnr === 100 ? '∞' : summary.psnr.toFixed(2)} dB`
  ].join('\n')
}
