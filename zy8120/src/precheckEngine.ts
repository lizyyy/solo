import * as path from 'path';
import {
  PrecheckOptions,
  PrecheckResult,
  Issue,
  Route,
  ManifestEntry,
  DefectAnnotation,
  ImageExif,
  CoverageResult,
} from './types';
import {
  YamlParser,
  CsvParser,
  JsonlParser,
  ImageParser,
} from './parsers';
import {
  WaypointChecker,
  FileChecker,
  AnomalyChecker,
  BboxChecker,
  CoverageChecker,
} from './checkers';
import {
  MarkdownReporter,
  CsvReporter,
  JsonReporter,
} from './reporters';

export class PrecheckEngine {
  private options: PrecheckOptions;

  constructor(options: PrecheckOptions) {
    this.options = options;
  }

  async run(): Promise<PrecheckResult> {
    console.log('🚀 开始预检...');
    console.log(`📂 输入目录: ${this.options.inputDir}`);
    console.log(`📤 输出目录: ${this.options.outputDir}`);
    console.log('');

    console.log('📖 解析输入文件...');
    const { route, manifest, defects, imagePaths, exifMap } = await this.parseInputs();
    console.log(`   ✓ 航线: ${route.totalWaypoints} 航点, ${route.expectedPhotos} 预期照片`);
    console.log(`   ✓ 清单: ${manifest.length} 条目`);
    console.log(`   ✓ 缺陷: ${defects.length} 标注`);
    console.log(`   ✓ 图片: ${imagePaths.length} 文件`);
    console.log('');

    console.log('🔍 执行检查...');
    const allIssues: Issue[] = [];
    let coverageResults: CoverageResult[] = [];
    let duplicateFiles: string[] = [];
    let missingFiles: string[] = [];
    let missingWaypoints: string[] = [];
    let coveredWaypoints: string[] = [];
    let invalidBboxes: string[] = [];

    console.log('   1/6 检查漏拍航点...');
    const waypointResult = WaypointChecker.checkMissingWaypoints(route, manifest);
    allIssues.push(...waypointResult.issues);
    missingWaypoints = waypointResult.missingWaypoints;
    coveredWaypoints = waypointResult.coveredWaypoints;
    console.log(`      漏拍: ${missingWaypoints.length} 个航点`);

    console.log('   2/6 检查重复文件...');
    const duplicateResult = FileChecker.checkDuplicateFiles(manifest, this.options.inputDir);
    allIssues.push(...duplicateResult.issues);
    duplicateFiles = duplicateResult.duplicateFiles;
    console.log(`      重复: ${duplicateFiles.length} 个文件`);

    console.log('   3/6 检查缺失文件...');
    const missingResult = FileChecker.checkMissingFiles(manifest, this.options.inputDir);
    allIssues.push(...missingResult.issues);
    missingFiles = missingResult.missingFiles;
    console.log(`      缺失: ${missingFiles.length} 个文件`);

    console.log('   4/6 检查时间和坐标异常...');
    const anomalyChecker = new AnomalyChecker(this.options);
    const timeIssues = anomalyChecker.checkTimeAnomalies(manifest, exifMap);
    const coordIssues = anomalyChecker.checkCoordinateAnomalies(manifest, route, exifMap);
    const timezoneIssues = anomalyChecker.checkTimezoneConsistency(manifest, exifMap);
    allIssues.push(...timeIssues, ...coordIssues, ...timezoneIssues);
    console.log(`      时间异常: ${timeIssues.length}, 坐标异常: ${coordIssues.length}, 时区: ${timezoneIssues.length}`);

    console.log('   5/6 检查缺陷标注 bbox...');
    if (defects.length > 0) {
      const bboxResult = BboxChecker.checkBboxOutOfBounds(defects, manifest, exifMap);
      const duplicateDefects = BboxChecker.checkDuplicateDefects(defects);
      allIssues.push(...bboxResult.issues, ...duplicateDefects);
      invalidBboxes = bboxResult.invalidBboxes;
      console.log(`      无效 bbox: ${invalidBboxes.length} 个`);
    } else {
      console.log('      无缺陷标注文件，跳过');
    }

    console.log('   6/6 分析飞行覆盖和重飞...');
    const coverageChecker = new CoverageChecker(this.options);
    const segmentResult = coverageChecker.analyzeFlightSegments(manifest, route);
    allIssues.push(...segmentResult.issues);
    
    const coverageResult = coverageChecker.calculateCoverageByTower(
      route,
      manifest,
      segmentResult.segments
    );
    allIssues.push(...coverageResult.issues);
    coverageResults = coverageResult.coverageResults;
    
    const towersWithRerun = coverageResults.filter(c => c.rerunCount > 0).length;
    console.log(`      覆盖分析: ${coverageResults.length} 杆塔, ${towersWithRerun} 有重飞`);

    console.log('');
    console.log('📊 生成报告...');
    
    const cleanManifest = FileChecker.getCleanManifest(
      manifest,
      duplicateFiles,
      missingFiles
    );

    const result: PrecheckResult = this.buildResult(
      route,
      manifest,
      defects,
      cleanManifest,
      coverageResults,
      allIssues,
      missingWaypoints,
      coveredWaypoints,
      duplicateFiles,
      missingFiles,
      invalidBboxes
    );

    MarkdownReporter.generate(result, this.options.outputDir);
    console.log('   ✓ report.md 已生成');

    await CsvReporter.generate(result, this.options.outputDir);
    console.log('   ✓ issues.csv 已生成');

    JsonReporter.generateCleanManifest(cleanManifest, this.options.outputDir);
    console.log('   ✓ clean_manifest.json 已生成');

    JsonReporter.generateFullResult(result, this.options.outputDir);
    console.log('   ✓ precheck_result.json 已生成');

    console.log('');
    console.log('✅ 预检完成!');
    console.log(`   总问题数: ${result.summary.totalIssues}`);
    console.log(`   严重: ${result.summary.criticalIssues}, 主要: ${result.summary.majorIssues}, 次要: ${result.summary.minorIssues}, 信息: ${result.summary.infoIssues}`);
    console.log(`   输出目录: ${this.options.outputDir}`);

    return result;
  }

