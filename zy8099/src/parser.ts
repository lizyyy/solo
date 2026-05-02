import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { WebrtcStat, SignalingEvent, ClinicRule, ParsedData } from './types';

export function readJsonlFile<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  return lines
    .filter(line => line.trim())
    .map(line => JSON.parse(line.trim()));
}

export function readYamlFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content) as T;
}

export function validateWebrtcStats(stats: unknown[]): WebrtcStat[] {
  return stats.map((stat, index) => {
    const s = stat as Record<string, unknown>;
    if (!s.timestamp || typeof s.timestamp !== 'number') {
      throw new Error(`WebRTC stat #${index}: invalid or missing timestamp`);
    }
    if (!s.clientId || typeof s.clientId !== 'string') {
      throw new Error(`WebRTC stat #${index}: invalid or missing clientId`);
    }
    if (!s.role || !['doctor', 'patient'].includes(s.role as string)) {
      throw new Error(`WebRTC stat #${index}: invalid or missing role`);
    }
    if (!s.type || typeof s.type !== 'string') {
      throw new Error(`WebRTC stat #${index}: invalid or missing type`);
    }
    if (!s.id || typeof s.id !== 'string') {
      throw new Error(`WebRTC stat #${index}: invalid or missing id`);
    }
    return s as WebrtcStat;
  });
}

export function validateSignalingEvents(events: unknown[]): SignalingEvent[] {
  return events.map((event, index) => {
    const e = event as Record<string, unknown>;
    if (!e.timestamp || typeof e.timestamp !== 'number') {
      throw new Error(`Signaling event #${index}: invalid or missing timestamp`);
    }
    if (!e.clientId || typeof e.clientId !== 'string') {
      throw new Error(`Signaling event #${index}: invalid or missing clientId`);
    }
    if (!e.role || !['doctor', 'patient'].includes(e.role as string)) {
      throw new Error(`Signaling event #${index}: invalid or missing role`);
    }
    if (!e.eventType || typeof e.eventType !== 'string') {
      throw new Error(`Signaling event #${index}: invalid or missing eventType`);
    }
    return e as SignalingEvent;
  });
}

export function validateRules(rules: unknown): ClinicRule[] {
  const r = rules as { rules?: unknown[] };
  if (!r.rules || !Array.isArray(r.rules)) {
    throw new Error('Invalid rules file: missing rules array');
  }
  return r.rules.map((rule, index) => {
    const ru = rule as Record<string, unknown>;
    if (!ru.id || typeof ru.id !== 'string') {
      throw new Error(`Rule #${index}: invalid or missing id`);
    }
    if (!ru.name || typeof ru.name !== 'string') {
      throw new Error(`Rule #${index}: invalid or missing name`);
    }
    if (!ru.description || typeof ru.description !== 'string') {
      throw new Error(`Rule #${index}: invalid or missing description`);
    }
    if (!ru.category || typeof ru.category !== 'string') {
      throw new Error(`Rule #${index}: invalid or missing category`);
    }
    if (typeof ru.enabled !== 'boolean') {
      throw new Error(`Rule #${index}: invalid or missing enabled`);
    }
    return {
      id: ru.id,
      name: ru.name,
      description: ru.description,
      category: ru.category as ClinicRule['category'],
      threshold: ru.threshold as number | undefined,
      duration: ru.duration as number | undefined,
      enabled: ru.enabled
    };
  });
}

export function parseAndValidate(
  statsPath: string,
  signalingPath: string,
  rulesPath: string
): ParsedData {
  const rawStats = readJsonlFile<unknown>(statsPath);
  const rawSignaling = readJsonlFile<unknown>(signalingPath);
  const rawRules = readYamlFile<unknown>(rulesPath);

  const webrtcStats = validateWebrtcStats(rawStats);
  const signalingEvents = validateSignalingEvents(rawSignaling);
  const rules = validateRules(rawRules);

  return { webrtcStats, signalingEvents, rules };
}
