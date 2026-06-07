const storage = require('./storage');

const ANNOTATION_STATUS = {
  PENDING_REVIEW: 'pending_review',
  NEEDS_MORE_INFO: 'needs_more_info',
  CONFIRMED: 'confirmed',
  FLAGGED: 'flagged',
};

const NEXT_ACTION = {
  ASK_MUSIC_TEACHER: 'ask_music_teacher',
  ASK_AMEI: 'ask_amei',
  WAIT_LICENSE: 'wait_license',
  OK_READY: 'ok_ready',
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function importLicenses(licenseList) {
  const licenses = storage.getLicenses();
  const songs = storage.getSongs();
  const annotations = storage.getAnnotations();
  const imported = [];

  for (const item of licenseList) {
    const licenseId = generateId();
    const license = {
      id: licenseId,
      copyrightName: item.copyrightName,
      copyrightOwner: item.copyrightOwner || '未知',
      validFrom: item.validFrom,
      validTo: item.validTo,
      territory: item.territory || '中国大陆',
      importedAt: new Date().toISOString(),
      source: 'license_page',
    };
    licenses.push(license);

    let songId;
    const existingSong = songs.find(s => s.copyrightName === item.copyrightName);
    if (existingSong) {
      songId = existingSong.id;
      existingSong.licenseIds = existingSong.licenseIds || [];
      if (!existingSong.licenseIds.includes(licenseId)) {
        existingSong.licenseIds.push(licenseId);
      }
    } else {
      songId = generateId();
      songs.push({
        id: songId,
        liveName: null,
        copyrightName: item.copyrightName,
        licenseIds: [licenseId],
        engineerNoteIds: [],
      });
    }

    const annotationId = generateId();
    annotations.push({
      id: annotationId,
      songId,
      status: ANNOTATION_STATUS.PENDING_REVIEW,
      hasNameConflict: false,
      missingMaterials: ['未关联现场演出名称'],
      nextAction: NEXT_ACTION.ASK_AMEI,
      reason: '刚从授权期限页导入，版权名已登记，但还没对上现场叫什么名字',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewedBy: null,
    });

    imported.push({ songId, licenseId, annotationId });
  }

  storage.saveLicenses(licenses);
  storage.saveSongs(songs);
  storage.saveAnnotations(annotations);
  return imported;
}

function importEngineerNotes(noteList) {
  const notes = storage.getEngineerNotes();
  const songs = storage.getSongs();
  const annotations = storage.getAnnotations();
  const imported = [];

  for (const item of noteList) {
    const noteId = generateId();
    const note = {
      id: noteId,
      liveName: item.liveName,
      engineerName: item.engineerName || '调音师',
      noteText: item.noteText,
      venue: item.venue || '未知场地',
      date: item.date,
      createdAt: new Date().toISOString(),
      source: 'engineer_message',
    };
    notes.push(note);

    let songId;
    let hasConflict = false;
    const existingByLive = songs.find(s => s.liveName === item.liveName);
    const existingByNoteRef = item.copyrightName
      ? songs.find(s => s.copyrightName === item.copyrightName)
      : null;

    if (existingByNoteRef) {
      songId = existingByNoteRef.id;
      if (!existingByNoteRef.liveName) {
        existingByNoteRef.liveName = item.liveName;
      } else if (existingByNoteRef.liveName !== item.liveName) {
        hasConflict = true;
      }
      existingByNoteRef.engineerNoteIds = existingByNoteRef.engineerNoteIds || [];
      if (!existingByNoteRef.engineerNoteIds.includes(noteId)) {
        existingByNoteRef.engineerNoteIds.push(noteId);
      }
    } else if (existingByLive) {
      songId = existingByLive.id;
      existingByLive.engineerNoteIds = existingByLive.engineerNoteIds || [];
      if (!existingByLive.engineerNoteIds.includes(noteId)) {
        existingByLive.engineerNoteIds.push(noteId);
      }
    } else {
      songId = generateId();
      songs.push({
        id: songId,
        liveName: item.liveName,
        copyrightName: item.copyrightName || null,
        licenseIds: [],
        engineerNoteIds: [noteId],
      });
    }

    let anno = annotations.find(a => a.songId === songId);
    if (!anno) {
      anno = {
        id: generateId(),
        songId,
        status: ANNOTATION_STATUS.PENDING_REVIEW,
        hasNameConflict: false,
        missingMaterials: [],
        nextAction: NEXT_ACTION.ASK_MUSIC_TEACHER,
        reason: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewedBy: null,
      };
      annotations.push(anno);
    }

    const song = songs.find(s => s.id === songId);
    if (song.liveName) {
      anno.missingMaterials = anno.missingMaterials.filter(m => m !== '未关联现场演出名称');
    }
    if (song.liveName && song.copyrightName && song.liveName !== song.copyrightName) {
      hasConflict = true;
      anno.hasNameConflict = true;
      anno.status = ANNOTATION_STATUS.FLAGGED;
      anno.reason = '同一首歌出现两个名字：现场叫"' + song.liveName + '"，版权登记是"' + song.copyrightName + '"。先别归正常，留给音乐老师确认是不是同一首。';
      anno.nextAction = NEXT_ACTION.ASK_MUSIC_TEACHER;
      if (!anno.missingMaterials.includes('音乐老师确认曲名一致性')) {
        anno.missingMaterials.push('音乐老师确认曲名一致性');
      }
    } else if (song.copyrightName) {
      anno.missingMaterials = anno.missingMaterials.filter(m => m !== '未关联现场演出名称');
      if (anno.missingMaterials.length === 0 && !anno.hasNameConflict) {
        anno.status = ANNOTATION_STATUS.CONFIRMED;
        anno.nextAction = NEXT_ACTION.OK_READY;
        anno.reason = '版权名和现场名已对上，授权期限有效，可以用';
      }
    }
    anno.updatedAt = new Date().toISOString();

    imported.push({ songId, noteId, annotationId: anno.id, hasConflict });
  }

  storage.saveEngineerNotes(notes);
  storage.saveSongs(songs);
  storage.saveAnnotations(annotations);
  return imported;
}

function getAnnotationDetail(annotationId) {
  const annotations = storage.getAnnotations();
  const songs = storage.getSongs();
  const licenses = storage.getLicenses();
  const notes = storage.getEngineerNotes();

  const anno = annotations.find(a => a.id === annotationId);
  if (!anno) return null;

  const song = songs.find(s => s.id === anno.songId);
  const songLicenses = licenses.filter(l => song.licenseIds.includes(l.id));
  const songNotes = notes.filter(n => song.engineerNoteIds.includes(n.id));

  return {
    annotation: anno,
    song,
    licenses: songLicenses,
    engineerNotes: songNotes,
  };
}

function listAnnotations(status) {
  const annotations = storage.getAnnotations();
  const songs = storage.getSongs();
  const results = [];

  for (const anno of annotations) {
    if (status && anno.status !== status) continue;
    const song = songs.find(s => s.id === anno.songId);
    results.push({
      ...anno,
      liveName: song ? song.liveName : null,
      copyrightName: song ? song.copyrightName : null,
    });
  }
  return results;
}

function reviewAnnotation(annotationId, reviewer, decision, feedback) {
  const annotations = storage.getAnnotations();
  const anno = annotations.find(a => a.id === annotationId);
  if (!anno) return null;

  anno.reviewedBy = reviewer;
  anno.updatedAt = new Date().toISOString();

  if (decision === 'confirm_same_song') {
    anno.status = ANNOTATION_STATUS.CONFIRMED;
    anno.hasNameConflict = false;
    anno.nextAction = NEXT_ACTION.OK_READY;
    anno.reason = (feedback || '音乐老师复核确认') + '：现场名和版权名确实是同一首歌，即兴段落标注有效';
    anno.missingMaterials = anno.missingMaterials.filter(m => m !== '音乐老师确认曲名一致性');
  } else if (decision === 'need_more_info') {
    anno.status = ANNOTATION_STATUS.NEEDS_MORE_INFO;
    anno.nextAction = NEXT_ACTION.ASK_AMEI;
    anno.reason = feedback || '信息不足，需要巡演统筹再补材料';
  } else if (decision === 'different_songs') {
    anno.status = ANNOTATION_STATUS.FLAGGED;
    anno.nextAction = NEXT_ACTION.ASK_AMEI;
    anno.reason = feedback || '音乐老师说这是两首不同的歌，需要拆分处理';
    if (!anno.missingMaterials.includes('拆分成两首独立的曲目')) {
      anno.missingMaterials.push('拆分成两首独立的曲目');
    }
  }

  storage.saveAnnotations(annotations);
  return anno;
}

function getWeeklyReport() {
  const annotations = storage.getAnnotations();
  const songs = storage.getSongs();
  const licenses = storage.getLicenses();

  const total = annotations.length;
  const pending = annotations.filter(a => a.status === ANNOTATION_STATUS.PENDING_REVIEW).length;
  const flagged = annotations.filter(a => a.status === ANNOTATION_STATUS.FLAGGED).length;
  const confirmed = annotations.filter(a => a.status === ANNOTATION_STATUS.CONFIRMED).length;
  const needsInfo = annotations.filter(a => a.status === ANNOTATION_STATUS.NEEDS_MORE_INFO).length;
  const hasConflict = annotations.filter(a => a.hasNameConflict).length;

  const flaggedItems = [];
  for (const anno of annotations) {
    if (anno.status === ANNOTATION_STATUS.FLAGGED || anno.hasNameConflict) {
      const song = songs.find(s => s.id === anno.songId);
      const songLicenses = licenses.filter(l => song.licenseIds.includes(l.id));
      flaggedItems.push({
        annotationId: anno.id,
        liveName: song ? song.liveName : '未知',
        copyrightName: song ? song.copyrightName : '未知',
        reason: anno.reason,
        missingMaterials: anno.missingMaterials,
        nextAction: anno.nextAction,
        licenses: songLicenses.map(l => ({
          owner: l.copyrightOwner,
          validTo: l.validTo,
        })),
      });
    }
  }

  const askTeacher = annotations.filter(a => a.nextAction === NEXT_ACTION.ASK_MUSIC_TEACHER).length;
  const askAmei = annotations.filter(a => a.nextAction === NEXT_ACTION.ASK_AMEI).length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total,
      confirmed,
      pending,
      flagged,
      needsInfo,
      hasNameConflict: hasConflict,
      nextActionBreakdown: {
        askMusicTeacher: askTeacher,
        askAmei: askAmei,
        ready: confirmed,
      },
    },
    flaggedItems,
    notes: [
      '标红的是现场名和版权名对不上的，先别急着过，留给音乐老师听一下',
      '缺材料的已经列出来了，该找阿梅补授权、找老师确认的都标了下一步',
    ],
  };
}

module.exports = {
  ANNOTATION_STATUS,
  NEXT_ACTION,
  importLicenses,
  importEngineerNotes,
  getAnnotationDetail,
  listAnnotations,
  reviewAnnotation,
  getWeeklyReport,
};
