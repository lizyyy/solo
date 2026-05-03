import {
  MasterPlaylist,
  VariantPlaylist,
  SegmentManifestEntry,
  CdnAccessEntry,
  RulesConfig,
  ValidationIssue,
  PackageAnalysis,
  TimelineSegment,
} from '../types';

export interface ValidationContext {
  masterPlaylist: MasterPlaylist;
  variantPlaylists: VariantPlaylist[];
  segmentManifest: SegmentManifestEntry[];
  cdnAccess: CdnAccessEntry[];
  rulesConfig: RulesConfig;
  packageName: string;
}

export class RuleEngine {
  private context: ValidationContext;

  constructor(context: ValidationContext) {
    this.context = context;
  }

  async validate(): Promise<{ issues: ValidationIssue[]; analysis: PackageAnalysis }> {
    const issues: ValidationIssue[] = [];
    const analysis = this.buildAnalysis();

    const enabledRules = this.context.rulesConfig.rules.filter((r) => r.enabled);

    for (const rule of enabledRules) {
      const ruleIssues = await this.runRule(rule, analysis);
      issues.push(...ruleIssues);
    }

    return { issues, analysis };
  }

  private buildAnalysis(): PackageAnalysis {
    const variants = this.context.variantPlaylists.map((playlist) => {
      const variantInfo = this.context.masterPlaylist.variants.find(
        (v) => v.uri === playlist.fileName || playlist.rawContent.includes(v.uri)
      );

      const actualDurations = playlist.segments.map((s) => s.duration);
      const totalDuration = actualDurations.reduce((sum, d) => sum + d, 0);

      return {
        uri: playlist.fileName,
        bandwidth: variantInfo?.bandwidth || 0,
        resolution: variantInfo?.resolution,
        segmentCount: playlist.segments.length,
        totalDuration,
        targetDuration: playlist.targetDuration,
        actualDurations,
        mediaSequenceStart: playlist.mediaSequence,
        mediaSequenceEnd: playlist.segments.length > 0 
          ? playlist.segments[playlist.segments.length - 1].sequenceNumber 
          : playlist.mediaSequence,
        hasDiscontinuities: playlist.discontinuities.length > 0,
        discontinuityCount: playlist.discontinuities.length,
        isEncrypted: playlist.encryptionKeys.some((k) => k.method !== 'NONE'),
        encryptionKeyCount: playlist.encryptionKeys.filter((k) => k.method !== 'NONE').length,
      };
    });

    const timeline = this.buildTimeline();
    const cdnStatus = this.buildCdnStatus();
    const crossMidnight = this.checkCrossMidnight();

    return {
      variants,
      timeline,
      cdnStatus,
      crossMidnight,
    };
  }

  private buildTimeline(): TimelineSegment[] {
    const segments: TimelineSegment[] = [];
    const variantSet = new Set<string>();

    this.context.variantPlaylists.forEach((playlist) => {
      playlist.segments.forEach((segment) => {
        variantSet.add(playlist.fileName);
        segments.push({
          variant: playlist.fileName,
          sequenceNumber: segment.sequenceNumber,
          startTime: segment.startTime || 0,
          endTime: segment.endTime || 0,
          duration: segment.duration,
          programDateTime: segment.programDateTime?.toISOString(),
          status: 'present' as const,
        });
      });
    });

    this.markMissingAndDuplicates(segments);

    return segments;
  }

  private markMissingAndDuplicates(segments: TimelineSegment[]): void {
    const groupedByVariant = new Map<string, TimelineSegment[]>();
    
    segments.forEach((seg) => {
      if (!groupedByVariant.has(seg.variant)) {
        groupedByVariant.set(seg.variant, []);
      }
      groupedByVariant.get(seg.variant)!.push(seg);
    });

    groupedByVariant.forEach((variantSegments, variant) => {
      variantSegments.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      const sequenceNumbers = new Set<number>();
      const duplicates = new Set<number>();

      variantSegments.forEach((seg) => {
        if (sequenceNumbers.has(seg.sequenceNumber)) {
          duplicates.add(seg.sequenceNumber);
          seg.status = 'duplicate';
        } else {
          sequenceNumbers.add(seg.sequenceNumber);
        }
      });

      if (variantSegments.length > 0) {
        const minSeq = Math.min(...Array.from(sequenceNumbers));
        const maxSeq = Math.max(...Array.from(sequenceNumbers));

        for (let seq = minSeq; seq <= maxSeq; seq++) {
          if (!sequenceNumbers.has(seq)) {
            segments.push({
              variant,
              sequenceNumber: seq,
              startTime: 0,
              endTime: 0,
              duration: 0,
              status: 'missing',
            });
          }
        }
      }
    });
  }

