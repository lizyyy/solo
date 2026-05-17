const path = require('path');
const {
  resolveAssetPath,
  checkFileExists,
  collectAllAssets,
  findHTMLFiles
} = require('./path-resolver');

function groupByUrl(assets) {
  const groups = new Map();
  
  for (const asset of assets) {
    const key = `${asset.url}||${asset.filePath}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(asset);
  }
  
  return groups;
}

function scanDirectory(baseDir, options = {}) {
  const startTime = Date.now();
  const results = {
    summary: {
      totalFilesScanned: 0,
      totalAssetsFound: 0,
      missingAssetsCount: 0,
      missingByType: {
        image: 0,
        font: 0,
        css: 0,
        script: 0,
        media: 0,
        other: 0
      },
      scanDuration: 0,
      baseDir: path.resolve(baseDir)
    },
    files: [],
    missingAssets: [],
    validAssets: [],
    errors: []
  };

  try {
    const htmlFiles = findHTMLFiles(baseDir);
    results.summary.totalFilesScanned = htmlFiles.length;
    results.files = htmlFiles.map(f => path.relative(baseDir, f));

    const allAssets = [];
    const visitedFiles = new Set();

    for (const htmlFile of htmlFiles) {
      const fileAssets = collectAllAssets(htmlFile, baseDir, visitedFiles);
      allAssets.push(...fileAssets);
    }

    results.summary.totalAssetsFound = allAssets.length;

    const groupedAssets = groupByUrl(allAssets);
    const processedUrls = new Set();

    for (const [key, occurrences] of groupedAssets) {
      const firstOccurrence = occurrences[0];
      const resolved = resolveAssetPath(firstOccurrence.url, firstOccurrence.filePath, baseDir);
      const fileCheck = checkFileExists(resolved.absolutePath);

      const assetResult = {
        url: firstOccurrence.url,
        normalizedUrl: resolved.normalizedUrl,
        resolvedPath: resolved.relativePath,
        absolutePath: resolved.absolutePath,
        type: firstOccurrence.type,
        occurrences: occurrences.map(o => ({
          source: o.source,
          filePath: o.filePath,
          line: o.line,
          column: o.column,
          pattern: o.pattern,
          rawValue: o.rawValue,
          context: o.context
        })),
        occurrenceCount: occurrences.length,
        exists: fileCheck.exists,
        fileInfo: fileCheck
      };

      if (!fileCheck.exists) {
        results.missingAssets.push(assetResult);
        results.summary.missingAssetsCount++;
        if (results.summary.missingByType.hasOwnProperty(firstOccurrence.type)) {
          results.summary.missingByType[firstOccurrence.type]++;
        } else {
          results.summary.missingByType.other++;
        }
      } else {
        results.validAssets.push(assetResult);
      }
    }

  } catch (error) {
    results.errors.push({
      type: 'scan_error',
      message: error.message,
      stack: error.stack
    });
  }

  results.summary.scanDuration = Date.now() - startTime;
  return results;
}

function scanSingleFile(filePath, baseDir) {
  const startTime = Date.now();
  const results = {
    summary: {
      totalFilesScanned: 1,
      totalAssetsFound: 0,
      missingAssetsCount: 0,
      missingByType: {
        image: 0,
        font: 0,
        css: 0,
        script: 0,
        media: 0,
        other: 0
      },
      scanDuration: 0,
      baseDir: path.resolve(baseDir)
    },
    files: [path.relative(baseDir, filePath)],
    missingAssets: [],
    validAssets: [],
    errors: []
  };

  try {
    const allAssets = collectAllAssets(filePath, baseDir);
    results.summary.totalAssetsFound = allAssets.length;

    const groupedAssets = groupByUrl(allAssets);

    for (const [key, occurrences] of groupedAssets) {
      const firstOccurrence = occurrences[0];
      const resolved = resolveAssetPath(firstOccurrence.url, firstOccurrence.filePath, baseDir);
      const fileCheck = checkFileExists(resolved.absolutePath);

      const assetResult = {
        url: firstOccurrence.url,
        normalizedUrl: resolved.normalizedUrl,
        resolvedPath: resolved.relativePath,
        absolutePath: resolved.absolutePath,
        type: firstOccurrence.type,
        occurrences: occurrences.map(o => ({
          source: o.source,
          filePath: o.filePath,
          line: o.line,
          column: o.column,
          pattern: o.pattern,
          rawValue: o.rawValue,
          context: o.context
        })),
        occurrenceCount: occurrences.length,
        exists: fileCheck.exists,
        fileInfo: fileCheck
      };

      if (!fileCheck.exists) {
        results.missingAssets.push(assetResult);
        results.summary.missingAssetsCount++;
        if (results.summary.missingByType.hasOwnProperty(firstOccurrence.type)) {
          results.summary.missingByType[firstOccurrence.type]++;
        } else {
          results.summary.missingByType.other++;
        }
      } else {
        results.validAssets.push(assetResult);
      }
    }

  } catch (error) {
    results.errors.push({
      type: 'scan_error',
      message: error.message,
      stack: error.stack
    });
  }

  results.summary.scanDuration = Date.now() - startTime;
  return results;
}

module.exports = {
  scanDirectory,
  scanSingleFile
};
