import fs from 'fs';
import path from 'path';

const VERSION = '1.0.0';

export function createProject(projectName, options = {}) {
  const {
    outputDir = process.cwd(),
    metadata = {}
  } = options;
  
  const project = {
    version: VERSION,
    name: projectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      description: '',
      episodeNumber: '',
      publishDate: '',
      ...metadata
    },
    sources: {
      wav: null,
      clipsCsv: null,
      subtitlesSrt: null,
      adSchedule: null
    },
    timeline: null,
    loudnessAnalysis: null,
    issues: {
      audio: [],
      rules: [],
      resolved: []
    },
    corrections: []
  };
  
  return project;
}

export function saveProject(project, filePath) {
  project.updatedAt = new Date().toISOString();
  
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const jsonContent = JSON.stringify(project, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf8');
  
  return filePath;
}

export function loadProject(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`项目文件不存在: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const project = JSON.parse(content);
  
  if (!project.version) {
    project.version = VERSION;
  }
  
  return project;
}

export function updateProjectSources(project, sources) {
  project.sources = {
    ...project.sources,
    ...sources
  };
  project.updatedAt = new Date().toISOString();
  return project;
}

export function updateProjectTimeline(project, timeline) {
  project.timeline = timeline;
  project.updatedAt = new Date().toISOString();
  return project;
}

export function updateProjectLoudness(project, loudnessAnalysis) {
  project.loudnessAnalysis = {
    ...loudnessAnalysis,
    loudnessMoments: undefined
  };
  project.updatedAt = new Date().toISOString();
  return project;
}

export function updateProjectIssues(project, audioIssues, ruleIssues) {
  if (audioIssues) {
    project.issues.audio = audioIssues.issues || audioIssues;
  }
  if (ruleIssues) {
    project.issues.rules = ruleIssues.issues || ruleIssues;
  }
  project.updatedAt = new Date().toISOString();
  return project;
}

export function addCorrection(project, correction) {
  const correctionRecord = {
    id: `corr_${Date.now()}`,
    ...correction,
    createdAt: new Date().toISOString()
  };
  
  project.corrections.push(correctionRecord);
  project.updatedAt = new Date().toISOString();
  
  return correctionRecord;
}

export function resolveIssue(project, issueId, resolution = {}) {
  const allIssues = [
    ...(project.issues.audio || []),
    ...(project.issues.rules || [])
  ];
  
  const issue = allIssues.find(i => i.id === issueId);
  
  if (issue) {
    issue.resolved = true;
    issue.resolvedAt = new Date().toISOString();
    issue.resolution = resolution;
    
    project.issues.resolved.push({
      ...issue,
      resolution
    });
    
    project.issues.audio = (project.issues.audio || []).filter(i => i.id !== issueId);
    project.issues.rules = (project.issues.rules || []).filter(i => i.id !== issueId);
    
    project.updatedAt = new Date().toISOString();
  }
  
  return issue;
}

export function getProjectStats(project) {
  const allIssues = [
    ...(project.issues.audio || []),
    ...(project.issues.rules || [])
  ];
  
  return {
    projectName: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    sources: {
      hasWav: !!project.sources.wav,
      hasClips: !!project.sources.clipsCsv,
      hasSubtitles: !!project.sources.subtitlesSrt,
      hasAds: !!project.sources.adSchedule
    },
    timeline: project.timeline ? {
      totalClips: project.timeline.clips?.length || 0,
      totalSubtitles: project.timeline.subtitles?.length || 0,
      totalAds: project.timeline.ads?.length || 0,
      totalChapters: project.timeline.chapters?.length || 0,
      totalDuration: project.timeline.totalDuration
    } : null,
    issues: {
      total: allIssues.length,
      audio: (project.issues.audio || []).length,
      rules: (project.issues.rules || []).length,
      resolved: (project.issues.resolved || []).length
    },
    corrections: (project.corrections || []).length
  };
}

export function listProjects(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  
  const files = fs.readdirSync(dirPath);
  const projects = [];
  
  for (const file of files) {
    if (file.endsWith('.pts.json')) {
      try {
        const filePath = path.join(dirPath, file);
        const project = loadProject(filePath);
        projects.push({
          name: project.name,
          file: filePath,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          stats: getProjectStats(project)
        });
      } catch (e) {
        console.warn(`无法加载项目文件 ${file}:`, e.message);
      }
    }
  }
  
  return projects.sort((a, b) => 
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );
}
