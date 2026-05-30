import { CHANNEL_MAPPING } from '../../shared/constants.js';
import type { ChannelMapping } from '../../shared/types.js';

export function normalizeChannel(channel: string, customMapping?: ChannelMapping): string {
  const mapping = { ...CHANNEL_MAPPING, ...customMapping };
  const trimmed = channel.trim();

  if (mapping[trimmed]) {
    return mapping[trimmed];
  }

  const lowerTrimmed = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(mapping)) {
    if (key.toLowerCase() === lowerTrimmed) {
      return value;
    }
  }

  for (const [key, value] of Object.entries(mapping)) {
    if (lowerTrimmed.includes(key.toLowerCase())) {
      return value;
    }
  }

  return '其他';
}

export function detectDuplicateChannels(channels: string[]): { original: string; normalized: string }[] {
  const seen = new Map<string, string[]>();
  const duplicates: { original: string; normalized: string }[] = [];

  for (const channel of channels) {
    const normalized = normalizeChannel(channel);
    if (seen.has(normalized)) {
      const existing = seen.get(normalized)!;
      if (!existing.includes(channel)) {
        duplicates.push({ original: channel, normalized });
      }
    } else {
      seen.set(normalized, [channel]);
    }
  }

  return duplicates;
}

export function getChannelStats(sales: { channel: string; quantity: number }[]): Map<string, number> {
  const stats = new Map<string, number>();

  for (const sale of sales) {
    const normalized = normalizeChannel(sale.channel);
    const current = stats.get(normalized) || 0;
    stats.set(normalized, current + sale.quantity);
  }

  return stats;
}
