const pluginLoader = require('../src/services/pluginLoader');
const path = require('path');
const fs = require('fs');

describe('PluginLoader', () => {
  describe('validateVersion', () => {
    test('should validate version against semver constraint', () => {
      const result = pluginLoader.validateVersion('1.2.3', '^1.0.0');
      expect(result.valid).toBe(true);
    });

    test('should reject incompatible version', () => {
      const result = pluginLoader.validateVersion('2.0.0', '^1.0.0');
      expect(result.valid).toBe(false);
    });

    test('should validate with wildcard constraint', () => {
      const result = pluginLoader.validateVersion('1.2.3', '*');
      expect(result.valid).toBe(true);
    });

    test('should return valid when no constraint specified', () => {
      const result = pluginLoader.validateVersion('1.2.3', null);
      expect(result.valid).toBe(true);
    });

    test('should handle invalid version gracefully', () => {
      const result = pluginLoader.validateVersion('invalid-version', '^1.0.0');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateDependencies', () => {
    test('should validate dependencies with satisfied versions', () => {
      const manifest = {
        dependencies: [
          { name: 'helper-utils', version: '^1.0.0' },
          { name: 'math-lib', version: '>=2.0.0' }
        ]
      };

      const installedPlugins = [
        { name: 'helper-utils', version: '1.5.0' },
        { name: 'math-lib', version: '2.1.0' }
      ];

      const result = pluginLoader.validateDependencies(manifest, installedPlugins);
      expect(result.valid).toBe(true);
    });

    test('should detect missing dependency', () => {
      const manifest = {
        dependencies: [
          { name: 'missing-plugin', version: '^1.0.0' }
        ]
      };

      const result = pluginLoader.validateDependencies(manifest, []);
      expect(result.valid).toBe(false);
      expect(result.dependencies[0].installed).toBe(false);
    });

    test('should detect version incompatibility', () => {
      const manifest = {
        dependencies: [
          { name: 'helper-utils', version: '^2.0.0' }
        ]
      };

      const installedPlugins = [
        { name: 'helper-utils', version: '1.5.0' }
      ];

      const result = pluginLoader.validateDependencies(manifest, installedPlugins);
      expect(result.valid).toBe(false);
    });

    test('should return valid when no dependencies', () => {
      const manifest = {};
      const result = pluginLoader.validateDependencies(manifest, []);
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePermissions', () => {
    test('should allow valid permissions', () => {
      const manifest = {
        permissions: ['read:local']
      };

      const result = pluginLoader.validatePermissions(manifest, ['read:local']);
      expect(result.allowed).toBe(true);
    });

    test('should detect forbidden permissions', () => {
      const manifest = {
        permissions: ['read:local', 'network:outbound', 'write:local']
      };

      const result = pluginLoader.validatePermissions(manifest, ['read:local']);
      expect(result.allowed).toBe(false);
      expect(result.forbidden).toContain('network:outbound');
      expect(result.forbidden).toContain('write:local');
    });

    test('should return allowed when no permissions requested', () => {
      const manifest = {};
      const result = pluginLoader.validatePermissions(manifest, ['read:local']);
      expect(result.allowed).toBe(true);
    });
  });

  describe('extractErrorCodes', () => {
    test('should extract valid error codes', () => {
      const manifest = {
        error_codes: [
          { code: 'E001', description: 'Invalid input format' },
          { code: 'E002', description: 'Processing timeout' },
          { code: 'E003', description: 'Quality threshold not met' }
        ]
      };

      const result = pluginLoader.extractErrorCodes(manifest);
      expect(result.valid).toBe(true);
      expect(result.count).toBe(3);
      expect(result.errorCodes).toHaveLength(3);
    });

    test('should reject error codes without code field', () => {
      const manifest = {
        error_codes: [
          { code: 'E001', description: 'Valid error' },
          { description: 'Missing code field' }
        ]
      };

      const result = pluginLoader.extractErrorCodes(manifest);
      expect(result.valid).toBe(false);
    });

    test('should handle no error codes', () => {
      const manifest = {};
      const result = pluginLoader.extractErrorCodes(manifest);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
    });
  });

  describe('loadManifest (basic validation)', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should load and validate a valid manifest file', () => {
      const manifest = {
        name: 'quality-inspection-rule',
        version: '1.0.0',
        entrypoint: 'process',
        vendor: 'QualityTech Inc.',
        description: 'Automated quality inspection rule for assembly line products',
        permissions: ['read:local'],
        error_codes: [
          { code: 'Q001', description: 'Dimension out of tolerance' },
          { code: 'Q002', description: 'Surface defect detected' }
        ]
      };

      const manifestPath = path.join(tempDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = pluginLoader.loadManifest(manifestPath);
      expect(result.success).toBe(true);
      expect(result.name).toBe('quality-inspection-rule');
      expect(result.version).toBe('1.0.0');
    });

    test('should reject invalid manifest file', () => {
      const invalidManifest = {
        name: 'missing-version'
      };

      const manifestPath = path.join(tempDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(invalidManifest));

      const result = pluginLoader.loadManifest(manifestPath);
      expect(result.success).toBe(false);
    });

    test('should reject invalid JSON file', () => {
      const manifestPath = path.join(tempDir, 'manifest.json');
      fs.writeFileSync(manifestPath, 'not valid json {{{');

      const result = pluginLoader.loadManifest(manifestPath);
      expect(result.success).toBe(false);
    });
  });
});
