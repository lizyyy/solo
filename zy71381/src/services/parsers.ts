import type { ParserResult, ParseError, Dependency, DirtyType } from '../types';

interface IParser {
  supports(fileName: string): boolean;
  parse(content: string): ParserResult;
}

function detectFileType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('package.json')) return 'npm';
  if (lower.endsWith('.json') && lower.includes('package')) return 'npm';
  if (lower.endsWith('pom.xml')) return 'maven';
  if (lower.endsWith('.xml') && lower.includes('pom')) return 'maven';
  if (lower.includes('requirements.txt')) return 'pip';
  if (lower.endsWith('.txt') && lower.includes('requirement')) return 'pip';
  if (lower.endsWith('go.mod')) return 'gomod';
  if (lower.endsWith('.mod') && lower.includes('go')) return 'gomod';
  return 'other';
}

export function getParserForFile(fileName: string): IParser | null {
  const type = detectFileType(fileName);
  switch (type) {
    case 'npm':
      return new PackageJsonParser();
    case 'maven':
      return new PomXmlParser();
    case 'pip':
      return new RequirementsTxtParser();
    case 'gomod':
      return new GoModParser();
    default:
      return null;
  }
}

function createError(type: DirtyType, message: string, packageName?: string, line?: number): ParseError {
  return { type, message, packageName, line };
}

export class PackageJsonParser implements IParser {
  supports(fileName: string): boolean {
    return detectFileType(fileName) === 'npm';
  }

  parse(content: string): ParserResult {
    const dependencies: ParserResult['dependencies'] = [];
    const errors: ParseError[] = [];

    try {
      const pkg = JSON.parse(content);

      const processDeps = (
        deps: Record<string, string> | undefined,
        isDirect: boolean,
        depth: number
      ) => {
        if (!deps) return;

        for (const [name, version] of Object.entries(deps)) {
          if (!name || !version) {
            errors.push(createError('format_error', `依赖项格式错误: ${name}@${version}`, name));
            continue;
          }

          const license = pkg.license || '';
          const repoUrl = pkg.repository?.url || pkg.repository || '';
          const homepage = pkg.homepage || '';

          if (!license) {
            errors.push(
              createError('license_missing', `许可证缺失: ${name}`, name)
            );
          }

          dependencies.push({
            packageName: name,
            packageVersion: version.replace(/^[\^~>=<]+/, ''),
            license: license || '',
            licenseMatched: !!license,
            repoUrl: repoUrl,
            homepage,
            isDirect,
            depth,
            transitiveDependencies: [],
          });
        }
      };

      processDeps(pkg.dependencies, true, 0);
      processDeps(pkg.devDependencies, true, 0);
      processDeps(pkg.peerDependencies, true, 0);
      processDeps(pkg.optionalDependencies, true, 0);
    } catch (e) {
      errors.push(
        createError('format_error', `JSON解析失败: ${(e as Error).message}`)
      );
    }

    return { dependencies, errors };
  }
}

export class PomXmlParser implements IParser {
  supports(fileName: string): boolean {
    return detectFileType(fileName) === 'maven';
  }

  parse(content: string): ParserResult {
    const dependencies: ParserResult['dependencies'] = [];
    const errors: ParseError[] = [];

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');

      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        errors.push(createError('format_error', 'XML解析失败'));
        return { dependencies, errors };
      }

      const depNodes = xmlDoc.querySelectorAll('dependency');

      depNodes.forEach((depNode, index) => {
        const groupId = depNode.querySelector('groupId')?.textContent?.trim() || '';
        const artifactId = depNode.querySelector('artifactId')?.textContent?.trim() || '';
        const version = depNode.querySelector('version')?.textContent?.trim() || '';
        const scope = depNode.querySelector('scope')?.textContent?.trim() || 'compile';

        if (!artifactId || !version) {
          errors.push(
            createError(
              'format_error',
              `Maven依赖格式错误: ${groupId}:${artifactId}`,
              artifactId || groupId,
              index
            )
          );
          return;
        }

        const packageName = groupId ? `${groupId}:${artifactId}` : artifactId;

        dependencies.push({
          packageName,
          packageVersion: version,
          license: '',
          licenseMatched: false,
          repoUrl: '',
          homepage: '',
          isDirect: scope !== 'test',
          depth: 0,
          transitiveDependencies: [],
        });

        errors.push(
          createError('license_missing', `需要人工确认许可证: ${packageName}`, packageName)
        );
      });
    } catch (e) {
      errors.push(
        createError('format_error', `XML解析失败: ${(e as Error).message}`)
      );
    }

    return { dependencies, errors };
  }
}

