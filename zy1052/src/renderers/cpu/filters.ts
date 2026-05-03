import type { FilterType, ImageSize } from '@/types'

function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number): [number, number, number, number] {
  const idx = (y * width + x) * 4
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]
}

function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, r: number, g: number, b: number, a: number): void {
  const idx = (y * width + x) * 4
  data[idx] = r
  data[idx + 1] = g
  data[idx + 2] = b
  data[idx + 3] = a
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clampColor(value: number): number {
  return clamp(Math.round(value), 0, 255)
}

export function applyCrop(
  input: ImageData,
  parameters: Record<string, any>
): ImageData {
  const { x = 0, y = 0, width = input.width, height = input.height } = parameters
  
  const srcX = Math.max(0, Math.floor(x))
  const srcY = Math.max(0, Math.floor(y))
  const dstWidth = Math.max(1, Math.min(Math.floor(width), input.width - srcX))
  const dstHeight = Math.max(1, Math.min(Math.floor(height), input.height - srcY))
  
  const output = new ImageData(dstWidth, dstHeight)
  
  for (let dy = 0; dy < dstHeight; dy++) {
    for (let dx = 0; dx < dstWidth; dx++) {
      const [r, g, b, a] = getPixel(input.data, input.width, srcX + dx, srcY + dy)
      setPixel(output.data, dstWidth, dx, dy, r, g, b, a)
    }
  }
  
  return output
}

export function applyResize(
  input: ImageData,
  parameters: Record<string, any>
): ImageData {
  let { width: targetWidth, height: targetHeight, mode = 'bilinear', maintainAspectRatio = true } = parameters
  
  targetWidth = Math.max(1, Math.floor(targetWidth))
  targetHeight = Math.max(1, Math.floor(targetHeight))
  
  if (maintainAspectRatio) {
    const aspectRatio = input.width / input.height
    const targetAspectRatio = targetWidth / targetHeight
    
    if (targetAspectRatio > aspectRatio) {
      targetWidth = Math.round(targetHeight * aspectRatio)
    } else {
      targetHeight = Math.round(targetWidth / aspectRatio)
    }
  }
  
  const output = new ImageData(targetWidth, targetHeight)
  const scaleX = input.width / targetWidth
  const scaleY = input.height / targetHeight
  
  for (let dy = 0; dy < targetHeight; dy++) {
    for (let dx = 0; dx < targetWidth; dx++) {
      const srcX = (dx + 0.5) * scaleX - 0.5
      const srcY = (dy + 0.5) * scaleY - 0.5
      
      let r: number, g: number, b: number, a: number
      
      switch (mode) {
        case 'nearest': {
          const x = Math.round(clamp(srcX, 0, input.width - 1))
          const y = Math.round(clamp(srcY, 0, input.height - 1));
          [r, g, b, a] = getPixel(input.data, input.width, x, y)
          break
        }
        case 'bicubic': {
          r = bicubicSample(input, srcX, srcY, 0)
          g = bicubicSample(input, srcX, srcY, 1)
          b = bicubicSample(input, srcX, srcY, 2)
          a = bicubicSample(input, srcX, srcY, 3)
          break
        }
        case 'bilinear':
        default: {
          r = bilinearSample(input, srcX, srcY, 0)
          g = bilinearSample(input, srcX, srcY, 1)
          b = bilinearSample(input, srcX, srcY, 2)
          a = bilinearSample(input, srcX, srcY, 3)
          break
        }
      }
      
      setPixel(output.data, targetWidth, dx, dy, 
        clampColor(r), clampColor(g), clampColor(b), clampColor(a))
    }
  }
  
  return output
}

function bilinearSample(input: ImageData, x: number, y: number, channel: number): number {
  const x0 = Math.floor(clamp(x, 0, input.width - 1))
  const y0 = Math.floor(clamp(y, 0, input.height - 1))
  const x1 = Math.min(x0 + 1, input.width - 1)
  const y1 = Math.min(y0 + 1, input.height - 1)
  
  const fx = x - x0
  const fy = y - y0
  
  const v00 = input.data[(y0 * input.width + x0) * 4 + channel]
  const v10 = input.data[(y0 * input.width + x1) * 4 + channel]
  const v01 = input.data[(y1 * input.width + x0) * 4 + channel]
  const v11 = input.data[(y1 * input.width + x1) * 4 + channel]
  
  const v0 = v00 * (1 - fx) + v10 * fx
  const v1 = v01 * (1 - fx) + v11 * fx
  
  return v0 * (1 - fy) + v1 * fy
}

function cubicWeight(t: number): number {
  const absT = Math.abs(t)
  if (absT <= 1) {
    return 1.5 * absT * absT * absT - 2.5 * absT * absT + 1
  } else if (absT <= 2) {
    return -0.5 * absT * absT * absT + 2.5 * absT * absT - 4 * absT + 2
  }
  return 0
}

function bicubicSample(input: ImageData, x: number, y: number, channel: number): number {
  const centerX = Math.floor(x)
  const centerY = Math.floor(y)
  
  let result = 0
  let totalWeight = 0
  
  for (let dy = -2; dy <= 2; dy++) {
    const sampleY = clamp(centerY + dy, 0, input.height - 1)
    const weightY = cubicWeight(y - sampleY)
    
    for (let dx = -2; dx <= 2; dx++) {
      const sampleX = clamp(centerX + dx, 0, input.width - 1)
      const weightX = cubicWeight(x - sampleX)
      const weight = weightX * weightY
      
      const value = input.data[(sampleY * input.width + sampleX) * 4 + channel]
      result += value * weight
      totalWeight += weight
    }
  }
  
  return totalWeight > 0 ? result / totalWeight : 0
}

export function applyGrayscale(
  input: ImageData,
  parameters: Record<string, any>
): ImageData {
  const { method = 'luminosity', intensity = 1 } = parameters
  const output = new ImageData(new Uint8ClampedArray(input.data), input.width, input.height)
  
  for (let i = 0; i < input.data.length; i += 4) {
    const r = input.data[i]
    const g = input.data[i + 1]
    const b = input.data[i + 2]
    const a = input.data[i + 3]
    
    let gray: number
    
    switch (method) {
      case 'average':
        gray = (r + g + b) / 3
        break
      case 'lightness':
        gray = (Math.max(r, g, b) + Math.min(r, g, b)) / 2
        break
      case 'luminosity':
      default:
        gray = 0.299 * r + 0.587 * g + 0.114 * b
        break
    }
    
    const factor = intensity
    output.data[i] = clampColor(r * (1 - factor) + gray * factor)
    output.data[i + 1] = clampColor(g * (1 - factor) + gray * factor)
    output.data[i + 2] = clampColor(b * (1 - factor) + gray * factor)
    output.data[i + 3] = a
  }
  
  return output
}

export function applyLevels(
  input: ImageData,
  parameters: Record<string, any>
): ImageData {
  const { 
    inputBlack = 0, 
    inputWhite = 255, 
    gamma = 1, 
    outputBlack = 0, 
    outputWhite = 255 
  } = parameters
  
  const inputRange = inputWhite - inputBlack
  const outputRange = outputWhite - outputBlack
  
  const output = new ImageData(new Uint8ClampedArray(input.data), input.width, input.height)
  
  for (let i = 0; i < input.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let value = input.data[i + c]
      
      value = (value - inputBlack) / inputRange
      value = clamp(value, 0, 1)
      
      value = Math.pow(value, 1 / gamma)
      
      value = value * outputRange + outputBlack
      
      output.data[i + c] = clampColor(value)
    }
  }
  
  return output
}