  private buildCdnStatus(): PackageAnalysis['cdnStatus'] {
    const access = this.context.cdnAccess;

    if (access.length === 0) {
      return {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        avgResponseTimeMs: 0,
        maxResponseTimeMs: 0,
        statusCodeBreakdown: {},
      };
    }

    const statusCodeBreakdown: Record<number, number> = {};
    let totalResponseTime = 0;
    let maxResponseTime = 0;
    let successCount = 0;
    let errorCount = 0;

    access.forEach((entry) => {
      statusCodeBreakdown[entry.statusCode] = (statusCodeBreakdown[entry.statusCode] || 0) + 1;
      totalResponseTime += entry.responseTimeMs;
      maxResponseTime = Math.max(maxResponseTime, entry.responseTimeMs);

      if (entry.statusCode >= 200 && entry.statusCode < 300) {
        successCount++;
      } else {
        errorCount++;
      }
    });

    return {
      totalRequests: access.length,
      successCount,
      errorCount,
      avgResponseTimeMs: totalResponseTime / access.length,
      maxResponseTimeMs: maxResponseTime,
      statusCodeBreakdown,
    };
  }

  private checkCrossMidnight(): boolean {
    for (const playlist of this.context.variantPlaylists) {
      const segmentsWithDateTime = playlist.segments.filter((s) => s.programDateTime);
      
      if (segmentsWithDateTime.length < 2) continue;

      for (let i = 1; i < segmentsWithDateTime.length; i++) {
        const prev = segmentsWithDateTime[i - 1].programDateTime!;
        const curr = segmentsWithDateTime[i].programDateTime!;

        const prevDay = prev.getUTCDate();
        const currDay = curr.getUTCDate();

        if (currDay !== prevDay) {
          return true;
        }
      }
    }
    return false;
  }

  private async runRule(
    rule: { id: string; severity: 'error' | 'warning' | 'info' },
    analysis: PackageAnalysis
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    switch (rule.id) {
      case 'bitrate_gradient':
        issues.push(...this.checkBitrateGradient(analysis, rule));
        break;
      case 'segment_duration':
        issues.push(...this.checkSegmentDuration(analysis, rule));
        break;
      case 'discontinuity':
        issues.push(...this.checkDiscontinuities(analysis, rule));
        break;
      case 'encryption_key':
        issues.push(...this.checkEncryptionKeys(analysis, rule));
        break;
      case 'missing_segments':
        issues.push(...this.checkMissingSegments(analysis, rule));
        break;
      case 'duplicate_segments':
        issues.push(...this.checkDuplicateSegments(analysis, rule));
        break;
      case 'cdn_404':
        issues.push(...this.checkCdn404(analysis, rule));
        break;
      case 'cdn_response_time':
        issues.push(...this.checkCdnResponseTime(analysis, rule));
        break;
      case 'cross_midnight':
        issues.push(...this.checkCrossMidnightRule(analysis, rule));
        break;
      case 'variant_consistency':
        issues.push(...this.checkVariantConsistency(analysis, rule));
        break;
    }

    return issues;
  }

  private checkBitrateGradient(
    analysis: PackageAnalysis,
    rule: { id: string; severity: 'error' | 'warning' | 'info' }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const variants = analysis.variants.filter((v) => v.bandwidth > 0);

    if (variants.length < 2) return issues;

    variants.sort((a, b) => a.bandwidth - b.bandwidth);

    for (let i = 1; i < variants.length; i++) {
      const prev = variants[i - 1];
      const curr = variants[i];
      const ratio = curr.bandwidth / prev.bandwidth;

      if (ratio < 1.1) {
        issues.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: `Bitrates too close: ${prev.bandwidth} bps and ${curr.bandwidth} bps (ratio: ${ratio.toFixed(2)})`,
          location: `${prev.uri} vs ${curr.uri}`,
          context: {
            prevBandwidth: prev.bandwidth,
            currBandwidth: curr.bandwidth,
            ratio,
          },
        });
      }

