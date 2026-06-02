import type { Feedback } from '@/types';
import { differenceInDays } from 'date-fns';

export function calculateContentSimilarity(content1: string, content2: string): number {
  const words1 = new Set(content1.replace(/[，。、！？\s]/g, '').split(''));
  const words2 = new Set(content2.replace(/[，。、！？\s]/g, '').split(''));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  if (union.size === 0) return 1;
  return intersection.size / union.size;
}

export function isDuplicateFeedback(f1: Feedback, f2: Feedback): boolean {
  if (f1.pointId !== f2.pointId) return false;
  if (f1.type !== f2.type) return false;
  const daysDiff = Math.abs(differenceInDays(new Date(f1.reportTime), new Date(f2.reportTime)));
  if (daysDiff > 7) return false;
  const contentSimilarity = calculateContentSimilarity(f1.content, f2.content);
  const titleSimilarity = calculateContentSimilarity(f1.title, f2.title);
  return contentSimilarity > 0.9 || titleSimilarity > 0.9;
}

export function findDuplicateGroups(feedbacks: Feedback[]): { groupId: string; primary: Feedback; duplicates: Feedback[] }[] {
  const groups: { groupId: string; primary: Feedback; duplicates: Feedback[] }[] = [];
  const processed = new Set<string>();
  const sortedFeedbacks = [...feedbacks].sort((a, b) =>
    new Date(a.reportTime).getTime() - new Date(b.reportTime).getTime()
  );
  for (let i = 0; i < sortedFeedbacks.length; i++) {
    if (processed.has(sortedFeedbacks[i].id)) continue;
    const primary = sortedFeedbacks[i];
    const duplicates: Feedback[] = [];
    processed.add(primary.id);
    for (let j = i + 1; j < sortedFeedbacks.length; j++) {
      if (processed.has(sortedFeedbacks[j].id)) continue;
      if (isDuplicateFeedback(primary, sortedFeedbacks[j])) {
        duplicates.push(sortedFeedbacks[j]);
        processed.add(sortedFeedbacks[j].id);
      }
    }
    if (duplicates.length > 0) {
      groups.push({
        groupId: `dg-${Date.now()}-${i}`,
        primary,
        duplicates,
      });
    }
  }
  return groups;
}

export function mergeDuplicateFeedbacks(primary: Feedback, duplicates: Feedback[]): Feedback {
  const mergedContent = [primary.content, ...duplicates.map(d => d.content)].join('\n\n');
  const reporters = [primary.reporter, ...duplicates.map(d => d.reporter)].filter(Boolean);
  return {
    ...primary,
    content: mergedContent,
    reporter: reporters.join('、'),
    isDuplicate: false,
    status: 'processing' as const,
  };
}
