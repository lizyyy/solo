import Dexie, { Table } from 'dexie';
import type {
  Project,
  DependencyFile,
  Dependency,
  LicenseDefinition,
  Waiver,
  ComplianceReport,
  ReportEntry,
  ExportRecord,
  StatusLog,
  AuditLog,
} from '../types';

export class LicenseWallDB extends Dexie {
  projects!: Table<Project, string>;
  dependencyFiles!: Table<DependencyFile, string>;
  dependencies!: Table<Dependency, string>;
  licenses!: Table<LicenseDefinition, string>;
  licenseDefinitions!: Table<LicenseDefinition, string>;
  waivers!: Table<Waiver, string>;
  reports!: Table<ComplianceReport, string>;
  reportEntries!: Table<ReportEntry, string>;
  exports!: Table<ExportRecord, string>;
  statusLogs!: Table<StatusLog, string>;
  auditLogs!: Table<AuditLog, string>;

  constructor() {
    super('LicenseWallDB');

    this.version(1).stores({
      projects: '&id, name, createdAt, updatedAt',
      dependencyFiles: '&id, projectId, fileName, uploadTime, parseStatus',
      dependencies:
        '&id, projectId, fileId, parentId, packageName, status, riskLevel, isDirect, depth, updatedAt',
      licenses: '&id, &spdxId, shortName, riskLevel, isCopyleft',
      licenseDefinitions: '&id, &spdxId, shortName, riskLevel, isCopyleft',
      waivers: '&id, dependencyId, projectId, status, expiryDate, createdAt',
      reports: '&id, projectId, reportVersion, generatedAt, status, exportHash',
      reportEntries: '&id, reportId, dependencyId, riskLevel',
      exports: '&id, reportId, exportedAt, exportHash, format',
      statusLogs: '&id, dependencyId, timestamp',
      auditLogs: '&id, action, timestamp, operator',
    });
  }
}

export const db = new LicenseWallDB();

export async function initDatabase() {
  const existingLicenses = await db.licenses.count();
  if (existingLicenses === 0) {
    await seedLicenseDefinitions();
  }
  const existingLicenseDefs = await db.licenseDefinitions.count();
  if (existingLicenseDefs === 0) {
    await seedLicenseDefinitionsToLicenseDefs();
  }
}

async function seedLicenseDefinitionsToLicenseDefs() {
  const licenses = await db.licenses.toArray();
  await db.licenseDefinitions.bulkAdd(licenses);
}