export function applyMosaic(
  input: ImageData,
  parameters: Record<string, any>
): ImageData {
  const { 
    blockSize = 20, 
    method = 'average',
    x = 0,
    y = 0,
    regionWidth = 0,
    regionHeight = 0
  } = parameters
  
  const output = new ImageData(new Uint8ClampedArray(input.data), input.width, input.height)
  
  const startX = Math.max(0, Math.floor(x))
  const startY = Math.max(0, Math.floor(y))
  const endX = regionWidth > 0 ? Math.min(startX + regionWidth, input.width) : input.width
  const endY = regionHeight > 0 ? Math.min(startY + regionHeight, input.height) : input.height
  
  const blockSizeInt = Math.max(2, Math.floor(blockSize))
  
  for (let blockY = startY; blockY < endY; blockY += blockSizeInt) {
    for (let blockX = startX; blockX < endX; blockX += blockSizeInt) {
      const blockEndX = Math.min(blockX + blockSizeInt, endX)
      const blockEndY = Math.min(blockY + blockSizeInt, endY)
      
      let r = 0, g = 0, b = 0, a = 0
      let count = 0
      let maxR = 0, maxG = 0, maxB = 0, maxA = 0
      let minR = 255, minG = 255, minB = 255, minA = 255
      
      for (let py = blockY; py < blockEndY; py++) {
        for (let px = blockX; px < blockEndX; px++) {
          const [cr, cg, cb, ca] = getPixel(input.data, input.width, px, py)
          
          r += cr
          g += cg
          b += cb
          a += ca
          count++
          
          maxR = Math.max(maxR, cr)
          maxG = Math.max(maxG, cg)
          maxB = Math.max(maxB, cb)
          maxA = Math.max(maxA, ca)
          
          minR = Math.min(minR, cr)
          minG = Math.min(minG, cg)
          minB = Math.min(minB, cb)
          minA = Math.min(minA, ca)
        }
      }
      
      let fillR: number, fillG: number, fillB: number, fillA: number
      
      switch (method) {
        case 'center': {
          const centerX = Math.min(Math.round((blockX + blockEndX) / 2), input.width - 1)
          const centerY = Math.min(Math.round((blockY + blockEndY) / 2), input.height - 1);
          [fillR, fillG, fillB, fillA] = getPixel(input.data, input.width, centerX, centerY)
          break
        }
        case 'max':
          fillR = maxR
          fillG = maxG
          fillB = maxB
          fillA = maxA
          break
        case 'min':
          fillR = minR
          fillG = minG
          fillB = minB
          fillA = minA
          break
        case 'average':
        default:
          fillR = Math.round(r / count)
          fillG = Math.round(g / count)
          fillB = Math.round(b / count)
          fillA = Math.round(a / count)
          break
      }
      
      for (let py = blockY; py < blockEndY; py++) {
        for (let px = blockX; px < blockEndX; px++) {
          setPixel(output.data, input.width, px, py, fillR, fillG, fillB, fillA)
        }
      }
    }
  }
  
  return output
}

