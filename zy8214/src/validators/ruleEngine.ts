import { Risk, Fixture, Cue, SceneRules, Channel } from '../types';
import { checkChannelConflicts } from './channelConflictValidator';
import { checkFadeOverlaps } from './fadeOverlapValidator';
import { checkExcessiveBlackouts } from './blackoutValidator';
import { checkMissingSafetyLights } from './safetyLightValidator';

export interface ValidationResult {
  risks: Risk[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

export function validateAll(
  fixtures: Fixture[],
  cues: Cue[],
  rules: SceneRules
): ValidationResult {
  const allRisks: Risk[] = [];

  const dimmerChannels: Channel[] = [];
  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel) => {
      if (channel.type === 'dimmer') {
        dimmerChannels.push(channel);
      }
    });
  });

  allRisks.push(...checkChannelConflicts(fixtures, cues));
  allRisks.push(...checkFadeOverlaps(cues, rules));
  allRisks.push(...checkExcessiveBlackouts(cues, rules, dimmerChannels));
  allRisks.push(...checkMissingSafetyLights(cues, rules));

  const summary = {
    total: allRisks.length,
    critical: allRisks.filter((r) => r.severity === 'critical').length,
    warning: allRisks.filter((r) => r.severity === 'warning').length,
    info: allRisks.filter((r) => r.severity === 'info').length
  };

  return {
    risks: allRisks,
    summary
  };
}

export function getRisksByType(risks: Risk[], type: Risk['type']): Risk[] {
  return risks.filter((r) => r.type === type);
}

export function getRisksBySeverity(risks: Risk[], severity: Risk['severity']): Risk[] {
  return risks.filter((r) => r.severity === severity);
}

export function getRisksByCue(risks: Risk[], cueId: string): Risk[] {
  return risks.filter((r) => r.cueId === cueId);
}

export function sortRisksBySeverity(risks: Risk[]): Risk[] {
  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2
  };

  return [...risks].sort((a, b) => {
    const orderA = severityOrder[a.severity] ?? 3;
    const orderB = severityOrder[b.severity] ?? 3;
    return orderA - orderB;
  });
}