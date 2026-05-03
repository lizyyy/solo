import type { FilterDefinition } from '@/types'

export const filterDefinitions: FilterDefinition[] = [
  {
    type: 'crop',
    name: '裁切',
    description: '从原始图像中裁切指定区域',
    category: 'transform',
    parameters: [
      {
        name: 'x',
        type: 'number',
        label: 'X 偏移',
        min: 0,
        max: 9999,
        step: 1,
        default: 0,
        description: '裁切区域左上角 X 坐标'
      },
      {
        name: 'y',
        type: 'number',
        label: 'Y 偏移',
        min: 0,
        max: 9999,
        step: 1,
        default: 0,
        description: '裁切区域左上角 Y 坐标'
      },
      {
        name: 'width',
        type: 'number',
        label: '宽度',
        min: 1,
        max: 9999,
        step: 1,
        default: 100,
        description: '裁切区域宽度'
      },
      {
        name: 'height',
        type: 'number',
        label: '高度',
        min: 1,
        max: 9999,
        step: 1,
        default: 100,
        description: '裁切区域高度'
      }
    ],
    supportsGPU: true,
    supportsCPU: true
  },
  {
    type: 'resize',
    name: '缩放',
    description: '将图像缩放到指定尺寸',
    category: 'transform',
    parameters: [
      {
        name: 'width',
        type: 'number',
        label: '宽度',
        min: 1,
        max: 8192,
        step: 1,
        default: 512,
        description: '目标宽度'
      },
      {
        name: 'height',
        type: 'number',
        label: '高度',
        min: 1,
        max: 8192,
        step: 1,
        default: 512,
        description: '目标高度'
      },
      {
        name: 'mode',
        type: 'select',
        label: '缩放模式',
        default: 'bilinear',
        options: [
          { value: 'nearest', label: '最近邻' },
          { value: 'bilinear', label: '双线性' },
          { value: 'bicubic', label: '双三次' }
        ],
        description: '插值算法选择'
      },
      {
        name: 'maintainAspectRatio',
        type: 'boolean',
        label: '保持宽高比',
        default: true,
        description: '是否保持原始宽高比'
      }
    ],
    supportsGPU: true,
    supportsCPU: true
  },
  {
    type: 'grayscale',
    name: '灰度',
    description: '将彩色图像转换为灰度图像',
    category: 'color',
    parameters: [
      {
        name: 'method',
        type: 'select',
        label: '转换方法',
        default: 'luminosity',
        options: [
          { value: 'average', label: '平均值 (R+G+B)/3' },
          { value: 'luminosity', label: '亮度感知 0.299R+0.587G+0.114B' },
          { value: 'lightness', label: '明度 (max+min)/2' }
        ],
        description: '灰度转换算法'
      },
      {
        name: 'intensity',
        type: 'number',
        label: '强度',
        min: 0,
        max: 1,
        step: 0.01,
        default: 1,
        description: '灰度效果强度，0 为原图，1 为完全灰度'
      }
    ],
    supportsGPU: true,
    supportsCPU: true
  },
  {
    type: 'sharpen',
    name: '锐化',
    description: '增强图像边缘和细节',
    category: 'filter',
    parameters: [
      {
        name: 'amount',
        type: 'number',
        label: '锐化量',
        min: 0,
        max: 5,
        step: 0.1,
        default: 1,
        description: '锐化强度因子'
      },
      {
        name: 'radius',
        type: 'number',
        label: '半径',
        min: 1,
        max: 5,
        step: 1,
        default: 1,
        description: '模糊半径（用于计算高斯模糊）'
      },
      {
        name: 'threshold',
        type: 'number',
        label: '阈值',
        min: 0,
        max: 255,
        step: 1,
        default: 0,
        description: '仅锐化差异超过此值的像素'
      }
    ],
    supportsGPU: true,
    supportsCPU: true
  },
  {
    type: 'levels',
    name: '色阶',
    description: '调整图像的亮度、对比度和色调范围',
    category: 'color',
    parameters: [
      {
        name: 'inputBlack',
        type: 'number',
        label: '输入黑场',
        min: 0,
        max: 253,
        step: 1,
        default: 0,
        description: '输入图像中被映射为黑色的像素值'
      },
      {
        name: 'inputWhite',
        type: 'number',
        label: '输入白场',
        min: 2,
        max: 255,
        step: 1,
        default: 255,
        description: '输入图像中被映射为白色的像素值'
      },
      {
        name: 'gamma',
        type: 'number',
        label: '伽玛值',
        min: 0.1,
        max: 9.99,
        step: 0.01,
        default: 1,
        description: '中间色调的伽玛校正值'
      },
      {
        name: 'outputBlack',
        type: 'number',
        label: '输出黑场',
        min: 0,
        max: 253,
        step: 1,
        default: 0,
        description: '输出图像的最小像素值'
      },
      {
        name: 'outputWhite',
        type: 'number',
        label: '输出白场',
        min: 2,
        max: 255,
        step: 1,
        default: 255,
        description: '输出图像的最大像素值'
      }
    ],
    supportsGPU: true,
    supportsCPU: true
  },
  {
    type: 'mosaic',
    name: '马赛克',
    description: '将图像分块并应用马赛克效果',
    category: 'filter',
    parameters: [
      {
        name: 'blockSize',
        type: 'number',
        label: '块大小',
        min: 2,
        max: 200,
        step: 1,
        default: 20,
        description: '每个马赛克块的像素大小'
      },
      {
        name: 'method',
        type: 'select',
        label: '采样方法',
        default: 'average',
        options: [
          { value: 'average', label: '区块平均值' },
          { value: 'center', label: '中心点像素' },
          { value: 'max', label: '区块最大值' },
          { value: 'min', label: '区块最小值' }
        ],
        description: '每个区块的颜色采样方式'
      },
      {
        name: 'x',
        type: 'number',
        label: '区域 X',
        min: 0,
        max: 9999,
        step: 1,
        default: 0,
        description: '马赛克区域左上角 X 坐标（0 为全图）'
      },
      {
        name: 'y',
        type: 'number',
        label: '区域 Y',
        min: 0,
        max: 9999,
        step: 1,
        default: 0,
        description: '马赛克区域左上角 Y 坐标（0 为全图）'
      },
      {
        name: 'regionWidth',
        type: 'number',
        label: '区域宽度',
        min: 0,
        max: 9999,
        step: 1,
        default: 0,
        description: '马赛克区域宽度（0 为全图）'
      },
      {
        name: 'regionHeight',
        type: 'number',
        label: '区域高度',
        min: 0,
        max: 9999,
        step: 1,
        default: 0,
        description: '马赛克区域高度（0 为全图）'
      }
    ],
    supportsGPU: true,
    supportsCPU: true
  },
  {
    type: 'watermark',
    name: '水印',
    description: '在图像上叠加水印文本或图像',
    category: 'composite',
    parameters: [
      {
        name: 'text',
        type: 'string',
        label: '水印文字',
        default: 'WATERMARK',
        description: '水印文本内容'
      },
      {
        name: 'x',
        type: 'number',
        label: '位置 X',
        min: 0,
        max: 9999,
        step: 1,
        default: 20,
        description: '水印左上角 X 坐标'
      },
      {
        name: 'y',
        type: 'number',
        label: '位置 Y',
        min: 0,
        max: 9999,
        step: 1,
        default: 20,
        description: '水印左上角 Y 坐标'
      },
      {
        name: 'opacity',
        type: 'number',
        label: '不透明度',
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.5,
        description: '水印的不透明度'
      },
      {
        name: 'fontSize',
        type: 'number',
        label: '字体大小',
        min: 8,
        max: 200,
        step: 1,
        default: 32,
        description: '水印文字大小'
      },
      {
        name: 'fontFamily',
        type: 'string',
        label: '字体',
        default: 'Arial',
        description: '水印文字字体'
      },
      {
        name: 'color',
        type: 'color',
        label: '颜色',
        default: '#ffffff',
        description: '水印文字颜色'
      },
      {
        name: 'tiled',
        type: 'boolean',
        label: '平铺',
        default: false,
        description: '是否平铺整个图像'
      },
      {
        name: 'tileSpacingX',
        type: 'number',
        label: '平铺间距 X',
        min: 0,
        max: 1000,
        step: 1,
        default: 100,
        description: '平铺时的水平间距'
      },
      {
        name: 'tileSpacingY',
        type: 'number',
        label: '平铺间距 Y',
        min: 0,
        max: 1000,
        step: 1,
        default: 100,
        description: '平铺时的垂直间距'
      }
    ],
    supportsGPU: false,
    supportsCPU: true
  }
]

export function getFilterDefinition(type: string): FilterDefinition | undefined {
  return filterDefinitions.find(f => f.type === type)
}

export function getFilterDefaultParameters(type: string): Record<string, any> {
  const def = getFilterDefinition(type)
  if (!def) return {}
  const params: Record<string, any> = {}
  def.parameters.forEach(p => {
    params[p.name] = p.default
  })
  return params
}