      if (ratio > 3.0) {
        issues.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: `Bitrates too far apart: ${prev.bandwidth} bps and ${curr.bandwidth} bps (ratio: ${ratio.toFixed(2)})`,
          location: `${prev.uri} vs ${curr.uri}`,
          context: {
            prevBandwidth: prev.bandwidth,
            currBandwidth: curr.bandwidth,
            ratio,
          },
        });
      }
    }

    return issues;
  }

  private checkSegmentDuration(
    analysis: PackageAnalysis,
    rule: { id: string; severity: 'error' | 'warning' | 'info' }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const maxVariance = this.context.rulesConfig.thresholds?.maxSegmentDurationVariance || 0.5;

    analysis.variants.forEach((variant) => {
      variant.actualDurations.forEach((duration, index) => {
        const variance = Math.abs(duration - variant.targetDuration);
        const sequenceNumber = variant.mediaSequenceStart + index;

        if (variance > maxVariance) {
          issues.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: `Segment duration variance exceeds threshold: ${duration}s (target: ${variant.targetDuration}s, variance: ${variance.toFixed(2)}s)`,
            location: `${variant.uri}, segment #${sequenceNumber}`,
            context: {
              duration,
              targetDuration: variant.targetDuration,
              variance,
              sequenceNumber,
            },
          });
        }
      });
    });

    return issues;
  }

  private checkDiscontinuities(
    analysis: PackageAnalysis,
    rule: { id: string; severity: 'error' | 'warning' | 'info' }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    analysis.variants.forEach((variant) => {
      if (variant.hasDiscontinuities) {
        issues.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: `Variant contains ${variant.discontinuityCount} discontinuity(ies)`,
          location: variant.uri,
          context: {
            discontinuityCount: variant.discontinuityCount,
          },
        });
      }
    });

    return issues;
  }

  private checkEncryptionKeys(
    analysis: PackageAnalysis,
    rule: { id: string; severity: 'error' | 'warning' | 'info' }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const encryptedVariants = analysis.variants.filter((v) => v.isEncrypted);
    const unencryptedVariants = analysis.variants.filter((v) => !v.isEncrypted);

    if (encryptedVariants.length > 0 && unencryptedVariants.length > 0) {
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: `Inconsistent encryption: ${encryptedVariants.length} variant(s) encrypted, ${unencryptedVariants.length} variant(s) unencrypted`,
        context: {
          encryptedCount: encryptedVariants.length,
          unencryptedCount: unencryptedVariants.length,
        },
      });
    }

    encryptedVariants.forEach((variant) => {
      if (variant.encryptionKeyCount > 1) {
        issues.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: `Variant uses ${variant.encryptionKeyCount} different encryption keys`,
          location: variant.uri,
          context: {
            keyCount: variant.encryptionKeyCount,
          },
        });
      }
    });

    return issues;
  }

  private checkMissingSegments(
    analysis: PackageAnalysis,
    rule: { id: string; severity: 'error' | 'warning' | 'info' }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const missingByVariant = new Map<string, number[]>();

    analysis.timeline
      .filter((seg) => seg.status === 'missing')
      .forEach((seg) => {
        if (!missingByVariant.has(seg.variant)) {
          missingByVariant.set(seg.variant, []);
        }
        missingByVariant.get(seg.variant)!.push(seg.sequenceNumber);
      });

    missingByVariant.forEach((missingSeqNumbers, variant) => {
      const sorted = missingSeqNumbers.sort((a, b) => a - b);
      const ranges = this.groupRanges(sorted);

      ranges.forEach((range) => {
        issues.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: range.start === range.end
            ? `Missing segment #${range.start}`
            : `Missing segments #${range.start}-${range.end}`,
          location: variant,
          context: {
            sequenceNumbers: sorted,
            range: range,
          },
        });
      });
    });

    return issues;
  }

  private checkDuplicateSegments(
    analysis: PackageAnalysis,
    rule: { id: string; severity: 'error' | 'warning' | 'info' }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const duplicateByVariant = new Map<string, number[]>();

    analysis.timeline
      .filter((seg) => seg.status === 'duplicate')
      .forEach((seg) => {
        if (!duplicateByVariant.has(seg.variant)) {
          duplicateByVariant.set(seg.variant, []);
        }
        duplicateByVariant.get(seg.variant)!.push(seg.sequenceNumber);
      });

    duplicateByVariant.forEach((duplicateSeqNumbers, variant) => {
      const uniqueSeqs = [...new Set(duplicateSeqNumbers)].sort((a, b) => a - b);

      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: `Duplicate segments found at sequences: ${uniqueSeqs.join(', ')}`,
        location: variant,
        context: {
          sequenceNumbers: uniqueSeqs,
        },
      });
    });

    return issues;
  }

  private checkCdn404(
    analysis: PackageAnalysis,
    rule: { id: string; severity: 'error' | 'warning' | 'info' }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (analysis.cdnStatus.statusCodeBreakdown[404]) {
      const count404 = analysis.cdnStatus.statusCodeBreakdown[404];
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: `Found ${count404} CDN 404 error(s)`,
        context: {
          count404,
        },
      });
    }

    const errorCodes = Object.entries(analysis.cdnStatus.statusCodeBreakdown)
      .filter(([code]) => parseInt(code, 10) >= 400 && parseInt(code, 10) !== 404);

    errorCodes.forEach(([code, count]) => {
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: `Found ${count} CDN error(s) with status code ${code}`,
        context: {
          statusCode: parseInt(code, 10),
          count,
        },
      });
    });

    return issues;
  }

  private checkCdnResponseTime(
    analysis: PackageAnalysis,
    rule: { id: string; severity: 'error' | 'warning' | 'info' }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const maxResponseTime = this.context.rulesConfig.thresholds?.maxResponseTimeMs || 1000;

    if (analysis.cdnStatus.avgResponseTimeMs > maxResponseTime) {
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: `Average CDN response time exceeds threshold: ${analysis.cdnStatus.avgResponseTimeMs.toFixed(0)}ms (threshold: ${maxResponseTime}ms)`,
        context: {
          avgResponseTimeMs: analysis.cdnStatus.avgResponseTimeMs,
          maxResponseTimeMs: maxResponseTime,
        },
      });
    }

    if (analysis.cdnStatus.maxResponseTimeMs > maxResponseTime * 2) {
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: `Max CDN response time is significantly high: ${analysis.cdnStatus.maxResponseTimeMs}ms`,
        context: {
          maxResponseTimeMs: analysis.cdnStatus.maxResponseTimeMs,
        },
      });
    }

    return issues;
  }

  private checkCrossMidnightRule(
    analysis: PackageAnalysis,
    rule: { id: string; severity: 'error' | 'warning' | 'info' }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (analysis.crossMidnight) {
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: 'Program date time crosses midnight boundary - verify timestamp continuity',
        context: {
          crossMidnight: true,
        },
      });
    }

    return issues;
  }

  private checkVariantConsistency(
    analysis: PackageAnalysis,
    rule: { id: string; severity: 'error' | 'warning' | 'info' }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (analysis.variants.length < 2) return issues;

    const segmentCounts = new Map<string, number>();
    const durations = new Map<string, number>();

    analysis.variants.forEach((variant) => {
      segmentCounts.set(variant.uri, variant.segmentCount);
      durations.set(variant.uri, variant.totalDuration);
    });

    const counts = Array.from(segmentCounts.values());
    const totalDurs = Array.from(durations.values());

    const allSameCount = counts.every((c) => c === counts[0]);
    const allSameDuration = totalDurs.every((d) => Math.abs(d - totalDurs[0]) < 0.1);

    if (!allSameCount) {
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: 'Variants have inconsistent segment counts',
        details: Array.from(segmentCounts.entries())
          .map(([uri, count]) => `${uri}: ${count} segments`)
          .join('\n'),
        context: {
          segmentCounts: Object.fromEntries(segmentCounts),
        },
      });
    }

    if (!allSameDuration) {
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: 'Variants have inconsistent total durations',
        details: Array.from(durations.entries())
          .map(([uri, dur]) => `${uri}: ${dur.toFixed(2)}s`)
          .join('\n'),
        context: {
          totalDurations: Object.fromEntries(durations),
        },
      });
    }

    const variantSet = new Set(analysis.timeline.map((s) => s.variant));
    const uniqueVariants = Array.from(variantSet);

    if (uniqueVariants.length > 1) {
      const segmentsByVariant = new Map<string, number[]>();
      analysis.timeline.forEach((seg) => {
        if (!segmentsByVariant.has(seg.variant)) {
          segmentsByVariant.set(seg.variant, []);
        }
        segmentsByVariant.get(seg.variant)!.push(seg.sequenceNumber);
      });

      const sequencesByVariant = new Map<string, Set<number>>();
      segmentsByVariant.forEach((seqs, variant) => {
        sequencesByVariant.set(variant, new Set(seqs));
      });

      const allSeqs = new Set<number>();
      sequencesByVariant.forEach((seqs) => {
        seqs.forEach((s) => allSeqs.add(s));
      });

      allSeqs.forEach((seq) => {
        const hasInSome: string[] = [];
        const missingIn: string[] = [];

        sequencesByVariant.forEach((seqs, variant) => {
          if (seqs.has(seq)) {
            hasInSome.push(variant);
          } else {
            missingIn.push(variant);
          }
        });

        if (hasInSome.length > 0 && missingIn.length > 0) {
          issues.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: `Segment #${seq} exists in some variants but missing in others`,
            details: `Present in: ${hasInSome.join(', ')}\nMissing in: ${missingIn.join(', ')}`,
            context: {
              sequenceNumber: seq,
              presentIn: hasInSome,
              missingIn: missingIn,
            },
          });
        }
      });
    }

    return issues;
  }

  private groupRanges(numbers: number[]): { start: number; end: number }[] {
    if (numbers.length === 0) return [];

    const sorted = [...numbers].sort((a, b) => a - b);
    const ranges: { start: number; end: number }[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push({ start, end });
        start = sorted[i];
        end = sorted[i];
      }
    }

    ranges.push({ start, end });
    return ranges;
  }
}

export default RuleEngine;
