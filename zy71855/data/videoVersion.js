const crypto = require('crypto');
const { readJsonFile, writeJsonFile } = require('./models');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getVideoVersions() {
  return readJsonFile('videoVersions.json', {});
}

function saveVideoVersions(versions) {
  writeJsonFile('videoVersions.json', versions);
}

function calculateVideoHash(videoInfo) {
  const content = JSON.stringify({
    name: videoInfo.name,
    duration: videoInfo.duration,
    fileSize: videoInfo.fileSize,
    stepDescriptions: videoInfo.stepDescriptions || []
  });
  return crypto.createHash('md5').update(content).digest('hex');
}

function compareVideoVersions(oldVersion, newVersion) {
  const changes = [];
  
  if (oldVersion.name !== newVersion.name) {
    changes.push({
      type: 'name',
      old: oldVersion.name,
      new: newVersion.name,
      message: `视频名称从「${oldVersion.name}」改成了「${newVersion.name}」`
    });
  }
  
  if (oldVersion.duration !== newVersion.duration) {
    changes.push({
      type: 'duration',
      old: oldVersion.duration,
      new: newVersion.duration,
      message: `视频时长从 ${oldVersion.duration}秒 变成了 ${newVersion.duration}秒`
    });
  }
  
  const oldSteps = oldVersion.stepDescriptions || [];
  const newSteps = newVersion.stepDescriptions || [];
  
  oldSteps.forEach((oldStep, index) => {
    const newStep = newSteps[index];
    if (newStep && oldStep !== newStep) {
      changes.push({
        type: 'step',
        stepIndex: index + 1,
        old: oldStep,
        new: newStep,
        message: `第 ${index + 1} 步的描述变了：「${oldStep}」→「${newStep}」`
      });
    }
  });
  
  if (newSteps.length > oldSteps.length) {
    for (let i = oldSteps.length; i < newSteps.length; i++) {
      changes.push({
        type: 'step_added',
        stepIndex: i + 1,
        new: newSteps[i],
        message: `新增了第 ${i + 1} 步：「${newSteps[i]}」`
      });
    }
  }
  
  if (newSteps.length < oldSteps.length) {
    for (let i = newSteps.length; i < oldSteps.length; i++) {
      changes.push({
        type: 'step_removed',
        stepIndex: i + 1,
        old: oldSteps[i],
        message: `删掉了原来的第 ${i + 1} 步：「${oldSteps[i]}」`
      });
    }
  }
  
  const oldParts = oldVersion.requiredParts || [];
  const newParts = newVersion.requiredParts || [];
  
  newParts.forEach(part => {
    if (!oldParts.includes(part)) {
      changes.push({
        type: 'part_added',
        part,
        message: `新增了需要准备的零件：「${part}」`
      });
    }
  });
  
  oldParts.forEach(part => {
    if (!newParts.includes(part)) {
      changes.push({
        type: 'part_removed',
        part,
        message: `不再需要准备零件：「${part}」`
      });
    }
  });
  
  return changes;
}

function uploadVideoVersion(videoInfo, uploadedBy) {
  const versions = getVideoVersions();
  const videoId = videoInfo.videoId || generateId();
  
  const newHash = calculateVideoHash(videoInfo);
  
  if (!versions[videoId]) {
    versions[videoId] = {
      videoId,
      name: videoInfo.name,
      versions: []
    };
  }
  
  const video = versions[videoId];
  const latestVersion = video.versions[video.versions.length - 1];
  
  const newVersion = {
    versionId: generateId(),
    versionNumber: video.versions.length + 1,
    name: videoInfo.name,
    duration: videoInfo.duration,
    fileSize: videoInfo.fileSize,
    stepDescriptions: videoInfo.stepDescriptions || [],
    requiredParts: videoInfo.requiredParts || [],
    hash: newHash,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    notes: videoInfo.notes || ''
  };
  
  let changes = [];
  let isNewVersion = true;
  
  if (latestVersion) {
    if (latestVersion.hash === newHash) {
      isNewVersion = false;
      return {
        success: true,
        videoId,
        isNewVersion: false,
        message: '这个视频和最新版本一样，不需要重新上传',
        latestVersion
      };
    }
    
    changes = compareVideoVersions(latestVersion, newVersion);
    
    if (changes.length === 0) {
      isNewVersion = false;
      return {
        success: true,
        videoId,
        isNewVersion: false,
        message: '视频内容没有变化，不需要创建新版本',
        latestVersion
      };
    }
  }
  
  video.versions.push(newVersion);
  video.name = videoInfo.name;
  saveVideoVersions(versions);
  
  return {
    success: true,
    videoId,
    isNewVersion: true,
    isFirstVersion: !latestVersion,
    message: latestVersion 
      ? `已创建新版本 v${newVersion.versionNumber}，检测到 ${changes.length} 处变更`
      : `已上传第一个版本的视频`,
    newVersion,
    changes,
    changeSummary: changes.map(c => c.message)
  };
}

function getVideoVersionHistory(videoId) {
  const versions = getVideoVersions();
  const video = versions[videoId];
  
  if (!video) {
    return { success: false, message: '找不到这个视频' };
  }
  
  return {
    success: true,
    videoId,
    name: video.name,
    versions: video.versions.sort((a, b) => b.versionNumber - a.versionNumber)
  };
}

function compareTwoVersions(videoId, version1, version2) {
  const versions = getVideoVersions();
  const video = versions[videoId];
  
  if (!video) {
    return { success: false, message: '找不到这个视频' };
  }
  
  const v1 = video.versions.find(v => v.versionNumber === version1);
  const v2 = video.versions.find(v => v.versionNumber === version2);
  
  if (!v1 || !v2) {
    return { success: false, message: '找不到指定的版本' };
  }
  
  const changes = compareVideoVersions(v1, v2);
  
  return {
    success: true,
    videoId,
    fromVersion: version1,
    toVersion: version2,
    changes,
    changeSummary: changes.map(c => c.message)
  };
}

function getAllVideos() {
  const versions = getVideoVersions();
  return Object.values(versions).map(v => ({
    videoId: v.videoId,
    name: v.name,
    latestVersion: v.versions[v.versions.length - 1],
    versionCount: v.versions.length
  }));
}

module.exports = {
  uploadVideoVersion,
  getVideoVersionHistory,
  compareTwoVersions,
  getAllVideos
};
