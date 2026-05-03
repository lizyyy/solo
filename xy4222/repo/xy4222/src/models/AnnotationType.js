const AnnotationType = {
  CRACK: 'crack',
  COLOR_RESTORATION: 'color_restoration',
  DAMAGE: 'damage',
  STAIN: 'stain',
  HOLE: 'hole',
  OTHER: 'other'
}

export const AnnotationTypeLabels = {
  [AnnotationType.CRACK]: '裂纹',
  [AnnotationType.COLOR_RESTORATION]: '补色',
  [AnnotationType.DAMAGE]: '缺损',
  [AnnotationType.STAIN]: '污渍',
  [AnnotationType.HOLE]: '孔洞',
  [AnnotationType.OTHER]: '其他'
}

export const AnnotationTypeColors = {
  [AnnotationType.CRACK]: '#ff6b6b',
  [AnnotationType.COLOR_RESTORATION]: '#4ecdc4',
  [AnnotationType.DAMAGE]: '#ff8c42',
  [AnnotationType.STAIN]: '#a55eea',
  [AnnotationType.HOLE]: '#eb3b5a',
  [AnnotationType.OTHER]: '#778ca3'
}

export default AnnotationType