export function applySharpen(
  input: ImageData,
  parameters: Record<string, any>
): ImageData {
  const { amount = 1, radius = 1, threshold = 0 } = parameters
  
  const radiusInt = Math.max(1, Math.min(Math.floor(radius), 5))
  const output = new ImageData(new Uint8ClampedArray(input.data), input.width, input.height)
  
  const blurred = createGaussianBlur(input, radiusInt)
  
  for (let y = 0; y < input.height; y++) {
    for (let x = 0; x < input.width; x++) {
      const [r, g, b, a] = getPixel(input.data, input.width, x, y)
      const [br, bg, ba] = getPixel(blurred, input.width, x, y)
      
      const edgeR = r - br
      const edgeG = g - bg
      const edgeB = b - ba
      
      const edgeMagnitude = Math.sqrt(edgeR * edgeR + edgeG * edgeG + edgeB * edgeB)
      
      if (edgeMagnitude < threshold) {
        continue
      }
      
      const newR = clampColor(r + edgeR * amount)
      const newG = clampColor(g + edgeG * amount)
      const newB = clampColor(b + edgeB * amount)
      
      setPixel(output.data, input.width, x, y, newR, newG, newB, a)
    }
  }
  
  return output
}

function createGaussianBlur(input: ImageData, radius: number): Uint8ClampedArray {
  const sigma = radius / 2
  const kernelSize = radius * 2 + 1
  const kernel = new Array(kernelSize)
  let kernelSum = 0
  
  for (let i = 0; i < kernelSize; i++) {
    const x = i - radius
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma))
    kernelSum += kernel[i]
  }
  
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= kernelSum
  }
  
  const temp = new Uint8ClampedArray(input.data.length)
  const output = new Uint8ClampedArray(input.data.length)
  
  for (let y = 0; y < input.height; y++) {
    for (let x = 0; x < input.width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0
        for (let k = 0; k < kernelSize; k++) {
          const sampleX = clamp(x + k - radius, 0, input.width - 1)
          sum += input.data[(y * input.width + sampleX) * 4 + c] * kernel[k]
        }
        temp[(y * input.width + x) * 4 + c] = Math.round(sum)
      }
    }
  }
  
  for (let y = 0; y < input.height; y++) {
    for (let x = 0; x < input.width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0
        for (let k = 0; k < kernelSize; k++) {
          const sampleY = clamp(y + k - radius, 0, input.height - 1)
          sum += temp[(sampleY * input.width + x) * 4 + c] * kernel[k]
        }
        output[(y * input.width + x) * 4 + c] = Math.round(sum)
      }
    }
  }
  
  return output
}