  private async parseInputs(): Promise<{
    route: Route;
    manifest: ManifestEntry[];
    defects: DefectAnnotation[];
    imagePaths: string[];
    exifMap: Map<string, ImageExif>;
  }> {
    const route = YamlParser.parseRouteFromDir(this.options.inputDir);
    const manifest = await CsvParser.parseManifestFromDir(this.options.inputDir);
    const defects = JsonlParser.parseDefectsFromDir(this.options.inputDir);
    
    let imagePaths: string[] = [];
    let exifMap = new Map<string, ImageExif>();
    
    try {
      imagePaths = await ImageParser.getImagesFromDir(this.options.inputDir);
      exifMap = await ImageParser.readAllExifs(imagePaths);
    } catch (error) {
      console.warn(`警告: 无法读取图片目录: ${(error as Error).message}`);
    }

    return { route, manifest, defects, imagePaths, exifMap };
  }

  private buildResult(
    route: Route,
    manifest: ManifestEntry[],
    defects: DefectAnnotation[],
    cleanManifest: ManifestEntry[],
    coverage: CoverageResult[],
    issues: Issue[],
    missingWaypoints: string[],
    coveredWaypoints: string[],
    duplicateFiles: string[],
    missingFiles: string[],
    invalidBboxes: string[]
  ): PrecheckResult {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const majorIssues = issues.filter(i => i.severity === 'major').length;
    const minorIssues = issues.filter(i => i.severity === 'minor').length;
    const infoIssues = issues.filter(i => i.severity === 'info').length;

    const success = criticalIssues === 0 && majorIssues === 0;

    return {
      success,
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: issues.length,
        criticalIssues,
        majorIssues,
        minorIssues,
        infoIssues,
      },
      route: {
        missionId: route.missionId,
        totalWaypoints: route.totalWaypoints,
        waypointsWithPhotos: coveredWaypoints.length,
        missingWaypoints,
      },
      manifest: {
        totalEntries: manifest.length,
        validEntries: cleanManifest.length,
        duplicateFiles,
        missingFiles,
      },
      defects: {
        totalAnnotations: defects.length,
        validAnnotations: defects.length - invalidBboxes.length,
        invalidBboxes,
      },
      coverage,
      issues,
      cleanManifest,
    };
  }
}
