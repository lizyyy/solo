import { VersionCompatibilityResult, VersionConstraint } from '../types';

export function parseSemver(version: string): { major: number; minor: number; patch: number; prerelease?: string; build?: string } {
  const match = version.match(
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
  );
  
  if (!match) {
    throw new Error(`Invalid semver: ${version}`);
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5]
  };
}

export function compareSemver(a: string, b: string): number {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  
  if (parsedA.major !== parsedB.major) {
    return parsedA.major - parsedB.major;
  }
  
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor - parsedB.minor;
  }
  
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch - parsedB.patch;
  }
  
  if (parsedA.prerelease && !parsedB.prerelease) {
    return -1;
  }
  
  if (!parsedA.prerelease && parsedB.prerelease) {
    return 1;
  }
  
  return 0;
}

export function satisfiesVersion(version: string, constraint: VersionConstraint): boolean {
  try {
    if (constraint.compatibleVersions && constraint.compatibleVersions.length > 0) {
      return constraint.compatibleVersions.some(v => v === version);
    }
    
    if (constraint.minVersion && compareSemver(version, constraint.minVersion) < 0) {
      return false;
    }
    
    if (constraint.maxVersion && compareSemver(version, constraint.maxVersion) > 0) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

export function checkVersionCompatibility(
  pluginVersion: string,
  systemVersion: string,
  constraint?: VersionConstraint
): VersionCompatibilityResult {
  try {
    const pluginParsed = parseSemver(pluginVersion);
    const systemParsed = parseSemver(systemVersion);
    
    if (constraint) {
      const compatible = satisfiesVersion(pluginVersion, constraint);
      if (compatible) {
        return {
          compatible: true,
          pluginVersion,
          systemVersion
        };
      }
    }
    
    if (pluginParsed.major !== systemParsed.major) {
      return {
        compatible: false,
        pluginVersion,
        systemVersion,
        reason: `Plugin major version (${pluginParsed.major}) does not match system major version (${systemParsed.major})`,
        recommendedAction: 'Use a plugin version with the same major version as your system'
      };
    }
    
    if (pluginParsed.minor < systemParsed.minor) {
      return {
        compatible: false,
        pluginVersion,
        systemVersion,
        reason: `Plugin minor version (${pluginParsed.minor}) is lower than system minor version (${systemParsed.minor})`,
        recommendedAction: 'Update the plugin to a compatible version'
      };
    }
    
    return {
      compatible: true,
      pluginVersion,
      systemVersion
    };
  } catch (error) {
    return {
      compatible: false,
      pluginVersion,
      systemVersion,
      reason: `Failed to parse versions: ${(error as Error).message}`,
      recommendedAction: 'Check version format'
    };
  }
}

export function formatVersion(version: string): string {
  return version.startsWith('v') ? version : `v${version}`;
}

export function isStableVersion(version: string): boolean {
  const parsed = parseSemver(version);
  return !parsed.prerelease;
}
