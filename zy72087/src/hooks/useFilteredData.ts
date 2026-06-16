import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import type { HistoricalSample, ReasoningChain, ManualReview, QualityIssue } from '@/types';
import { isDuplicate } from '@/engine/validator';

export function useFilteredData() {
  const samples = useStore((s) => s.samples);
  const chains = useStore((s) => s.chains);
  const issues = useStore((s) => s.issues);
  const filter = useStore((s) => s.filter);

  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      if (filter.lineId && s.lineId !== filter.lineId) return false;
      if (filter.timePeriod && s.timePeriod !== filter.timePeriod) return false;
      if (filter.dateRange[0] && s.date < filter.dateRange[0]) return false;
      if (filter.dateRange[1] && s.date > filter.dateRange[1]) return false;
      if (filter.source && s.source !== filter.source) return false;
      if (filter.issueType) {
        const sampleIssues = issues.filter((i) => i.sampleIds.includes(s.id));
        const hasIssue = sampleIssues.some((i) => i.type === filter.issueType);
        if (filter.issueType === 'duplicate') {
          if (!isDuplicate(s.id, issues) && !hasIssue) return false;
        } else {
          if (!hasIssue) return false;
        }
      }
      return true;
    });
  }, [samples, filter, issues]);

  const filteredChains = useMemo(() => {
    const filteredIds = new Set(filteredSamples.map((s) => s.id));
    return chains.filter((c) => filteredIds.has(c.sampleId));
  }, [filteredSamples, chains]);

  const filteredIssues = useMemo(() => {
    const filteredIds = new Set(filteredSamples.map((s) => s.id));
    const result: QualityIssue[] = [];
    for (const issue of issues) {
      if (issue.type === 'weight_unclosed') {
        result.push(issue);
      } else {
        const inScopeIds = issue.sampleIds.filter((id) => filteredIds.has(id));
        if (inScopeIds.length > 0) {
          result.push({
            ...issue,
            sampleIds: inScopeIds,
          });
        }
      }
    }
    return result;
  }, [filteredSamples, issues]);

  return { filteredSamples, filteredChains, filteredIssues };
}

export function useReviewForSample(sampleId: string): ManualReview | undefined {
  const reviews = useStore((s) => s.reviews);
  return reviews.find((r) => r.sampleId === sampleId);
}

export function useSampleById(id: string): HistoricalSample | undefined {
  const samples = useStore((s) => s.samples);
  return samples.find((s) => s.id === id);
}

export function useChainById(sampleId: string): ReasoningChain | undefined {
  const chains = useStore((s) => s.chains);
  return chains.find((c) => c.sampleId === sampleId);
}
