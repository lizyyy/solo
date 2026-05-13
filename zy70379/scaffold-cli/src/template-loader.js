const fs = require('fs');
const path = require('path');
const semver = require('semver');
const config = require('./config');

class TemplateLoader {
  constructor(templateDir) {
    this.templateDir = path.resolve(templateDir);
  }

  loadTemplate(templatePath) {
    const templateFile = path.join(this.templateDir, templatePath, 'template.json');
    if (!fs.existsSync(templateFile)) {
      throw new Error(`模板文件不存在: ${templateFile}`);
    }
    const content = fs.readFileSync(templateFile, 'utf-8');
    return JSON.parse(content);
  }

  getLatestTemplate(templateType = 'standard') {
    const typeDir = path.join(this.templateDir, templateType);
    if (!fs.existsSync(typeDir)) {
      throw new Error(`模板类型目录不存在: ${typeDir}`);
    }

    const versions = fs.readdirSync(typeDir).filter(dir => {
      const fullPath = path.join(typeDir, dir);
      return fs.statSync(fullPath).isDirectory() && semver.valid(dir);
    });

    if (versions.length === 0) {
      throw new Error(`未找到有效的模板版本: ${templateType}`);
    }

    const latestVersion = versions.sort(semver.rcompare)[0];
    return this.loadTemplate(path.join(templateType, latestVersion));
  }

  getAllTemplates() {
    const templates = [];
    if (!fs.existsSync(this.templateDir)) {
      return templates;
    }

    const types = fs.readdirSync(this.templateDir);
    for (const type of types) {
      const typeDir = path.join(this.templateDir, type);
      if (!fs.statSync(typeDir).isDirectory()) continue;

      const versions = fs.readdirSync(typeDir).filter(dir => {
        const fullPath = path.join(typeDir, dir);
        return fs.statSync(fullPath).isDirectory() && semver.valid(dir);
      });

      for (const version of versions) {
        try {
          templates.push({
            path: path.join(type, version),
            ...this.loadTemplate(path.join(type, version))
          });
        } catch (e) {
          // 跳过无效模板
        }
      }
    }

    return templates.sort((a, b) => {
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      return semver.rcompare(a.version, b.version);
    });
  }

  getProjectTemplateVersion(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.scaffold) {
        return {
          version: packageJson.scaffold.templateVersion,
          templatePath: packageJson.scaffold.templatePath || 'standard'
        };
      }
    } catch (e) {
      // 解析失败，返回 null
    }

    return null;
  }

  loadProjectTemplate(projectPath) {
    const templateInfo = this.getProjectTemplateVersion(projectPath);
    if (!templateInfo) {
      return this.getLatestTemplate('standard');
    }

    try {
      return this.loadTemplate(path.join(templateInfo.templatePath, templateInfo.version));
    } catch (e) {
      return this.getLatestTemplate('standard');
    }
  }
}

module.exports = TemplateLoader;
