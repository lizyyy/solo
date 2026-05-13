const fs = require('fs');
const path = require('path');
const BaseChecker = require('./base-checker');

class PackageChecker extends BaseChecker {
  constructor(template, projectPath, templateLoader) {
    super(template, projectPath);
    this.templateLoader = templateLoader;
  }

  check() {
    const issues = [];
    const packageJsonPath = path.join(this.projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      issues.push(this.createIssue(
        'required-files',
        'package.json 不存在',
        { missingFile: 'package.json' }
      ));
      return issues;
    }

    let packageJson;
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    } catch (e) {
      issues.push(this.createIssue(
        'package-scripts',
        'package.json 格式无效',
        { parseError: e.message }
      ));
      return issues;
    }

    issues.push(...this.checkTemplateVersion(packageJson));
    issues.push(...this.checkScripts(packageJson));
    issues.push(...this.checkNodeVersion(packageJson));
    issues.push(...this.checkDependencies(packageJson));

    return issues;
  }

  checkTemplateVersion(packageJson) {
    const issues = [];
    const projectTemplateInfo = this.templateLoader.getProjectTemplateVersion(this.projectPath);
    const latestTemplate = this.templateLoader.getLatestTemplate('standard');

    if (!projectTemplateInfo) {
      issues.push(this.createIssue(
        'template-version',
        '项目未声明模板版本，请在 package.json 的 scaffold 字段中声明',
        {
          current: null,
          expected: `${latestTemplate.name}@${latestTemplate.version}`,
          expectedVersion: latestTemplate.version
        }
      ));
    } else if (projectTemplateInfo.version !== latestTemplate.version) {
      issues.push(this.createIssue(
        'template-version',
        `模板版本过旧，当前版本 ${projectTemplateInfo.version}，最新版本 ${latestTemplate.version}`,
        {
          current: projectTemplateInfo.version,
          expected: latestTemplate.version,
          currentPath: projectTemplateInfo.templatePath,
          expectedPath: 'standard'
        }
      ));
    }

    return issues;
  }

  checkScripts(packageJson) {
    const issues = [];
    const templateScripts = this.template.packageJson?.scripts || {};
    const projectScripts = packageJson.scripts || {};

    for (const [scriptName, templateScript] of Object.entries(templateScripts)) {
      if (!(scriptName in projectScripts)) {
        issues.push(this.createIssue(
          'package-scripts',
          `缺少必需脚本: ${scriptName}`,
          {
            mismatchedScript: scriptName,
            expected: templateScript,
            actual: null
          }
        ));
      } else if (projectScripts[scriptName] !== templateScript) {
        issues.push(this.createIssue(
          'package-scripts',
          `脚本 ${scriptName} 配置不一致`,
          {
            mismatchedScript: scriptName,
            expected: templateScript,
            actual: projectScripts[scriptName]
          }
        ));
      }
    }

    return issues;
  }

  checkNodeVersion(packageJson) {
    const issues = [];
    const templateEngines = this.template.packageJson?.engines || {};
    const projectEngines = packageJson.engines || {};

    if (!projectEngines.node) {
      issues.push(this.createIssue(
        'node-version',
        'package.json 中未声明 Node.js 版本要求',
        {
          expected: templateEngines.node || '>=18.0.0',
          actual: null
        }
      ));
    } else if (projectEngines.node !== templateEngines.node) {
      issues.push(this.createIssue(
        'node-version',
        `Node.js 版本要求不一致，当前 ${projectEngines.node}，期望 ${templateEngines.node}`,
        {
          expected: templateEngines.node,
          actual: projectEngines.node
        }
      ));
    }

    return issues;
  }

  checkDependencies(packageJson) {
    const issues = [];
    const semver = require('semver');
    const templateDeps = {
      ...this.template.packageJson?.dependencies,
      ...this.template.packageJson?.devDependencies
    };

    const projectDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    const templateDepList = Object.keys(templateDeps);
    for (const dep of templateDepList) {
      if (!(dep in projectDeps)) {
        issues.push(this.createIssue(
          'dependency-version',
          `缺少标准依赖: ${dep}`,
          {
            dependency: dep,
            expected: templateDeps[dep],
            actual: null,
            type: 'missing'
          }
        ));
      } else {
        const templateRange = templateDeps[dep];
        const projectRange = projectDeps[dep];

        try {
          const templateMin = semver.minVersion(templateRange);
          const projectMin = semver.minVersion(projectRange);

          if (templateMin && projectMin && semver.lt(projectMin, templateMin)) {
            issues.push(this.createIssue(
              'dependency-version',
              `依赖 ${dep} 版本过旧，当前最低 ${projectMin.version}，期望最低 ${templateMin.version}`,
              {
                dependency: dep,
                expected: templateDeps[dep],
                actual: projectDeps[dep],
                expectedMin: templateMin.version,
                actualMin: projectMin.version,
                type: 'outdated'
              }
            ));
          }
        } catch (e) {
          issues.push(this.createIssue(
            'dependency-version',
            `依赖 ${dep} 版本号无法解析比较`,
            {
              dependency: dep,
              expected: templateDeps[dep],
              actual: projectDeps[dep],
              type: 'unparsable'
            }
          ));
        }
      }
    }

    return issues;
  }
}

module.exports = PackageChecker;
