import * as fs from 'fs';
import * as path from 'path';
import { M3U8Parser, CsvParser, JsonlParser, YamlParser } from '../parsers';
import { RuleEngine, ValidationContext } from '../rules';
import { ReportGenerator } from '../reports';
import {
  MasterPlaylist,
  VariantPlaylist,
  SegmentManifestEntry,
  CdnAccessEntry,
  RulesConfig,
  ValidationResult,
} from '../types';

export interface ValidateOptions {
  inputDir: string;
  outputDir?: string;
  rulesFile?: string;
  verbose?: boolean;
}

export interface PackageFiles {
  masterPlaylist: MasterPlaylist;
  variantPlaylists: VariantPlaylist[];
  segmentManifest: SegmentManifestEntry[];
  cdnAccess: CdnAccessEntry[];
  rulesConfig: RulesConfig;
}

export class HlsValidator {
  private m3u8Parser: M3U8Parser;
  private csvParser: CsvParser;
  private jsonlParser: JsonlParser;
  private yamlParser: YamlParser;

  constructor() {
    this.m3u8Parser = new M3U8Parser();
    this.csvParser = new CsvParser();
    this.jsonlParser = new JsonlParser();
    this.yamlParser = new YamlParser();
  }

  async validate(options: ValidateOptions): Promise<ValidationResult> {
    const startTime = performance.now();
    const packageName = path.basename(options.inputDir);

    const files = await this.loadPackageFiles(options);

    const context: ValidationContext = {
      masterPlaylist: files.masterPlaylist,
      variantPlaylists: files.variantPlaylists,
      segmentManifest: files.segmentManifest,
      cdnAccess: files.cdnAccess,
      rulesConfig: files.rulesConfig,
      packageName,
    };

    const ruleEngine = new RuleEngine(context);
    const { issues, analysis } = await ruleEngine.validate();

    const endTime = performance.now();
    const duration = endTime - startTime;

    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const infos = issues.filter((i) => i.severity === 'info').length;

    const result: ValidationResult = {
      summary: {
        total: issues.length,
        errors,
        warnings,
        infos,
      },
      issues,
      metadata: {
        processedAt: new Date(),
        duration,
        packageName,
      },
      analysis,
    };

    if (options.outputDir) {
      const reportGenerator = new ReportGenerator(result, options.outputDir);
      await reportGenerator.generateAll();
    }

    return result;
  }

  private async loadPackageFiles(options: ValidateOptions): Promise<PackageFiles> {
    const inputDir = options.inputDir;

    const masterPlaylistFile = await this.findMasterPlaylist(inputDir);
    const masterPlaylist = await this.m3u8Parser.parseMasterPlaylistFile(masterPlaylistFile);

    const variantPlaylists = await this.loadVariantPlaylists(
      inputDir,
      masterPlaylist
    );

    let segmentManifest: SegmentManifestEntry[] = [];
    const manifestFile = path.join(inputDir, 'segments_manifest.csv');
    if (await this.fileExists(manifestFile)) {
      segmentManifest = await this.csvParser.parseSegmentsManifestFile(manifestFile);
    }

    let cdnAccess: CdnAccessEntry[] = [];
    const cdnFile = path.join(inputDir, 'cdn_access.jsonl');
    if (await this.fileExists(cdnFile)) {
      cdnAccess = await this.jsonlParser.parseCdnAccessFile(cdnFile);
    }

    let rulesConfig: RulesConfig;
    if (options.rulesFile) {
      rulesConfig = await this.yamlParser.parseRulesConfigFile(options.rulesFile);
    } else {
      const defaultRulesFile = path.join(inputDir, 'rules.yaml');
      if (await this.fileExists(defaultRulesFile)) {
        rulesConfig = await this.yamlParser.parseRulesConfigFile(defaultRulesFile);
      } else {
        rulesConfig = this.yamlParser.parseRulesConfig('');
      }
    }

    return {
      masterPlaylist,
      variantPlaylists,
      segmentManifest,
      cdnAccess,
      rulesConfig,
    };
  }

  private async findMasterPlaylist(inputDir: string): Promise<string> {
    const files = await fs.promises.readdir(inputDir);
    
    const masterFiles = files.filter((f) => 
      f.toLowerCase() === 'master.m3u8' || 
      f.toLowerCase().includes('index.m3u8') ||
      (f.endsWith('.m3u8') && !f.includes('variant') && !f.match(/^\d+p/))
    );

    if (masterFiles.length === 0) {
      const m3u8Files = files.filter((f) => f.endsWith('.m3u8'));
      if (m3u8Files.length === 0) {
        throw new Error(`No .m3u8 files found in ${inputDir}`);
      }
      return path.join(inputDir, m3u8Files[0]);
    }

    return path.join(inputDir, masterFiles[0]);
  }

  private async loadVariantPlaylists(
    inputDir: string,
    masterPlaylist: MasterPlaylist
  ): Promise<VariantPlaylist[]> {
    const variantUris = masterPlaylist.variants
      .map((v) => v.uri)
      .filter((uri) => uri);

    const alternativeUris = masterPlaylist.alternativeRenditions
      .filter((r) => r.uri)
      .map((r) => r.uri!);

    const allUris = [...new Set([...variantUris, ...alternativeUris])];

    const playlists: VariantPlaylist[] = [];

    for (const uri of allUris) {
      const filePath = path.join(inputDir, path.basename(uri));
      if (await this.fileExists(filePath)) {
        try {
          const playlist = await this.m3u8Parser.parseVariantPlaylistFile(filePath);
          playlists.push(playlist);
        } catch (e) {
          console.warn(`Warning: Failed to parse ${uri}: ${e}`);
        }
      }
    }

    const files = await fs.promises.readdir(inputDir);
    const m3u8Files = files.filter((f) => 
      f.endsWith('.m3u8') && 
      f.toLowerCase() !== 'master.m3u8' &&
      !allUris.some(u => path.basename(u) === f)
    );

    for (const file of m3u8Files) {
      const filePath = path.join(inputDir, file);
      try {
        const playlist = await this.m3u8Parser.parseVariantPlaylistFile(filePath);
        if (playlist.segments.length > 0) {
          playlists.push(playlist);
        }
      } catch (e) {
        console.warn(`Warning: Failed to parse ${file}: ${e}`);
      }
    }

    return playlists;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default HlsValidator;