export function applyWatermark(
  input: ImageData,
  parameters: Record<string, any>
): ImageData {
  const {
    text = 'WATERMARK',
    x = 20,
    y = 20,
    opacity = 0.5,
    fontSize = 32,
    fontFamily = 'Arial',
    color = '#ffffff',
    tiled = false,
    tileSpacingX = 100,
    tileSpacingY = 100
  } = parameters
  
  const canvas = document.createElement('canvas')
  canvas.width = input.width
  canvas.height = input.height
  const ctx = canvas.getContext('2d')!
  
  const tempImageData = new ImageData(
    new Uint8ClampedArray(input.data),
    input.width,
    input.height
  )
  ctx.putImageData(tempImageData, 0, 0)
  
  ctx.globalAlpha = opacity
  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  
  const metrics = ctx.measureText(text)
  const textWidth = metrics.width
  const textHeight = fontSize
  
  if (tiled) {
    for (let ty = -textHeight; ty < input.height + textHeight; ty += tileSpacingY) {
      for (let tx = -textWidth; tx < input.width + textWidth; tx += tileSpacingX) {
        ctx.fillText(text, tx, ty)
      }
    }
  } else {
    ctx.fillText(text, x, y)
  }
  
  return ctx.getImageData(0, 0, input.width, input.height)
}

export function getOutputSizeForFilter(
  filterType: FilterType,
  parameters: Record<string, any>,
  inputSize: ImageSize
): ImageSize {
  switch (filterType) {
    case 'crop':
      return {
        width: Math.max(1, parameters.width ?? inputSize.width),
        height: Math.max(1, parameters.height ?? inputSize.height)
      }
    case 'resize': {
      let targetWidth = parameters.width ?? inputSize.width
      let targetHeight = parameters.height ?? inputSize.height
      
      if (parameters.maintainAspectRatio) {
        const aspectRatio = inputSize.width / inputSize.height
        const targetAspectRatio = targetWidth / targetHeight
        
        if (targetAspectRatio > aspectRatio) {
          targetWidth = Math.round(targetHeight * aspectRatio)
        } else {
          targetHeight = Math.round(targetWidth / aspectRatio)
        }
      }
      
      return { width: targetWidth, height: targetHeight }
    }
    default:
      return inputSize
  }
}

export const cpuFilters: Record<string, (input: ImageData, params: Record<string, any>) => ImageData> = {
  crop: applyCrop,
  resize: applyResize,
  grayscale: applyGrayscale,
  levels: applyLevels,
  mosaic: applyMosaic,
  sharpen: applySharpen,
  watermark: applyWatermark
}
