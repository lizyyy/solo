import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execFileAsync = promisify(execFile);

export class DependencyParser {
  constructor(options = {}) {
    this.options = {
      checkExistence: options.checkExistence !== false,
      systemPaths: options.systemPaths || [
        '/usr/lib',
        '/System/Library/Frameworks',
        '/Library/Frameworks'
      ],
      rpaths: options.rpaths || []
    };
  }

  async parseDependencies(binaryFile) {
    const result = {
      file: binaryFile.path,
      name: binaryFile.name,
      fileType: binaryFile.fileType,
      architectures: binaryFile.architectures,
      rpaths: [],
      dependencies: [],
      missingDependencies: [],
      byArchitecture: {},
      error: null,
      warnings: []
    };

    try {
      const { stdout, stderr } = await execFileAsync('otool', ['-l', binaryFile.path]);
      
      if (stderr) {
        result.warnings.push(stderr.trim());
      }

      this.parseLoadCommands(stdout, result);
      
      await this.checkDependencyExistence(result);
      
      this.groupByArchitecture(result);
      
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  parseLoadCommands(otoolOutput, result) {
    const lines = otoolOutput.split('\n');
    let currentArch = null;
    let inDylib = false;
    let inRpath = false;
    
    const archHeaderRegex = /^(.+?)\s+\(architecture\s+(.+?)\):$/;
    const cmdRegex = /^\s+cmd\s+(LC_.+)$/;
    const nameRegex = /^\s+name\s+(.+?)\s+\(offset/;
    const rpathRegex = /^\s+path\s+(.+?)\s+\(offset/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      const archMatch = line.match(archHeaderRegex);
      if (archMatch) {
        currentArch = archMatch[2];
        if (!result.byArchitecture[currentArch]) {
          result.byArchitecture[currentArch] = {
            dependencies: [],
            rpaths: [],
            missing: []
          };
        }
        continue;
      }

      const cmdMatch = line.match(cmdRegex);
      if (cmdMatch) {
        const cmd = cmdMatch[1];
        inDylib = cmd === 'LC_LOAD_DYLIB' || 
                  cmd === 'LC_LOAD_WEAK_DYLIB' ||
                  cmd === 'LC_REEXPORT_DYLIB';
        inRpath = cmd === 'LC_RPATH';
        continue;
      }

      if (inDylib) {
        const nameMatch = line.match(nameRegex);
        if (nameMatch) {
          const depPath = nameMatch[1];
          const depInfo = this.parseDependencyPath(depPath);
          
          if (!result.dependencies.some(d => d.path === depPath)) {
            result.dependencies.push(depInfo);
          }
          
          if (currentArch && result.byArchitecture[currentArch]) {
            if (!result.byArchitecture[currentArch].dependencies.includes(depPath)) {
              result.byArchitecture[currentArch].dependencies.push(depPath);
            }
          }
          
          inDylib = false;
        }
      }

      if (inRpath) {
        const rpathMatch = line.match(rpathRegex);
        if (rpathMatch) {
          const rpath = rpathMatch[1];
          
          if (!result.rpaths.includes(rpath)) {
            result.rpaths.push(rpath);
          }
          
          if (currentArch && result.byArchitecture[currentArch]) {
            if (!result.byArchitecture[currentArch].rpaths.includes(rpath)) {
              result.byArchitecture[currentArch].rpaths.push(rpath);
            }
          }
          
          inRpath = false;
        }
      }
    }
  }

  parseDependencyPath(depPath) {
    const info = {
      path: depPath,
      type: 'unknown',
      framework: null,
      version: null,
      isSystem: false,
      isRpath: false,
      isLoaderPath: false,
      isExecutablePath: false
    };

    if (depPath.startsWith('@rpath/')) {
      info.type = 'rpath';
      info.isRpath = true;
    } else if (depPath.startsWith('@loader_path/')) {
      info.type = 'loader_path';
      info.isLoaderPath = true;
    } else if (depPath.startsWith('@executable_path/')) {
      info.type = 'executable_path';
      info.isExecutablePath = true;
    } else if (depPath.startsWith('/System/Library/') || 
               depPath.startsWith('/usr/lib/') ||
               depPath.startsWith('/Library/Frameworks/')) {
      info.type = 'system';
      info.isSystem = true;
    } else {
      info.type = 'absolute';
    }

    const frameworkMatch = depPath.match(/\/([^/]+\.framework)\//);
    if (frameworkMatch) {
      info.framework = frameworkMatch[1];
    }

    const versionMatch = depPath.match(/\.([\d.]+)\.dylib$/);
    if (versionMatch) {
      info.version = versionMatch[1];
    }

    return info;
  }

  async checkDependencyExistence(result) {
    const searchPaths = [
      ...this.options.systemPaths,
      ...this.options.rpaths,
      ...result.rpaths,
      path.dirname(result.file)
    ];

    for (const dep of result.dependencies) {
      const resolved = await this.resolveDependencyPath(dep.path, searchPaths, result.file);
      dep.resolvedPath = resolved.resolved;
      dep.exists = resolved.exists;
      dep.resolveAttempts = resolved.attempts;

      if (!resolved.exists) {
        result.missingDependencies.push({
          ...dep,
          reason: resolved.reason || 'File not found'
        });

        for (const arch of Object.keys(result.byArchitecture)) {
          if (result.byArchitecture[arch].dependencies.includes(dep.path)) {
            result.byArchitecture[arch].missing.push({
              path: dep.path,
              reason: resolved.reason || 'File not found'
            });
          }
        }
      }
    }
  }

  async resolveDependencyPath(depPath, searchPaths, originFile) {
    const result = {
      resolved: null,
      exists: false,
      attempts: [],
      reason: null
    };

    let actualPaths = [];

    if (depPath.startsWith('/')) {
      actualPaths.push(depPath);
    } else if (depPath.startsWith('@rpath/')) {
      const relativePath = depPath.replace('@rpath/', '');
      for (const sp of searchPaths) {
        actualPaths.push(path.join(sp, relativePath));
      }
    } else if (depPath.startsWith('@loader_path/')) {
      const relativePath = depPath.replace('@loader_path/', '');
      actualPaths.push(path.join(path.dirname(originFile), relativePath));
    } else if (depPath.startsWith('@executable_path/')) {
      const relativePath = depPath.replace('@executable_path/', '');
      actualPaths.push(path.join(path.dirname(originFile), relativePath));
    } else {
      actualPaths.push(depPath);
    }

    for (const tryPath of actualPaths) {
      result.attempts.push(tryPath);
      try {
        await fs.access(tryPath);
        result.resolved = tryPath;
        result.exists = true;
        break;
      } catch {
        continue;
      }
    }

    if (!result.exists) {
      result.reason = `Tried ${result.attempts.length} path(s), none existed`;
    }

    return result;
  }

  groupByArchitecture(result) {
    const allArches = Object.keys(result.byArchitecture);
    
    if (allArches.length === 0) {
      result.byArchitecture['universal'] = {
        dependencies: result.dependencies.map(d => d.path),
        rpaths: result.rpaths,
        missing: result.missingDependencies
      };
    }
  }
}
