function generateNextVersion(currentVersion: string): string {
  const match = currentVersion.match(/^v(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Invalid version format: ${currentVersion}. Expected format: vX.Y`);
  }

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);

  if (minor >= 9) {
    return `v${major + 1}.0`;
  }

  return `v${major}.${minor + 1}`;
}

export { generateNextVersion };