export async function seedLicenseDefinitions() {
  const licenses: LicenseDefinition[] = [
    {
      id: 'license-mit',
      spdxId: 'MIT',
      fullName: 'MIT License',
      shortName: 'MIT',
      name: 'MIT License',
      category: 'permissive',
      riskLevel: 'safe',
      description:
        'MIT许可证是一种宽松的开源软件许可证，允许在许可范围内自由使用、复制、修改、合并、发布、分发、再授权和/或销售软件。',
      obligations: ['保留版权声明', '保留许可声明'],
      conditions: ['保留版权声明', '保留许可声明'],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-apache-2.0',
      spdxId: 'Apache-2.0',
      fullName: 'Apache License 2.0',
      shortName: 'Apache-2.0',
      name: 'Apache License 2.0',
      category: 'permissive',
      riskLevel: 'safe',
      description:
        'Apache许可证2.0是由Apache软件基金会发布的宽松开源软件许可证，明确规定了专利权的授予。',
      obligations: ['保留版权声明', '状态变更说明', 'NOTICE文件'],
      conditions: ['保留版权声明', '状态变更说明', 'NOTICE文件'],
      permissions: ['商业使用', '修改', '分发', '专利使用', '私有使用'],
      restrictions: ['商标使用', '承担风险'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-bsd-3-clause',
      spdxId: 'BSD-3-Clause',
      fullName: 'BSD 3-Clause "New" or "Revised" License',
      shortName: 'BSD-3-Clause',
      name: 'BSD 3-Clause License',
      category: 'permissive',
      riskLevel: 'safe',
      description:
        'BSD 3条款许可证是一种宽松的开源软件许可证，禁止使用版权持有者的名字为衍生作品背书。',
      obligations: ['保留版权声明', '保留免责声明'],
      conditions: ['保留版权声明', '保留免责声明'],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险', '禁止背书'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-bsd-2-clause',
      spdxId: 'BSD-2-Clause',
      fullName: 'BSD 2-Clause "Simplified" License',
      shortName: 'BSD-2-Clause',
      name: 'BSD 2-Clause License',
      category: 'permissive',
      riskLevel: 'safe',
      description: 'BSD 2条款许可证是一种宽松的开源软件许可证。',
      obligations: ['保留版权声明', '保留免责声明'],
      conditions: ['保留版权声明', '保留免责声明'],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-gpl-3.0',
      spdxId: 'GPL-3.0-only',
      fullName: 'GNU General Public License v3.0 only',
      shortName: 'GPL-3.0',
      name: 'GNU GPL v3.0',
      category: 'copyleft',
      riskLevel: 'critical',
      description:
        'GNU通用公共许可证v3.0是一种强Copyleft许可证，要求衍生作品也以相同许可证发布。',
      obligations: ['公开源代码', '许可证声明', '状态变更说明', '相同许可证'],
      conditions: ['公开源代码', '许可证声明', '状态变更说明', '相同许可证'],
      permissions: ['商业使用', '修改', '分发', '专利使用', '私有使用'],
      restrictions: ['承担风险', '封闭源代码'],
      forbidden: ['封闭源代码分发'],
      isCopyleft: true,
      copyleftStrength: 'strong',
    },
    {
      id: 'license-gpl-2.0',
      spdxId: 'GPL-2.0-only',
      fullName: 'GNU General Public License v2.0 only',
      shortName: 'GPL-2.0',
      name: 'GNU GPL v2.0',
      category: 'copyleft',
      riskLevel: 'critical',
      description:
        'GNU通用公共许可证v2.0是一种强Copyleft许可证，要求衍生作品也以相同许可证发布。',
      obligations: ['公开源代码', '许可证声明', '状态变更说明', '相同许可证'],
      conditions: ['公开源代码', '许可证声明', '状态变更说明', '相同许可证'],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险', '封闭源代码'],
      forbidden: ['封闭源代码分发'],
      isCopyleft: true,
      copyleftStrength: 'strong',
    },
    {
      id: 'license-agpl-3.0',
      spdxId: 'AGPL-3.0-only',
      fullName: 'GNU Affero General Public License v3.0 only',
      shortName: 'AGPL-3.0',
      name: 'GNU AGPL v3.0',
      category: 'agpl',
      riskLevel: 'critical',
      description:
        'GNU Affero通用公共许可证v3.0是GPLv3的变种，适用于通过网络提供服务的软件，要求即使不分发软件，网络服务的用户也有权获取源代码。',
      obligations: [
        '公开源代码',
        '许可证声明',
        '状态变更说明',
        '相同许可证',
        '网络使用时公开源代码',
      ],
      conditions: [
        '公开源代码',
        '许可证声明',
        '状态变更说明',
        '相同许可证',
        '网络使用时公开源代码',
      ],
      permissions: ['商业使用', '修改', '分发', '专利使用', '私有使用'],
      restrictions: ['承担风险', '封闭源代码'],
      forbidden: ['封闭源代码分发', '不提供源代码的网络服务'],
      isCopyleft: true,
      copyleftStrength: 'network',
    },
    {
      id: 'license-lgpl-3.0',
      spdxId: 'LGPL-3.0-only',
      fullName: 'GNU Lesser General Public License v3.0 only',
      shortName: 'LGPL-3.0',
      name: 'GNU LGPL v3.0',
      category: 'copyleft',
      riskLevel: 'warning',
      description:
        'GNU宽通用公共许可证v3.0是一种弱Copyleft许可证，允许非Copyleft程序链接到LGPL许可的库。',
      obligations: ['公开库源代码', '许可证声明', '允许反向工程'],
      conditions: ['公开库源代码', '许可证声明', '允许反向工程'],
      permissions: ['商业使用', '修改', '分发', '专利使用', '私有使用'],
      restrictions: ['承担风险', '静态链接时公开源代码'],
      forbidden: [],
      isCopyleft: true,
      copyleftStrength: 'weak',
    },
    {
      id: 'license-lgpl-2.1',
      spdxId: 'LGPL-2.1-only',
      fullName: 'GNU Lesser General Public License v2.1 only',
      shortName: 'LGPL-2.1',
      name: 'GNU LGPL v2.1',
      category: 'copyleft',
      riskLevel: 'warning',
      description:
        'GNU宽通用公共许可证v2.1是一种弱Copyleft许可证，允许非Copyleft程序链接到LGPL许可的库。',
      obligations: ['公开库源代码', '许可证声明', '允许反向工程'],
      conditions: ['公开库源代码', '许可证声明', '允许反向工程'],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险', '静态链接时公开源代码'],
      forbidden: [],
      isCopyleft: true,
      copyleftStrength: 'weak',
    },
    {
      id: 'license-mpl-2.0',
      spdxId: 'MPL-2.0',
      fullName: 'Mozilla Public License 2.0',
      shortName: 'MPL-2.0',
      name: 'Mozilla Public License 2.0',
      category: 'copyleft',
      riskLevel: 'warning',
      description:
        'Mozilla公共许可证v2.0是一种弱Copyleft许可证，在文件级别要求Copyleft，允许与其他许可证代码组合。',
      obligations: ['公开修改文件源代码', '许可证声明', '状态变更说明'],
      conditions: ['公开修改文件源代码', '许可证声明', '状态变更说明'],
      permissions: ['商业使用', '修改', '分发', '专利使用', '私有使用'],
      restrictions: ['承担风险'],
      forbidden: [],
      isCopyleft: true,
      copyleftStrength: 'weak',
    },
    {
      id: 'license-epl-2.0',
      spdxId: 'EPL-2.0',
      fullName: 'Eclipse Public License 2.0',
      shortName: 'EPL-2.0',
      name: 'Eclipse Public License 2.0',
      category: 'copyleft',
      riskLevel: 'warning',
      description:
        'Eclipse公共许可证v2.0是Eclipse基金会发布的弱Copyleft许可证。',
      obligations: ['公开修改文件源代码', '许可证声明'],
      conditions: ['公开修改文件源代码', '许可证声明'],
      permissions: ['商业使用', '修改', '分发', '专利使用', '私有使用'],
      restrictions: ['承担风险', '禁止使用商标'],
      forbidden: [],
      isCopyleft: true,
      copyleftStrength: 'weak',
    },
    {
      id: 'license-isc',
      spdxId: 'ISC',
      fullName: 'ISC License',
      shortName: 'ISC',
      name: 'ISC License',
      category: 'permissive',
      riskLevel: 'safe',
      description: 'ISC许可证是由Internet Systems Consortium发布的宽松开源许可证。',
      obligations: ['保留版权声明', '保留许可声明'],
      conditions: ['保留版权声明', '保留许可声明'],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-unlicense',
      spdxId: 'Unlicense',
      fullName: 'The Unlicense',
      shortName: 'Unlicense',
      name: 'The Unlicense',
      category: 'public_domain',
      riskLevel: 'safe',
      description: 'Unlicense是将软件发布到公共领域的方式，放弃所有版权。',
      obligations: [],
      conditions: [],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-cc0-1.0',
      spdxId: 'CC0-1.0',
      fullName: 'Creative Commons Zero v1.0 Universal',
      shortName: 'CC0-1.0',
      name: 'Creative Commons Zero',
      category: 'public_domain',
      riskLevel: 'safe',
      description: 'Creative Commons Zero是将作品发布到公共领域的通用方式。',
      obligations: [],
      conditions: [],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-cc-by-4.0',
      spdxId: 'CC-BY-4.0',
      fullName: 'Creative Commons Attribution 4.0 International',
      shortName: 'CC-BY-4.0',
      name: 'Creative Commons Attribution 4.0',
      category: 'permissive',
      riskLevel: 'safe',
      description: 'Creative Commons Attribution 4.0要求署名的宽松许可证。',
      obligations: ['署名', '说明修改'],
      conditions: ['署名', '说明修改'],
      permissions: ['商业使用', '修改', '分发'],
      restrictions: ['承担风险'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-cc-by-sa-4.0',
      spdxId: 'CC-BY-SA-4.0',
      fullName: 'Creative Commons Attribution-ShareAlike 4.0 International',
      shortName: 'CC-BY-SA-4.0',
      name: 'Creative Commons Attribution-ShareAlike 4.0',
      category: 'copyleft',
      riskLevel: 'warning',
      description: 'Creative Commons Attribution-ShareAlike 4.0要求署名且以相同方式共享。',
      obligations: ['署名', '说明修改', '相同许可证'],
      conditions: ['署名', '说明修改', '相同许可证'],
      permissions: ['商业使用', '修改', '分发'],
      restrictions: ['承担风险'],
      forbidden: [],
      isCopyleft: true,
      copyleftStrength: 'weak',
    },
    {
      id: 'license-bsl-1.0',
      spdxId: 'BSL-1.0',
      fullName: 'Boost Software License 1.0',
      shortName: 'BSL-1.0',
      name: 'Boost Software License 1.0',
      category: 'permissive',
      riskLevel: 'safe',
      description: 'Boost软件许可证1.0是一种宽松的开源许可证。',
      obligations: ['保留版权声明'],
      conditions: ['保留版权声明'],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-zlib',
      spdxId: 'Zlib',
      fullName: 'zlib License',
      shortName: 'Zlib',
      name: 'zlib License',
      category: 'permissive',
      riskLevel: 'safe',
      description: 'zlib许可证是用于zlib库的宽松开源许可证。',
      obligations: ['保留版权声明'],
      conditions: ['保留版权声明'],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险', '不能声称您编写了原始软件'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-mit-apache',
      spdxId: 'MIT OR Apache-2.0',
      fullName: 'MIT License or Apache License 2.0',
      shortName: 'MIT/Apache-2.0',
      name: 'MIT or Apache 2.0',
      category: 'permissive',
      riskLevel: 'safe',
      description: '双许可证，允许选择MIT或Apache-2.0许可证。',
      obligations: ['保留版权声明', '保留许可声明'],
      conditions: ['保留版权声明', '保留许可声明'],
      permissions: ['商业使用', '修改', '分发', '私有使用'],
      restrictions: ['承担风险'],
      forbidden: [],
      isCopyleft: false,
    },
    {
      id: 'license-unknown',
      spdxId: 'UNKNOWN',
      fullName: 'Unknown License',
      shortName: 'Unknown',
      name: 'Unknown License',
      category: 'permissive',
      riskLevel: 'unknown',
      description: '无法识别的许可证，需要人工确认。',
      obligations: [],
      conditions: [],
      permissions: [],
      restrictions: [],
      forbidden: [],
      isCopyleft: false,
    },
  ];

  await db.licenses.bulkAdd(licenses);
}

export async function calculateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function calculateObjectHash(obj: unknown): Promise<string> {
  return calculateHash(JSON.stringify(obj, Object.keys(obj as object).sort()));
}
