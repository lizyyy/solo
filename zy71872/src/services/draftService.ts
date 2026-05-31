import type { Draft } from '../types';
import { computeHash, generateId } from '../utils/hash';
import { appendToStorage, loadFromStorage } from '../utils/storage';

export function createDraft(
  teamId: string,
  content: string,
  modifiedBy: string,
  changeSummary: string = '初始版本',
  parentVersion?: number
): Draft {
  const existingDrafts = loadFromStorage<Draft[]>('drafts', []);
  const teamDrafts = existingDrafts.filter((d) => d.teamId === teamId);
  const version = teamDrafts.length > 0 ? Math.max(...teamDrafts.map((d) => d.version)) + 1 : 1;

  const draft: Draft = {
    id: generateId('draft'),
    teamId,
    content,
    version,
    modifiedBy,
    modifiedAt: Date.now(),
    parentVersion,
    changeSummary,
    hash: computeHash({ teamId, content, version, modifiedBy }),
  };

  appendToStorage('drafts', draft);
  return draft;
}

export function getDraftHistory(teamId: string, drafts: Draft[]): Draft[] {
  return drafts
    .filter((d) => d.teamId === teamId)
    .sort((a, b) => b.version - a.version);
}

export function getLatestDraft(teamId: string, drafts: Draft[]): Draft | undefined {
  const history = getDraftHistory(teamId, drafts);
  return history[0];
}

export function compareDrafts(draft1: Draft, draft2: Draft): {
  added: string[];
  removed: string[];
  modified: string[];
} {
  const lines1 = draft1.content.split('\n');
  const lines2 = draft2.content.split('\n');

  const set1 = new Set(lines1);
  const set2 = new Set(lines2);

  const added = lines2.filter((line) => !set1.has(line));
  const removed = lines1.filter((line) => !set2.has(line));

  const commonLines = lines1.filter((line) => set2.has(line));
  const modified: string[] = [];

  for (let i = 0; i < Math.min(lines1.length, lines2.length); i++) {
    if (lines1[i] !== lines2[i] && commonLines.includes(lines1[i]) && commonLines.includes(lines2[i])) {
      modified.push(`行 ${i + 1}: "${lines1[i]}" → "${lines2[i]}"`);
    }
  }

  return { added, removed, modified };
}

export function validateDraftChain(drafts: Draft[]): boolean {
  const sorted = [...drafts].sort((a, b) => a.version - b.version);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].parentVersion !== sorted[i - 1].version) {
      return false;
    }
    const expectedHash = computeHash({
      teamId: sorted[i].teamId,
      content: sorted[i].content,
      version: sorted[i].version,
      modifiedBy: sorted[i].modifiedBy,
    });
    if (sorted[i].hash !== expectedHash) {
      return false;
    }
  }
  return true;
}
