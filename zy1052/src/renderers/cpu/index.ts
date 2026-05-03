import type { FilterType, ImageSize, Renderer } from '@/types'
import { cpuFilters, getOutputSizeForFilter } from './filters'

export class CPURenderer implements Renderer {
  private available: boolean = true

  async initialize(): Promise<boolean> {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      this.available = ctx !== null
      return this.available
    } catch {
      this.available = false
      return false
    }
  }

  isAvailable(): boolean {
    return this.available
  }

  async applyFilter(
    input: ImageData | HTMLCanvasElement,
    filterType: FilterType,
    parameters: Record<string, any>
  ): Promise<ImageData> {
    const inputImageData = input instanceof HTMLCanvasElement
      ? input.getContext('2d')!.getImageData(0, 0, input.width, input.height)
      : input

    const filterFn = cpuFilters[filterType]
    if (!filterFn) {
      throw new Error(`No filter implementation for: ${filterType}`)
    }

    return filterFn(inputImageData, parameters)
  }

  async applyPipeline(
    input: ImageData | HTMLCanvasElement,
    filters: Array<{ type: FilterType; parameters: Record<string, any> }>
  ): Promise<{
    result: ImageData
    nodeTimes: number[]
    errors: Array<{ index: number; error: string }>
  }> {
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
    // CPU renderer doesn't need cleanup
  }
}
