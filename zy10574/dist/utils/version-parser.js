import semver from 'semver';
export function parseVersionRange(range, context) {
    if (!range || range.trim() === '') {
        return {
            range: {
                raw: range,
                minVersion: null,
                maxVersion: null,
                isValid: false,
                parseError: 'Empty version range'
            },
            anomaly: context ? {
                id: `empty-range-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                type: 'empty-range',
                location: { file: context.file, raw: range },
                message: `Package "${context.packageName}" has an empty Node version requirement`,
                cause: 'engines.node field is empty or missing'
            } : undefined
        };
    }
    try {
        const cleanedRange = range.trim();
        if (!semver.validRange(cleanedRange)) {
            return {
                range: {
                    raw: cleanedRange,
                    minVersion: null,
                    maxVersion: null,
                    isValid: false,
                    parseError: `Invalid semver range: "${cleanedRange}"`
                },
                anomaly: context ? {
                    id: `invalid-range-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    type: 'invalid-range',
                    location: { file: context.file, raw: cleanedRange },
                    message: `Package "${context.packageName}" has invalid version range: "${cleanedRange}"`,
                    cause: 'semver range syntax error'
                } : undefined
            };
        }
        const minVersion = semver.minVersion(cleanedRange)?.version || null;
        const maxVersion = extractMaxVersion(cleanedRange);
        return {
            range: {
                raw: cleanedRange,
                minVersion,
                maxVersion,
                isValid: true
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown parse error';
        return {
            range: {
                raw: range,
                minVersion: null,
                maxVersion: null,
                isValid: false,
                parseError: errorMessage
            },
            anomaly: context ? {
                id: `parse-error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                type: 'parse-error',
                location: { file: context.file, raw: range },
                message: `Failed to parse version range for "${context.packageName}": ${errorMessage}`,
                cause: 'exception during semver parsing'
            } : undefined
        };
    }
}
function extractMaxVersion(range) {
    if (range.includes('<') && !range.includes('<=')) {
        const match = range.match(/<\s*(\d+\.\d+\.\d+)/);
        if (match) {
            const version = semver.parse(match[1]);
            if (version) {
                return `${version.major}.${version.minor}.${version.patch - 1}`;
            }
        }
    }
    if (range.includes('<=')) {
        const match = range.match(/<=\s*(\d+\.\d+\.\d+)/);
        if (match)
            return match[1];
    }
    return null;
}
export function isVersionInRange(version, range) {
    try {
        return semver.satisfies(version, range, { includePrerelease: true });
    }
    catch {
        return false;
    }
}
export function findIntersection(ranges) {
    if (ranges.length === 0)
        return null;
    if (ranges.length === 1)
        return ranges[0];
    try {
        const validRanges = ranges.filter(r => semver.validRange(r));
        if (validRanges.length === 0)
            return null;
        const intersection = validRanges.join(' ');
        if (semver.validRange(intersection)) {
            const testVersions = generateTestVersions();
            const compatible = testVersions.filter(v => semver.satisfies(v, intersection));
            if (compatible.length > 0) {
                return intersection;
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
function generateTestVersions() {
    const versions = [];
    for (let major = 14; major <= 22; major++) {
        for (let minor = 0; minor <= 20; minor += 5) {
            versions.push(`${major}.${minor}.0`);
        }
    }
    return versions;
}
export function normalizeVersion(version) {
    const cleaned = version.replace(/^v/i, '').trim();
    const parsed = semver.parse(cleaned);
    if (parsed)
        return parsed.version;
    const coerced = semver.coerce(cleaned);
    if (coerced)
        return coerced.version;
    return cleaned;
}
//# sourceMappingURL=version-parser.js.map