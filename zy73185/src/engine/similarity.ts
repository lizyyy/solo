export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  const cleaned = text.toLowerCase().replace(/[\s，。、；：""''（）\(\)\[\]【】,.;:\-_/\\]/g, " ");
  for (const piece of cleaned.split(/\s+/)) {
    if (piece.length > 0) tokens.add(piece);
  }
  for (let i = 0; i < cleaned.length - 1; i++) {
    const bigram = cleaned.slice(i, i + 2).trim();
    if (bigram.length === 2) tokens.add(bigram);
  }
  return tokens;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function similarityScore(a: string, b: string): number {
  return jaccard(tokenize(a), tokenize(b));
}
