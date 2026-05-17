const fs = require('fs');
const path = require('path');

function findLineNumbersForJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const result = {};

  function findLineForPath(keyPath) {
    const keys = keyPath.split('.');
    let currentDepth = 0;
    let inString = false;
    let escapeNext = false;
    let currentKey = '';
    let keyStartLine = 1;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        const char = line[charIdx];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          if (inString) {
            keyStartLine = lineNum + 1;
            currentKey = '';
          } else {
            if (currentKey === keys[currentDepth]) {
              if (currentDepth === keys.length - 1) {
                return lineNum + 1;
              }
              currentDepth++;
            }
          }
          continue;
        }

        if (inString) {
          currentKey += char;
        }
      }
    }

    return 'unknown';
  }

  return {
    getLine: (keyPath) => findLineForPath(keyPath)
  };
}

function parseJsonWithSource(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const lineFinder = findLineNumbersForJson(filePath);

  function processApplications(apps, basePath = 'applications') {
    return apps.map((app, appIdx) => {
      const appPath = `${basePath}[${appIdx}]`;
      const appLine = lineFinder.getLine(`applications.${app.name || app.appId}`);
      
      const processedApp = { ...app };
      processedApp._source = {
        file: filePath,
        fileName: path.basename(filePath),
        line: appLine !== 'unknown' ? appLine : lineFinder.getLine('applications') + 3 + appIdx * 10,
        index: appIdx
      };

      if (app.environments && Array.isArray(app.environments)) {
        processedApp.environments = app.environments.map((env, envIdx) => {
          const envLine = lineFinder.getLine(`applications.${app.name || app.appId}.${env.name}`);
          const processedEnv = { ...env };
          processedEnv._source = {
            file: filePath,
            fileName: path.basename(filePath),
            line: envLine !== 'unknown' ? envLine : processedApp._source.line + 5 + envIdx * 8,
            index: envIdx
          };

          if (env.authorizedRedirectUris && Array.isArray(env.authorizedRedirectUris)) {
            processedEnv.authorizedRedirectUris = env.authorizedRedirectUris.map((uri, uriIdx) => {
              if (typeof uri === 'string') {
                return {
                  value: uri,
                  _source: {
                    file: filePath,
                    fileName: path.basename(filePath),
                    line: processedEnv._source.line + 4 + uriIdx * 2,
                    index: uriIdx,
                    rawContent: uri
                  }
                };
              }
              return uri;
            });
          }

          return processedEnv;
        });
      }

      return processedApp;
    });
  }

  if (data.applications && Array.isArray(data.applications)) {
    data.applications = processApplications(data.applications);
  }

  data._file = filePath;
  data._fileName = path.basename(filePath);

  return data;
}

function parseErrorSamplesWithSource(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const lines = content.split('\n');

  if (Array.isArray(data)) {
    return data.map((sample, index) => {
      let lineNumber = 'unknown';
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(sample.redirectUri || sample.url || sample.error)) {
          lineNumber = i + 1;
          break;
        }
      }

      return {
        ...sample,
        _source: {
          file: filePath,
          fileName: path.basename(filePath),
          line: lineNumber === 'unknown' ? 2 + index * 8 : lineNumber,
          index: index,
          rawContent: lines[lineNumber - 1] || JSON.stringify(sample).substring(0, 100)
        }
      };
    });
  }

  return data;
}

module.exports = {
  parseJsonWithSource,
  parseErrorSamplesWithSource
};
