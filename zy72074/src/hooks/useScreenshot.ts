import { useCallback, useRef } from 'react';
import { captureScreenshotWithMetadata, downloadDataUrl, generateExportFilename, formatDateTime } from '../utils/export';
import type { Point, Plan } from '../types';

export function useScreenshot() {
  const targetRef = useRef<HTMLDivElement>(null);

  const exportScreenshot = useCallback(async (
    plan: Plan | undefined,
    selectedPoint: Point | undefined,
    element?: HTMLElement
  ) => {
    const targetElement = element || targetRef.current;
    if (!targetElement) {
      console.error('No element to capture');
      return;
    }

    try {
      const metadata = {
        planName: plan?.name || '未命名方案',
        exportTime: formatDateTime(new Date()),
        pointName: selectedPoint?.name || '全视角',
        judgement: selectedPoint?.judgement || '遥感地块变化分析结果',
        handler: selectedPoint?.handler || '-',
        handledAt: selectedPoint?.handledAt || '-',
      };

      const dataUrl = await captureScreenshotWithMetadata(targetElement, metadata);
      const filename = generateExportFilename(
        plan?.name || '遥感地块变化分析',
        selectedPoint?.name
      );
      
      downloadDataUrl(dataUrl, filename);
      
      return { success: true, filename };
    } catch (error) {
      console.error('Screenshot export failed:', error);
      return { success: false, error };
    }
  }, []);

  return {
    targetRef,
    exportScreenshot,
  };
}
