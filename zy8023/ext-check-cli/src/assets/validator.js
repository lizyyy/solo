const fs = require('fs');
const path = require('path');

class AssetValidator {
  constructor(extDir) {
    this.extDir = extDir;
    this.manifestData = null;
  }

  validate(manifestData) {
    this.manifestData = manifestData;
    const findings = [];

    findings.push(...this.checkIcons());
    findings.push(...this.checkVersion());
    findings.push(...this.checkPrivacyPolicy());
    findings.push(...this.checkDefaultLocale());

    return findings;
  }

  checkIcons() {
    const findings = [];
    const manifest = this.manifestData.manifest;

    const requiredSizes = [128];
    if (manifest.manifest_version === 3) {
      requiredSizes.push(48, 16);
    }

    for (const size of requiredSizes) {
      const iconPath = path.join(this.extDir, 'icons', `${size}.png`);
      if (!fs.existsSync(iconPath)) {
        findings.push({
          type: 'missing_icon',
          severity: size === 128 ? 'error' : 'warning',
          message: `Missing required icon: icons/${size}.png`,
          location: 'icons/' + size + '.png',
          suggestion: `Add icons/${size}.png to your extension.`
        });
      }
    }

    if (manifest.icons) {
      for (const [size, iconFile] of Object.entries(manifest.icons)) {
        const fullPath = path.join(this.extDir, iconFile);
        if (!fs.existsSync(fullPath)) {
          findings.push({
            type: 'missing_icon',
            severity: 'error',
            message: `Icon defined in manifest but not found: ${iconFile}`,
            location: `manifest.icons.${size}`,
            suggestion: `Add ${iconFile} or update manifest icons.`
          });
        }
      }
    }

    return findings;
  }

  checkVersion() {
    const findings = [];
    const version = this.manifestData.version;

    if (!version) {
      findings.push({
        type: 'missing_version',
        severity: 'error',
        message: 'Extension version is missing',
        location: 'manifest.version',
        suggestion: 'Add a version string to manifest.json.'
      });
      return findings;
    }

    const semverRegex = /^\d+\.\d+\.\d+$/;
    const versionOnlyNumberRegex = /^\d+$/;

    if (!semverRegex.test(version) && !versionOnlyNumberRegex.test(version)) {
      findings.push({
        type: 'invalid_version',
        severity: 'warning',
        message: `Version "${version}" does not follow semantic versioning (x.y.z)`,
        location: 'manifest.version',
        suggestion: 'Use format like "1.0.0" or just "1".'
      });
    }

    if (version === '0.0.0' || version === '0.0.0.0') {
      findings.push({
        type: 'invalid_version',
        severity: 'error',
        message: `Version "${version}" appears to be a placeholder`,
        location: 'manifest.version',
        suggestion: 'Set a proper version number before publishing.'
      });
    }

    return findings;
  }

  checkPrivacyPolicy() {
    const findings = [];
    const manifest = this.manifestData.manifest;

    const privacyFiles = [
      'PRIVACY.md',
      'PRIVACY.txt',
      'privacy_policy.md',
      'privacy_policy.txt',
      'privacy.md',
      ' PRIVACY.html',
      'privacy.html'
    ];

    const hasPrivacyFile = privacyFiles.some(f =>
      fs.existsSync(path.join(this.extDir, f))
    );

    if (!hasPrivacyFile) {
      findings.push({
        type: 'missing_privacy_policy',
        severity: manifest.manifest_version === 3 ? 'error' : 'warning',
        message: 'No privacy policy file found',
        location: 'PRIVACY.md or similar',
        suggestion: 'Add a PRIVACY.md file to the extension root directory.'
      });
    }

    if (manifest.permissions?.includes('privacy') && !hasPrivacyFile) {
      findings.push({
        type: 'missing_privacy_policy',
        severity: 'warning',
        message: 'Extension requests "privacy" permission but has no privacy policy',
        location: 'manifest.permissions + PRIVACY.md',
        suggestion: 'Add a PRIVACY.md file explaining how user data is handled.'
      });
    }

    return findings;
  }

  checkDefaultLocale() {
    const findings = [];
    const manifest = this.manifestData.manifest;

    const localesDir = path.join(this.extDir, '_locales');
    if (!fs.existsSync(localesDir)) {
      if (manifest.default_locale) {
        findings.push({
          type: 'invalid_default_locale',
          severity: 'error',
          message: `default_locale "${manifest.default_locale}" is set but _locales directory is missing`,
          location: 'manifest.default_locale',
          suggestion: 'Create _locales directory with default locale messages.'
        });
      }
      return findings;
    }

    if (manifest.default_locale) {
      const defaultLocaleDir = path.join(localesDir, manifest.default_locale);
      if (!fs.existsSync(defaultLocaleDir)) {
        findings.push({
          type: 'missing_default_locale_messages',
          severity: 'error',
          message: `Default locale directory missing: _locales/${manifest.default_locale}/`,
          location: `manifest.default_locale`,
          suggestion: `Create _locales/${manifest.default_locale}/messages.json with required keys.`
        });
        return findings;
      }

      const messagesFile = path.join(defaultLocaleDir, 'messages.json');
      if (!fs.existsSync(messagesFile)) {
        findings.push({
          type: 'missing_default_locale_messages',
          severity: 'error',
          message: `messages.json missing for default locale: _locales/${manifest.default_locale}/messages.json`,
          location: `_locales/${manifest.default_locale}/messages.json`,
          suggestion: `Create _locales/${manifest.default_locale}/messages.json with required keys.`
        });
        return findings;
      }

      const messagesContent = fs.readFileSync(messagesFile, 'utf-8');
      const messages = JSON.parse(messagesContent);

      const requiredKeys = ['name', 'description'];
      for (const key of requiredKeys) {
        if (!messages[key]) {
          findings.push({
            type: 'missing_locale_key',
            severity: 'error',
            message: `Required locale key "${key}" missing in messages.json`,
            location: `_locales/${manifest.default_locale}/messages.json`,
            suggestion: `Add "${key}" to messages.json: { "${key}": { "message": "...", "description": "..." } }`
          });
        }
      }
    } else {
      const localeDirs = fs.readdirSync(localesDir).filter(f =>
        fs.statSync(path.join(localesDir, f)).isDirectory()
      );

      if (localeDirs.length > 0) {
        findings.push({
          type: 'missing_default_locale',
          severity: 'warning',
          message: 'Extension has _locales directory but no default_locale specified',
          location: 'manifest',
          suggestion: 'Add "default_locale" field to manifest.json pointing to one of the locale directories.'
        });
      }
    }

    return findings;
  }
}

module.exports = AssetValidator;