export class RequirementsTxtParser implements IParser {
  supports(fileName: string): boolean {
    return detectFileType(fileName) === 'pip';
  }

  parse(content: string): ParserResult {
    const dependencies: ParserResult['dependencies'] = [];
    const errors: ParseError[] = [];

    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
        return;
      }

      const versionMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*[=<>!~]+\s*([a-zA-Z0-9._-]+)/);
      const exactMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*==\s*([a-zA-Z0-9._-]+)/);
      const nameOnlyMatch = trimmed.match(/^([a-zA-Z0-9_-]+)$/);

      let name = '';
      let version = '';

      if (exactMatch) {
        name = exactMatch[1];
        version = exactMatch[2];
      } else if (versionMatch) {
        name = versionMatch[1];
        version = versionMatch[2];
      } else if (nameOnlyMatch) {
        name = nameOnlyMatch[1];
        version = 'latest';
        errors.push(
          createError('version_conflict', `未指定版本: ${name}`, name, index)
        );
      } else {
        errors.push(
          createError('format_error', `无法解析的行: ${trimmed}`, undefined, index)
        );
        return;
      }

      if (name) {
        dependencies.push({
          packageName: name,
          packageVersion: version,
          license: '',
          licenseMatched: false,
          repoUrl: '',
          homepage: '',
          isDirect: true,
          depth: 0,
          transitiveDependencies: [],
        });

        errors.push(
          createError('license_missing', `需要人工确认许可证: ${name}`, name)
        );
      }
    });

    return { dependencies, errors };
  }
}

export class GoModParser implements IParser {
  supports(fileName: string): boolean {
    return detectFileType(fileName) === 'gomod';
  }

  parse(content: string): ParserResult {
    const dependencies: ParserResult['dependencies'] = [];
    const errors: ParseError[] = [];

    const lines = content.split('\n');
    let inRequireBlock = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed === 'require (' || trimmed.startsWith('require (')) {
        inRequireBlock = true;
        return;
      }

      if (trimmed === ')') {
        inRequireBlock = false;
        return;
      }

      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('module') || trimmed.startsWith('go ')) {
        return;
      }

      let requireLine = trimmed;
      if (trimmed.startsWith('require ')) {
        requireLine = trimmed.substring(8).trim();
      }

      if (inRequireBlock || trimmed.startsWith('require ')) {
        const parts = requireLine.split(/\s+/);

        if (parts.length >= 2) {
          const name = parts[0];
          const version = parts[1].replace(/^v/, '');
          const isIndirect = parts.includes('//') && parts.includes('indirect');

          dependencies.push({
            packageName: name,
            packageVersion: version,
            license: '',
            licenseMatched: false,
            repoUrl: name.startsWith('github.com') ? `https://${name}` : '',
            homepage: '',
            isDirect: !isIndirect,
            depth: isIndirect ? 1 : 0,
            transitiveDependencies: [],
          });

          errors.push(
            createError('license_missing', `需要人工确认许可证: ${name}`, name)
          );
        } else if (parts.length === 1 && parts[0]) {
          errors.push(
            createError(
              'transitive_missing',
              `依赖信息不完整: ${parts[0]}`,
              parts[0],
              index
            )
          );
        }
      }
    });

    return { dependencies, errors };
  }
}

export function parseDependencyFile(
  fileName: string,
  content: string
): ParserResult {
  const parser = getParserForFile(fileName);
  if (parser) {
    return parser.parse(content);
  }

  const errors: ParseError[] = [
    createError('format_error', `不支持的文件格式: ${fileName}`),
  ];

  return { dependencies: [], errors };
}
