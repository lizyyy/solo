import { useState, useCallback } from 'react';
import { ColorAnalysisResult, ColorIssue, ColorSample } from '../types';
import { useWorkStore } from '../store/useWorkStore';
import { analyzeColorQuality } from '../lib/colorAnalyzer';

interface UseColorAnalysisReturn {
  isAnalyzing: boolean;
  error: string | null;
  result: ColorAnalysisResult | null;
  analyze: (versionId: string) => Promise<ColorAnalysisResult | null>;
  getIssueColor: (issue: ColorIssue) => string;
  getIssueLabel: (issue: ColorIssue) => string;
  getSeverityLabel: (severity: string) => string;
  filterColors: (colors: ColorSample[], options?: {
    excludeBackground?: boolean;
    excludeExtreme?: boolean;
    minPercentage?: number;
  }) => ColorSample[];
}

export function useColorAnalysis(): UseColorAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ColorAnalysisResult | null>(null);

  const analyzeVersion = useWorkStore(state => state.analyzeVersion);
  const currentAnalysis = useWorkStore(state => state.currentAnalysis);

  const analyze = useCallback(async (versionId: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const analysisResult = await analyzeVersion(versionId);
      setResult(analysisResult);
      return analysisResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析失败';
      setError(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [analyzeVersion]);

  const getIssueColor = useCallback((issue: ColorIssue): string => {
    const colors: Record<string, string> = {
      duplicate: '#d46c3a',
      gray: '#6b7280',
      over_saturated: '#bc4749'
    };
    return colors[issue.type] || '#6b7280';
  }, []);

  const getIssueLabel = useCallback((issue: ColorIssue): string => {
    const labels: Record<string, string> = {
      duplicate: '配色重复',
      gray: '画面偏灰',
      over_saturated: '色彩过饱和'
    };
    return labels[issue.type] || issue.type;
  }, []);

  const getSeverityLabel = useCallback((severity: string): string => {
    const labels: Record<string, string> = {
      low: '轻度',
      medium: '中度',
      high: '严重'
    };
    return labels[severity] || severity;
  }, []);

  const filterColors = useCallback((
    colors: ColorSample[],
    options: {
      excludeBackground?: boolean;
      excludeExtreme?: boolean;
      minPercentage?: number;
    } = {}
  ): ColorSample[] => {
    const {
      excludeBackground = true,
      excludeExtreme = true,
      minPercentage = 0
    } = options;

    return colors.filter(c => {
      if (excludeBackground && c.isBackground) return false;
      if (excludeExtreme && c.isExtreme) return false;
      if (minPercentage > 0 && c.percentage < minPercentage) return false;
      return true;
    });
  }, []);

  return {
    isAnalyzing,
    error,
    result: result || currentAnalysis,
    analyze,
    getIssueColor,
    getIssueLabel,
    getSeverityLabel,
    filterColors
  };
}
