import { Placeholder } from './types.js';

const PLACEHOLDER_PATTERNS = [
  { regex: /\{(\w+)\}/g, type: 'curly' as const },
  { regex: /\{\{(\w+)\}\}/g, type: 'doubleCurly' as const },
  { regex: /\$(\w+)/g, type: 'dollar' as const },
  { regex: /%(\w+)%/g, type: 'percent' as const },
  { regex: /:(\w+)/g, type: 'colon' as const },
];

export function extractPlaceholders(text: string): Placeholder[] {
  const placeholders: Placeholder[] = [];
  const seen = new Set<string>();

  for (const { regex, type } of PLACEHOLDER_PATTERNS) {
    const matches = text.matchAll(regex);
    for (const match of matches) {
      const raw = match[0];
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        placeholders.push({ name, raw, type });
      }
    }
  }

  return placeholders;
}

export function comparePlaceholders(
  source: Placeholder[],
  target: Placeholder[]
): {
  missing: Placeholder[];
  extra: Placeholder[];
} {
  const sourceNames = new Set(source.map(p => p.name));
  const targetNames = new Set(target.map(p => p.name));

  const missing = source.filter(p => !targetNames.has(p.name));
  const extra = target.filter(p => !sourceNames.has(p.name));

  return { missing, extra };
}

export function generateFixSuggestion(
  sourceText: string,
  targetText: string,
  missing: Placeholder[]
): string {
  if (missing.length === 0) return targetText;

  let suggestion = targetText;
  const sourcePlaceholders = extractPlaceholders(sourceText);
  
  const lastPlaceholder = sourcePlaceholders[sourcePlaceholders.length - 1];
  if (lastPlaceholder) {
    const sourceEndIndex = sourceText.lastIndexOf(lastPlaceholder.raw) + lastPlaceholder.raw.length;
    const hasSpaceAfter = sourceText[sourceEndIndex] === ' ';
    
    missing.forEach(p => {
      if (!suggestion.includes(p.raw)) {
        if (suggestion.endsWith('。') || suggestion.endsWith('.') || suggestion.endsWith('！') || suggestion.endsWith('!')) {
          suggestion = suggestion.slice(0, -1) + (hasSpaceAfter ? ' ' : '') + p.raw + suggestion.slice(-1);
        } else {
          suggestion = suggestion + (hasSpaceAfter ? ' ' : '') + p.raw;
        }
      }
    });
  }

  return suggestion;
}
