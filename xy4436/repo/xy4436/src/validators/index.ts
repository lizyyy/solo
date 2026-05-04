import type {
  Fixture,
  Cue,
  Circuit,
  MediaFile,
  BannedDevice,
  Issue,
} from '../types';

export interface ValidationResult {
  issues: Array<Omit<Issue, 'id' | 'createdAt'>>;
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

function createIssue(
  projectId: string,
  type: Issue['type'],
  severity: Issue['severity'],
  title: string,
  description: string,
  affectedItems: string[] = []
): Omit<Issue, 'id' | 'createdAt'> {
  return {
    projectId,
    type,
    severity,
    title,
    description,
    affectedItems,
    resolved: false,
    resolutionNote: null,
  };
}

export function checkDmxConflicts(
  fixtures: Fixture[],
  projectId: string
): Array<Omit<Issue, 'id' | 'createdAt'>> {
  const issues: Array<Omit<Issue, 'id' | 'createdAt'>> = [];
  
  const universeGroups = new Map<number, Fixture[]>();
  for (const fixture of fixtures) {
    if (!universeGroups.has(fixture.universe)) {
      universeGroups.set(fixture.universe, []);
    }
    universeGroups.get(fixture.universe)!.push(fixture);
  }
  
  for (const [universe, universeFixtures] of universeGroups) {
    const sortedFixtures = [...universeFixtures].sort(
      (a, b) => a.dmxStartAddress - b.dmxStartAddress
    );
    
    for (let i = 0; i < sortedFixtures.length; i++) {
      const fixture = sortedFixtures[i];
      const fixtureEnd = fixture.dmxStartAddress + fixture.dmxChannelCount - 1;
      
      for (let j = i + 1; j < sortedFixtures.length; j++) {
        const otherFixture = sortedFixtures[j];
        const otherStart = otherFixture.dmxStartAddress;
        const otherEnd = otherStart + otherFixture.dmxChannelCount - 1;
        
        if (fixtureEnd >= otherStart && otherEnd >= fixture.dmxStartAddress) {
          const overlapStart = Math.max(fixture.dmxStartAddress, otherStart);
          const overlapEnd = Math.min(fixtureEnd, otherEnd);
          
          issues.push(
            createIssue(
              projectId,
              'dmx_conflict',
              'critical',
              `DMX地址冲突 (Universe ${universe})`,
              `灯具 "${fixture.name}" (地址 ${fixture.dmxStartAddress}-${fixtureEnd}) ` +
              `与灯具 "${otherFixture.name}" (地址 ${otherStart}-${otherEnd}) ` +
              `在地址 ${overlapStart}-${overlapEnd} 重叠`,
              [fixture.id, otherFixture.id]
            )
          );
        }
        
        if (otherStart > fixtureEnd) {
          break;
        }
      }
    }
  }
  
  return issues;
}

export function checkPowerOverload(
  fixtures: Fixture[],
  circuits: Circuit[],
  projectId: string
): Array<Omit<Issue, 'id' | 'createdAt'>> {
  const issues: Array<Omit<Issue, 'id' | 'createdAt'>> = [];
  
  const circuitMap = new Map(circuits.map(c => [c.name, c]));
  const circuitPowerMap = new Map<string, { circuit: Circuit; fixtures: Fixture[]; totalPower: number }>();
  
  for (const fixture of fixtures) {
    if (fixture.circuitId) {
      const circuitName = fixture.circuitId;
      const circuit = circuitMap.get(circuitName);
      
      if (!circuitPowerMap.has(circuitName)) {
        circuitPowerMap.set(circuitName, {
          circuit: circuit || {
            id: '',
            projectId,
            name: circuitName,
            maxPower: 2000,
            description: '',
            note: null,
          },
          fixtures: [],
          totalPower: 0,
        });
      }
      
      const entry = circuitPowerMap.get(circuitName)!;
      entry.fixtures.push(fixture);
      entry.totalPower += fixture.power;
    }
  }
  
  for (const [circuitName, entry] of circuitPowerMap) {
    const { circuit, fixtures: circuitFixtures, totalPower } = entry;
    const maxPower = circuit.maxPower;
    
    if (totalPower > maxPower) {
      const fixtureNames = circuitFixtures.map(f => `"${f.name}"(${f.power}W)`).join(', ');
      
      issues.push(
        createIssue(
          projectId,
          'power_overload',
          'critical',
          `回路功率超载: ${circuitName}`,
          `回路 "${circuitName}" 最大容量 ${maxPower}W，当前灯具总功率 ${totalPower}W，超载 ${totalPower - maxPower}W。` +
          `涉及灯具: ${fixtureNames}`,
          circuitFixtures.map(f => f.id)
        )
      );
    }
  }
  
  for (const fixture of fixtures) {
    if (!fixture.circuitId || fixture.circuitId.trim() === '') {
      issues.push(
        createIssue(
          projectId,
          'power_overload',
          'warning',
          `灯具未分配回路: ${fixture.name}`,
          `灯具 "${fixture.name}" (功率 ${fixture.power}W) 未分配到任何电源回路，` +
          `无法进行功率校验。请确认该灯具的供电回路。`,
          [fixture.id]
        )
      );
    } else if (!circuitMap.has(fixture.circuitId)) {
      issues.push(
        createIssue(
          projectId,
          'power_overload',
          'warning',
          `灯具回路不存在: ${fixture.name}`,
          `灯具 "${fixture.name}" 分配到回路 "${fixture.circuitId}"，` +
          `但该回路未在场地方提供的回路列表中。`,
          [fixture.id]
        )
      );
    }
  }
  
  return issues;
}

export function checkMissingMedia(
  cues: Cue[],
  mediaFiles: MediaFile[],
  projectId: string
): Array<Omit<Issue, 'id' | 'createdAt'>> {
  const issues: Array<Omit<Issue, 'id' | 'createdAt'>> = [];
  
  const mediaNames = new Set(mediaFiles.map(m => m.name.toLowerCase()));
  const mediaPaths = new Set(mediaFiles.map(m => m.path.toLowerCase()));
  
  const missingMediaMap = new Map<string, string[]>();
  
  for (const cue of cues) {
    for (const mediaRef of cue.mediaReferences) {
      const refLower = mediaRef.toLowerCase();
      const exists = mediaNames.has(refLower) || mediaPaths.has(refLower);
      
      if (!exists) {
        if (!missingMediaMap.has(mediaRef)) {
          missingMediaMap.set(mediaRef, []);
        }
        missingMediaMap.get(mediaRef)!.push(`Cue ${cue.cueNumber}: ${cue.name}`);
      }
    }
  }
  
  for (const [mediaName, cueReferences] of missingMediaMap) {
    issues.push(
      createIssue(
        projectId,
        'missing_media',
        'warning',
        `素材文件缺失: ${mediaName}`,
        `素材 "${mediaName}" 被以下 Cue 引用，但在素材文件夹中未找到：\n` +
        cueReferences.map((ref, i) => `${i + 1}. ${ref}`).join('\n'),
        []
      )
    );
  }
  
  const allReferencedMedia = new Set<string>();
  for (const cue of cues) {
    for (const ref of cue.mediaReferences) {
      allReferencedMedia.add(ref.toLowerCase());
    }
  }
  
  const unreferencedMedia = mediaFiles.filter(
    m => !allReferencedMedia.has(m.name.toLowerCase()) && !allReferencedMedia.has(m.path.toLowerCase())
  );
  
  if (unreferencedMedia.length > 0) {
    issues.push(
      createIssue(
        projectId,
        'missing_media',
        'info',
        `存在未引用的素材文件`,
        `素材文件夹中有 ${unreferencedMedia.length} 个文件未被任何 Cue 引用：\n` +
        unreferencedMedia.map((m, i) => `${i + 1}. ${m.name}`).join('\n'),
        []
      )
    );
  }
  
  return issues;
}

export function checkBannedDevices(
  fixtures: Fixture[],
  bannedDevices: BannedDevice[],
  projectId: string
): Array<Omit<Issue, 'id' | 'createdAt'>> {
  const issues: Array<Omit<Issue, 'id' | 'createdAt'>> = [];
  
  if (bannedDevices.length === 0) {
    return issues;
  }
  
  const bannedNames = bannedDevices.map(d => ({
    name: d.name.toLowerCase(),
    original: d.name,
    reason: d.reason,
  }));
  
  for (const fixture of fixtures) {
    const fixtureNameLower = fixture.name.toLowerCase();
    const fixtureTypeLower = (fixture.type || '').toLowerCase();
    
    for (const banned of bannedNames) {
      if (
        fixtureNameLower.includes(banned.name) ||
        fixtureTypeLower.includes(banned.name) ||
        banned.name.includes(fixtureNameLower)
      ) {
        issues.push(
          createIssue(
            projectId,
            'banned_device',
            'critical',
            `检测到场地禁用设备: ${fixture.name}`,
            `灯具 "${fixture.name}" (类型: ${fixture.type || '未知'}) ` +
            `匹配到场地禁用设备列表中的 "${banned.original}"。` +
            (banned.reason ? ` 禁用原因: ${banned.reason}` : ''),
            [fixture.id]
          )
        );
        break;
      }
    }
  }
  
  return issues;
}

export function runAllValidations(
  projectId: string,
  fixtures: Fixture[],
  cues: Cue[],
  circuits: Circuit[],
  mediaFiles: MediaFile[],
  bannedDevices: BannedDevice[]
): ValidationResult {
  const allIssues: Array<Omit<Issue, 'id' | 'createdAt'>> = [];
  
  allIssues.push(...checkDmxConflicts(fixtures, projectId));
  allIssues.push(...checkPowerOverload(fixtures, circuits, projectId));
  allIssues.push(...checkMissingMedia(cues, mediaFiles, projectId));
  allIssues.push(...checkBannedDevices(fixtures, bannedDevices, projectId));
  
  const summary = {
    total: allIssues.length,
    critical: allIssues.filter(i => i.severity === 'critical').length,
    warning: allIssues.filter(i => i.severity === 'warning').length,
    info: allIssues.filter(i => i.severity === 'info').length,
  };
  
  return {
    issues: allIssues,
    summary,
  };
}
