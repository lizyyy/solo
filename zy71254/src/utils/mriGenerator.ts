import { Slice, Annotation, CaseNote } from '@/types';

const generateId = () => Math.random().toString(36).substring(2, 11);

export const generateMRISliceImage = (
  sliceIndex: number,
  totalSlices: number,
  hasLesion: boolean = false,
  hasArtifact: boolean = false
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 256, 256);

  const centerX = 128;
  const centerY = 128;
  const sliceProgress = sliceIndex / totalSlices;
  const headRadius = 80 + Math.sin(sliceProgress * Math.PI) * 20;

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, headRadius);
  gradient.addColorStop(0, '#404040');
  gradient.addColorStop(0.3, '#303030');
  gradient.addColorStop(0.6, '#252525');
  gradient.addColorStop(1, '#1a1a1a');

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, headRadius * 0.85, headRadius, 0, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, headRadius * 0.5, headRadius * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#505050';
  ctx.fill();

  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + sliceProgress * Math.PI;
    const r = headRadius * 0.35;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * r * 0.3, centerY + Math.sin(angle) * r * 0.3);
    ctx.lineTo(centerX + Math.cos(angle) * r, centerY + Math.sin(angle) * r);
    ctx.stroke();
  }

  if (hasLesion) {
    const lesionX = centerX + 30;
    const lesionY = centerY - 20;
    const lesionGradient = ctx.createRadialGradient(lesionX, lesionY, 0, lesionX, lesionY, 15);
    lesionGradient.addColorStop(0, 'rgba(255, 100, 100, 0.8)');
    lesionGradient.addColorStop(0.5, 'rgba(255, 50, 50, 0.5)');
    lesionGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(lesionX, lesionY, 15, 0, Math.PI * 2);
    ctx.fillStyle = lesionGradient;
    ctx.fill();
  }

  if (hasArtifact) {
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const y = 30 + i * 30;
      ctx.beginPath();
      ctx.moveTo(0, y + Math.random() * 10);
      ctx.lineTo(256, y + Math.random() * 10);
      ctx.stroke();
    }
  }

  const noiseImageData = ctx.getImageData(0, 0, 256, 256);
  const data = noiseImageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 15;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(noiseImageData, 0, 0);

  return canvas.toDataURL('image/png');
};

export const generateSampleSlices = (count: number = 24): Slice[] => {
  const slices: Slice[] = [];
  const lesionStartSlice = Math.floor(count * 0.4);
  const lesionEndSlice = Math.floor(count * 0.6);

  for (let i = 0; i < count; i++) {
    const hasLesion = i >= lesionStartSlice && i <= lesionEndSlice;
    const hasArtifact = i === Math.floor(count * 0.3);
    const hasError = i === Math.floor(count * 0.5) || i === 0;
    const hasSequenceError = i === Math.floor(count * 0.7);

    let errorType: Slice['errorType'] | undefined;
    let errorNote: string | undefined;

    if (hasError && i === 0) {
      errorType = 'window_lost';
      errorNote = '窗位设置丢失，请重新校准';
    } else if (hasError) {
      errorType = 'drift_detected';
      errorNote = '检测到层间漂移，建议检查';
    } else if (hasSequenceError) {
      errorType = 'sequence_error';
      errorNote = '层序可能错误，请确认扫描顺序';
    }

    slices.push({
      id: generateId(),
      index: i,
      imageData: generateMRISliceImage(i, count, hasLesion, hasArtifact),
      windowWidth: 400,
      windowCenter: 50,
      sliceThickness: 5,
      hasError: !!errorType,
      errorType,
      errorNote,
      isVisible: true,
      isHighlighted: false,
    });
  }

  return slices;
};

export const generateSampleAnnotations = (slices: Slice[]): Annotation[] => {
  const annotations: Annotation[] = [];
  const targetSlice = slices.find((s) => s.index === 12);

  if (targetSlice) {
    annotations.push({
      id: generateId(),
      sliceId: targetSlice.id,
      x: 0.6,
      y: 0.4,
      type: 'lesion',
      description: '疑似异常信号区，需要进一步确认',
      author: '张医生',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      hasDrift: true,
      originalPosition: { x: 0.58, y: 0.42 },
      isResolved: false,
    });

    annotations.push({
      id: generateId(),
      sliceId: targetSlice.id,
      x: 0.3,
      y: 0.5,
      type: 'note',
      description: '此处为正常解剖结构',
      author: '李老师',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      hasDrift: false,
      isResolved: true,
    });
  }

  return annotations;
};

export const generateSampleCaseNotes = (): CaseNote[] => {
  return [
    {
      id: generateId(),
      content: '患者为45岁男性，主诉头痛两周，无明显外伤史。建议重点观察额叶区域。',
      author: '张医生',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      sliceReferences: [],
      tags: ['病史', '初步诊断'],
    },
    {
      id: generateId(),
      content: '课堂练习：请注意第10-15层的异常信号，练习测量病灶大小。',
      author: '李老师',
      timestamp: new Date(Date.now() - 43200000).toISOString(),
      sliceReferences: [],
      tags: ['教学', '练习'],
    },
  ];
};

export const applyWindowLevel = (
  imageData: ImageData,
  windowWidth: number,
  windowCenter: number
): ImageData => {
  const data = imageData.data;
  const minWindow = windowCenter - windowWidth / 2;
  const maxWindow = windowCenter + windowWidth / 2;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    let adjusted = ((gray - minWindow) / windowWidth) * 255;
    adjusted = Math.max(0, Math.min(255, adjusted));

    data[i] = adjusted;
    data[i + 1] = adjusted;
    data[i + 2] = adjusted;
  }

  return imageData;
};
