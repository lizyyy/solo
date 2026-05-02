const fs = require('fs');
const path = require('path');
const semver = require('semver');
const schemaValidator = require('./schemaValidator');
const { pluginsDir } = require('../database');

class PluginLoader {
  loadManifest(manifestPath) {
    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      
      const validation = schemaValidator.validateManifest(manifest);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Invalid manifest',
          errors: validation.errors
        };
      }

      return {
        success: true,
        manifest,
        name: manifest.name,
        version: manifest.version
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to load manifest',
        details: error.message
      };
    }
  }

  validateVersion(pluginVersion, requiredVersion) {
    if (!requiredVersion) {
      return {
        valid: true,
        message: 'No version constraint specified'
      };
    }

    try {
      const satisfies = semver.satisfies(pluginVersion, requiredVersion);
      const coerced = semver.coerce(pluginVersion);
      
      return {
        valid: satisfies,
        pluginVersion: pluginVersion,
        requiredVersion: requiredVersion,
        parsedVersion: coerced ? coerced.version : null,
        message: satisfies 
          ? `Version ${pluginVersion} satisfies constraint ${requiredVersion}`
          : `Version ${pluginVersion} does NOT satisfy constraint ${requiredVersion}`
      };
    } catch (error) {
      return {
        valid: false,
        pluginVersion: pluginVersion,
        requiredVersion: requiredVersion,
        error: 'Version parsing failed',
        details: error.message
      };
    }
  }

  validateDependencies(manifest, installedPlugins = []) {
    const dependencies = manifest.dependencies || [];
    const results = [];

    for (const dep of dependencies) {
      const depPlugin = installedPlugins.find(p => p.name === dep.name);
      
      if (!depPlugin) {
        results.push({
          name: dep.name,
          requiredVersion: dep.version || '*',
          installed: false,
          valid: false,
          error: 'Dependency not installed'
        });
        continue;
      }

      const versionCheck = this.validateVersion(depPlugin.version, dep.version);
      results.push({
        name: dep.name,
        requiredVersion: dep.version || '*',
        installedVersion: depPlugin.version,
        installed: true,
        valid: versionCheck.valid,
        message: versionCheck.message
      });
    }

    const allValid = results.every(r => r.valid);

    return {
      valid: allValid,
      dependencies: results,
      summary: allValid 
        ? 'All dependencies are satisfied'
        : 'Some dependencies are missing or have incompatible versions'
    };
  }

  validatePermissions(manifest, allowedPermissions = ['read:local']) {
    const requestedPermissions = manifest.permissions || [];
    const forbiddenPermissions = requestedPermissions.filter(
      p => !allowedPermissions.includes(p)
    );

    return {
      allowed: forbiddenPermissions.length === 0,
      requested: requestedPermissions,
      forbidden: forbiddenPermissions,
      summary: forbiddenPermissions.length === 0
        ? 'All requested permissions are allowed'
        : `Forbidden permissions requested: ${forbiddenPermissions.join(', ')}`
    };
  }

  validateWasmFile(wasmPath) {
    if (!fs.existsSync(wasmPath)) {
      return {
        valid: false,
        error: 'WASM file not found',
        path: wasmPath
      };
    }

    try {
      const stats = fs.statSync(wasmPath);
      const fileSize = stats.size;

      const wasmHeader = Buffer.from([0x00, 0x61, 0x73, 0x6D]);
      const fd = fs.openSync(wasmPath, 'r');
      const header = Buffer.alloc(4);
      fs.readSync(fd, header, 0, 4, 0);
      fs.closeSync(fd);

      const isWasm = header.equals(wasmHeader);

      return {
        valid: isWasm,
        fileSize,
        isWasm,
        error: isWasm ? null : 'File is not a valid WASM module (invalid magic number)'
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Failed to validate WASM file',
        details: error.message
      };
    }
  }

  fullValidation(manifestPath, wasmPath, installedPlugins = [], allowedPermissions = ['read:local']) {
    const results = {
      steps: [],
      overall: {
        valid: true,
        errors: []
      }
    };

    const manifestResult = this.loadManifest(manifestPath);
    results.steps.push({
      name: 'manifest_load',
      ...manifestResult
    });

    if (!manifestResult.success) {
      results.overall.valid = false;
      results.overall.errors.push('Manifest validation failed');
      return results;
    }

    const manifest = manifestResult.manifest;

    const wasmValidation = this.validateWasmFile(wasmPath);
    results.steps.push({
      name: 'wasm_validation',
      ...wasmValidation
    });

    if (!wasmValidation.valid) {
      results.overall.valid = false;
      results.overall.errors.push('WASM file validation failed');
    }

    const permissionsValidation = this.validatePermissions(manifest, allowedPermissions);
    results.steps.push({
      name: 'permissions_validation',
      ...permissionsValidation
    });

    if (!permissionsValidation.allowed) {
      results.overall.valid = false;
      results.overall.errors.push('Permission validation failed - forbidden permissions requested');
    }

    const dependenciesValidation = this.validateDependencies(manifest, installedPlugins);
    results.steps.push({
      name: 'dependencies_validation',
      ...dependenciesValidation
    });

    if (!dependenciesValidation.valid) {
      results.overall.valid = false;
      results.overall.errors.push('Dependency validation failed');
    }

    const entryPointCheck = manifest.entrypoint && 
      (manifest.entrypoint === 'main' || manifest.entrypoint === 'run' || manifest.entrypoint === 'process');
    results.steps.push({
      name: 'entrypoint_validation',
      valid: entryPointCheck,
      entrypoint: manifest.entrypoint,
      error: entryPointCheck ? null : `Unsupported entrypoint: ${manifest.entrypoint}. Expected: main, run, or process`
    });

    if (!entryPointCheck) {
      results.overall.valid = false;
      results.overall.errors.push('Entrypoint validation failed');
    }

    results.overall.summary = results.overall.valid
      ? 'All validation checks passed'
      : `Validation failed with ${results.overall.errors.length} error(s)`;

    return results;
  }

  extractErrorCodes(manifest) {
    if (!manifest.error_codes || !Array.isArray(manifest.error_codes)) {
      return {
        valid: true,
        errorCodes: [],
        warning: 'No error codes defined in manifest'
      };
    }

    const errorCodes = manifest.error_codes;
    const invalidCodes = errorCodes.filter(code => 
      !code.code || typeof code.code !== 'string' && typeof code.code !== 'number'
    );

    if (invalidCodes.length > 0) {
      return {
        valid: false,
        errorCodes,
        invalid: invalidCodes,
        error: 'Some error codes are missing required "code" field'
      };
    }

    return {
      valid: true,
      errorCodes,
      count: errorCodes.length
    };
  }

  savePluginFiles(manifestContent, wasmBuffer, pluginName, version) {
    const pluginDir = path.join(pluginsDir, `${pluginName}-${version}`);
    
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    const manifestPath = path.join(pluginDir, 'manifest.json');
    const wasmPath = path.join(pluginDir, 'plugin.wasm');

    fs.writeFileSync(manifestPath, typeof manifestContent === 'string' ? manifestContent : JSON.stringify(manifestContent, null, 2));
    fs.writeFileSync(wasmPath, wasmBuffer);

    return {
      pluginDir,
      manifestPath,
      wasmPath
    };
  }
}

module.exports = new PluginLoader();
