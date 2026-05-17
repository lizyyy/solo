const PLACEHOLDER_PATTERNS = [
    { regex: /\{(\w+)\}/g, type: 'curly' },
    { regex: /\{\{(\w+)\}\}/g, type: 'doubleCurly' },
    { regex: /\$(\w+)/g, type: 'dollar' },
    { regex: /%(\w+)%/g, type: 'percent' },
    { regex: /:(\w+)/g, type: 'colon' },
];
export function extractPlaceholders(text) {
    const placeholders = [];
    const seen = new Set();
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
export function comparePlaceholders(source, target) {
    const sourceNames = new Set(source.map(p => p.name));
    const targetNames = new Set(target.map(p => p.name));
    const missing = source.filter(p => !targetNames.has(p.name));
    const extra = target.filter(p => !sourceNames.has(p.name));
    return { missing, extra };
}
export function generateFixSuggestion(sourceText, targetText, missing) {
    if (missing.length === 0)
        return targetText;
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
                }
                else {
                    suggestion = suggestion + (hasSpaceAfter ? ' ' : '') + p.raw;
                }
            }
        });
    }
    return suggestion;
}
//# sourceMappingURL=placeholder-extractor.js.map