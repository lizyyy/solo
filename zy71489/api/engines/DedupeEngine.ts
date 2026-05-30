import type { Vote, DedupeRule } from '../../shared/types.js';

export function dedupeVotes(votes: Vote[], rules: DedupeRule[]): Vote[] {
  const enabledRules = rules.filter((r) => r.enabled);

  if (enabledRules.length === 0) {
    return votes.map((vote) => ({
      ...vote,
      isDuplicate: false,
      duplicateOf: undefined,
    }));
  }

  const sortedVotes = [...votes].sort((a, b) => new Date(a.votedAt).getTime() - new Date(b.votedAt).getTime());

  const seenKeys = new Map<string, string>();
  const result: Vote[] = [];

  for (const vote of sortedVotes) {
    const keys = generateKeys(vote, enabledRules);
    let isDuplicate = false;
    let duplicateOf: string | undefined;

    for (const key of keys) {
      if (seenKeys.has(key)) {
        isDuplicate = true;
        duplicateOf = seenKeys.get(key);
        break;
      }
    }

    if (!isDuplicate) {
      for (const key of keys) {
        seenKeys.set(key, vote.id);
      }
    }

    result.push({
      ...vote,
      isDuplicate,
      duplicateOf,
    });
  }

  const originalOrderMap = new Map(votes.map((v, i) => [v.id, i]));
  result.sort((a, b) => (originalOrderMap.get(a.id) || 0) - (originalOrderMap.get(b.id) || 0));

  return result;
}

function generateKeys(vote: Vote, rules: DedupeRule[]): string[] {
  const keys: string[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.field) {
      case 'voterId':
        if (vote.voterId) {
          keys.push(`voterId:${vote.voterId}:${vote.trackId}`);
        }
        break;
      case 'voterName':
        if (vote.voterName) {
          keys.push(`voterName:${vote.voterName.toLowerCase()}:${vote.trackId}`);
        }
        break;
      case 'trackName':
        if (vote.trackName) {
          keys.push(`trackName:${vote.trackName.toLowerCase()}`);
        }
        break;
    }
  }

  return keys;
}
