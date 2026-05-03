import type { FilterType, ImageSize, Renderer } from '@/types'
import { shaderModules } from './shaders'

interface WebGPUContext {
  adapter: GPUAdapter
  device: GPUDevice
  queue: GPUQueue
  sampler: GPUSampler
}

interface FilterPipeline {
  pipeline: GPUComputePipeline
  bindGroupLayout: GPUBindGroupLayout
}

export class WebGPURenderer implements Renderer {
  private context: WebGPUContext | null = null
  private pipelines: Map<string, FilterPipeline> = new Map()
  private available: boolean = false

  async initialize(): Promise<boolean> {
    try {
      if (!navigator.gpu) {
        this.available = false
        return false
      }

      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      })
      
      if (!adapter) {
        this.available = false
        return false
      }

      const device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {}
      })

      const queue = device.queue
      
      const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge'
      })

      this.context = { adapter, device, queue, sampler }
      this.available = true

      await this.createPipelines()

      return true
    } catch (error) {
      console.error('WebGPU initialization failed:', error)
      this.available = false
      return false
    }
  }

  isAvailable(): boolean {
    return this.available && this.context !== null
  }

  private async createPipelines(): Promise<void> {
    if (!this.context) return

    const device = this.context.device

    for (const [filterType, shaderCode] of Object.entries(shaderModules)) {
      const shaderModule = device.createShaderModule({
        code: shaderCode
      })

      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: 'float' }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: 'filtering' }
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'uniform' }
          },
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: 'write-only',
              format: 'rgba8unorm'
            }
          }
        ]
      })

      const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      })

      const pipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: {
          module: shaderModule,
          entryPoint: 'main'
        }
      })

      this.pipelines.set(filterType, { pipeline, bindGroupLayout })
    }
  }

  private createTextureFromImageData(
    imageData: ImageData
  ): GPUTexture {
    if (!this.context) throw new Error('WebGPU not initialized')

    const device = this.context.device
    const { width, height, data } = imageData

    const texture = device.createTexture({
      size: { width, height },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT
    })

    device.queue.writeTexture(
      { texture },
      data,
      { bytesPerRow: width * 4, rowsPerImage: height },
      { width, height }
    )

    return texture
  }

  private createOutputTexture(
    width: number,
    height: number
  ): GPUTexture {
    if (!this.context) throw new Error('WebGPU not initialized')

    const device = this.context.device

    return device.createTexture({
      size: { width, height },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_SRC
    })
  }

  private async readTextureData(
    texture: GPUTexture,
    width: number,
    height: number
  ): Promise<ImageData> {
    if (!this.context) throw new Error('WebGPU not initialized')

    const device = this.context.device
    const bytesPerRow = width * 4
    const bufferSize = bytesPerRow * height

    const stagingBuffer = device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })

    const commandEncoder = device.createCommandEncoder()

    commandEncoder.copyTextureToBuffer(
      { texture },
      {
        buffer: stagingBuffer,
        bytesPerRow,
        rowsPerImage: height
      },
      { width, height }
    )

    device.queue.submit([commandEncoder.finish()])

    await stagingBuffer.mapAsync(GPUMapMode.READ)
    const arrayBuffer = stagingBuffer.getMappedRange()
    const imageData = new ImageData(
      new Uint8ClampedArray(arrayBuffer),
      width,
      height
    )

    stagingBuffer.unmap()
    stagingBuffer.destroy()

    return imageData
  }

  private getUniformBufferForFilter(
    filterType: FilterType,
    parameters: Record<string, any>,
    inputSize?: ImageSize
  ): GPUBuffer {
    if (!this.context) throw new Error('WebGPU not initialized')

    const device = this.context.device
    let bufferData: ArrayBuffer

    switch (filterType) {
      case 'grayscale': {
        const methodMap: Record<string, number> = {
          'average': 0,
          'luminosity': 1,
          'lightness': 2
        }
        const method = methodMap[parameters.method] ?? 1
        bufferData = new ArrayBuffer(16)
        const view = new DataView(bufferData)
        view.setUint32(0, method, true)
        view.setFloat32(4, parameters.intensity ?? 1.0, true)
        break
      }
      case 'levels': {
        bufferData = new ArrayBuffer(32)
        const view = new DataView(bufferData)
        view.setFloat32(0, parameters.inputBlack ?? 0, true)
        view.setFloat32(4, parameters.inputWhite ?? 255, true)
        view.setFloat32(8, parameters.gamma ?? 1.0, true)
        view.setFloat32(12, parameters.outputBlack ?? 0, true)
        view.setFloat32(16, parameters.outputWhite ?? 255, true)
        break
      }
      case 'crop': {
        bufferData = new ArrayBuffer(16)
        const view = new DataView(bufferData)
        view.setUint32(0, parameters.x ?? 0, true)
        view.setUint32(4, parameters.y ?? 0, true)
        view.setUint32(8, parameters.width ?? 100, true)
        view.setUint32(12, parameters.height ?? 100, true)
        break
      }
      case 'resize': {
        const modeMap: Record<string, number> = {
          'nearest': 0,
          'bilinear': 1,
          'bicubic': 2
        }
        const mode = modeMap[parameters.mode] ?? 1
        bufferData = new ArrayBuffer(32)
        const view = new DataView(bufferData)
        view.setUint32(0, inputSize?.width ?? 0, true)
        view.setUint32(4, inputSize?.height ?? 0, true)
        view.setUint32(8, parameters.width ?? 512, true)
        view.setUint32(12, parameters.height ?? 512, true)
        view.setUint32(16, mode, true)
        break
      }
      case 'mosaic': {
        const methodMap: Record<string, number> = {
          'average': 0,
          'center': 1,
          'max': 2,
          'min': 3
        }
        const method = methodMap[parameters.method] ?? 0
        bufferData = new ArrayBuffer(24)
        const view = new DataView(bufferData)
        view.setUint32(0, parameters.blockSize ?? 20, true)
        view.setUint32(4, method, true)
        view.setUint32(8, parameters.x ?? 0, true)
        view.setUint32(12, parameters.y ?? 0, true)
        view.setUint32(16, parameters.regionWidth ?? 0, true)
        view.setUint32(20, parameters.regionHeight ?? 0, true)
        break
      }
      case 'sharpen': {
        bufferData = new ArrayBuffer(16)
        const view = new DataView(bufferData)
        view.setFloat32(0, parameters.amount ?? 1.0, true)
        view.setUint32(4, parameters.radius ?? 1, true)
        view.setFloat32(8, parameters.threshold ?? 0, true)
        break
      }
      default:
        throw new Error(`Unsupported filter type: ${filterType}`)
    }

    const buffer = device.createBuffer({
      size: Math.ceil(bufferData.byteLength / 16) * 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    device.queue.writeBuffer(buffer, 0, bufferData)

    return buffer
  }

  private getOutputSizeForFilter(
    filterType: FilterType,
    parameters: Record<string, any>,
    inputSize: ImageSize
  ): ImageSize {
    switch (filterType) {
      case 'crop':
        return {
          width: parameters.width ?? inputSize.width,
          height: parameters.height ?? inputSize.height
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

  async applyFilter(
    input: ImageData | HTMLCanvasElement,
    filterType: FilterType,
    parameters: Record<string, any>
  ): Promise<ImageData> {
    if (!this.available || !this.context) {
      throw new Error('WebGPU not available')
    }

    const inputImageData = input instanceof HTMLCanvasElement
      ? input.getContext('2d')!.getImageData(0, 0, input.width, input.height)
      : input

    const inputSize = { width: inputImageData.width, height: inputImageData.height }
    const outputSize = this.getOutputSizeForFilter(filterType, parameters, inputSize)

    if (filterType === 'watermark') {
      throw new Error('Watermark filter is not supported in WebGPU, use CPU fallback')
    }

    const pipelineInfo = this.pipelines.get(filterType)
    if (!pipelineInfo) {
      throw new Error(`No pipeline found for filter: ${filterType}`)
    }

    const inputTexture = this.createTextureFromImageData(inputImageData)
    const outputTexture = this.createOutputTexture(outputSize.width, outputSize.height)
    const uniformBuffer = this.getUniformBufferForFilter(filterType, parameters, inputSize)

    const bindGroup = this.context.device.createBindGroup({
      layout: pipelineInfo.bindGroupLayout,
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: this.context.sampler },
        { binding: 2, resource: { buffer: uniformBuffer } },
        { binding: 3, resource: outputTexture.createView() }
      ]
    })

    const commandEncoder = this.context.device.createCommandEncoder()
    const computePass = commandEncoder.beginComputePass()

    computePass.setPipeline(pipelineInfo.pipeline)
    computePass.setBindGroup(0, bindGroup)

    const workgroupSize = 16
    const workgroupCountX = Math.ceil(outputSize.width / workgroupSize)
    const workgroupCountY = Math.ceil(outputSize.height / workgroupSize)

    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY)
    computePass.end()

    this.context.queue.submit([commandEncoder.finish()])

    const result = await this.readTextureData(outputTexture, outputSize.width, outputSize.height)

    inputTexture.destroy()
    outputTexture.destroy()
    uniformBuffer.destroy()

    return result
  }

  async applyPipeline(
    input: ImageData | HTMLCanvasElement,
    filters: Array<{ type: FilterType; parameters: Record<string, any> }>
  ): Promise<{
    result: ImageData
    nodeTimes: number[]
    errors: Array<{ index: number; error: string }>
  }> {
    if (!this.available || !this.context) {
      throw new Error('WebGPU not available')
    }

    let currentImageData = input instanceof HTMLCanvasElement
      ? input.getContext('2d')!.getImageData(0, 0, input.width, input.height)
      : input

    const nodeTimes: number[] = []
    const errors: Array<{ index: number; error: string }> = []

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i]
      const startTime = performance.now()

      try {
        currentImageData = await this.applyFilter(currentImageData, filter.type, filter.parameters)
        nodeTimes.push(performance.now() - startTime)
      } catch (error) {
        nodeTimes.push(performance.now() - startTime)
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return {
      result: currentImageData,
      nodeTimes,
      errors
    }
  }

  destroy(): void {
    if (this.context) {
      this.context.device.destroy()
      this.context = null
    }
    this.pipelines.clear()
    this.available = false
  }
}
