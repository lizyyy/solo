import semver from 'semver';
import { parseVersionRange, isVersionInRange, findIntersection } from '../utils/version-parser.js';
export function detectConflicts(requirements, ciVersions) {
    const conflicts = [];
    const anomalies = [];
    const validRanges = requirements.filter(r => r.range.isValid);
    const invalidRanges = requirements.filter(r => !r.range.isValid);
    for (const invalid of invalidRanges) {
        conflicts.push({
            type: 'invalid-range',
            packages: [invalid.packageName],
            message: `Invalid version range in ${invalid.packageName}: "${invalid.range.raw}" - ${invalid.range.parseError}`,
            severity: 'error'
        });
    }
    const ranges = validRanges.map(r => r.range.raw);
    const intersection = findIntersection(ranges);
    if (!intersection && ranges.length > 1) {
        conflicts.push({
            type: 'range-conflict',
            packages: validRanges.map(r => r.packageName),
            message: `No compatible Node version found. Conflicting requirements: ${validRanges.map(r => `${r.packageName}: "${r.range.raw}"`).join(', ')}`,
            severity: 'error'
        });
    }
    for (const ciVersion of ciVersions) {
        const normalizedVersion = semver.coerce(ciVersion)?.version || ciVersion;
        for (const req of validRanges) {
            if (!isVersionInRange(normalizedVersion, req.range.raw)) {
                conflicts.push({
                    type: 'ci-mismatch',
                    packages: [req.packageName],
                    message: `CI version ${ciVersion} does not satisfy ${req.packageName}'s requirement: "${req.range.raw}"`,
                    severity: 'warning'
                });
            }
        }
    }
    return { conflicts, anomalies };
}
export function buildVersionMatrix(scanResult) {
    const { packages, lockfileEntries, ciConfigs, requirements, anomalies: scanAnomalies } = scanResult;
    const allRequirements = [...requirements];
    for (const pkg of packages) {
        if (pkg.engines?.node) {
            const parseResult = parseVersionRange(pkg.engines.node, {
                file: pkg.path,
                packageName: pkg.name
            });
            allRequirements.push({
                packageName: pkg.name,
                packagePath: pkg.path,
                range: parseResult.range,
                source: 'engines'
            });
        }
    }
    for (const entry of lockfileEntries) {
        if (entry.engines?.node) {
            const parseResult = parseVersionRange(entry.engines.node, {
                file: entry.path,
                packageName: entry.name
            });
            allRequirements.push({
                packageName: entry.name,
                packagePath: entry.path,
                range: parseResult.range,
                source: 'lockfile'
            });
        }
    }
    const ciVersions = ciConfigs.flatMap(c => c.nodeVersions);
    const { conflicts, anomalies } = detectConflicts(allRequirements, ciVersions);
    const allVersions = new Set();
    const compatiblePackages = new Map();
    const testVersions = generateTestVersions();
    for (const version of testVersions) {
        const compatiblePkgs = [];
        for (const req of allRequirements.filter(r => r.range.isValid)) {
            if (isVersionInRange(version, req.range.raw)) {
                compatiblePkgs.push(req.packageName);
            }
        }
        if (compatiblePkgs.length > 0) {
            allVersions.add(version);
            compatiblePackages.set(version, compatiblePkgs);
        }
    }
    const recommendedVersions = findRecommendedVersions(Array.from(allVersions), allRequirements.filter(r => r.range.isValid));
    return {
        allVersions: Array.from(allVersions).sort(semver.compare),
        recommendedVersions,
        compatiblePackages,
        conflicts,
        anomalies: [...scanAnomalies, ...anomalies]
    };
}
function generateTestVersions() {
    const versions = [];
    for (let major = 14; major <= 22; major++) {
        for (let minor = 0; minor <= 20; minor += 2) {
            versions.push(`${major}.${minor}.0`);
        }
    }
    return versions;
}
function findRecommendedVersions(versions, requirements) {
    const scored = [];
    for (const version of versions) {
        let score = 0;
        for (const req of requirements) {
            if (isVersionInRange(version, req.range.raw)) {
                score++;
            }
        }
        if (score > 0) {
            scored.push({ version, score });
        }
    }
    const maxScore = Math.max(...scored.map(s => s.score));
    const bestVersions = scored.filter(s => s.score === maxScore).map(s => s.version);
    return bestVersions.sort(semver.compare).reverse().slice(0, 3);
}
//# sourceMappingURL=conflict-detector.js.map