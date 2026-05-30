const VOCAL_PARTS = {
  soprano: { label: '女高', color: '#ff7eb3', freqRange: [262, 1047] },
  alto: { label: '女低', color: '#7ec8ff', freqRange: [175, 698] },
  tenor: { label: '男高', color: '#7eff8e', freqRange: [131, 523] },
  bass: { label: '男低', color: '#ffcc7e', freqRange: [87, 349] }
};

const MIC_TYPES = {
  cardioid: { label: '心形', icon: '🎙️', sensitivity: 0.7, backAttenuation: 0.1 },
  omni: { label: '全指向', icon: '🔊', sensitivity: 1.0, backAttenuation: 1.0 },
  figure8: { label: '8字形', icon: '♾️', sensitivity: 0.8, backAttenuation: 0.8 }
};

const OVERLAP_THRESHOLD = 0.5;
const MIC_REVERSE_THRESHOLD = Math.PI / 2;

let _idCounter = 0;
function genId(prefix) {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}

class DataManager {
  constructor() {
    this.formations = new Map();
    this.currentFormationId = null;
    this.history = [];
    this.errors = [];
    this.listeners = new Set();
    this._localStorageKey = 'choir_soundfield_data';
  }

  addListener(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(event) {
    for (const fn of this.listeners) {
      try { fn(event); } catch (e) { console.error('Listener error:', e); }
    }
  }

  _getCurrent() {
    if (!this.currentFormationId) return null;
    return this.formations.get(this.currentFormationId) || null;
  }

  createFormation(name) {
    const id = genId('fmt');
    const formation = {
      id,
      name: name || `方案 ${this.formations.size + 1}`,
      members: new Map(),
      microphones: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.formations.set(id, formation);
    this.currentFormationId = id;
    this._emit({ type: 'formation-created', formationId: id });
    this._saveToStorage();
    return id;
  }

  deleteFormation(id) {
    if (!this.formations.has(id)) return false;
    this.formations.delete(id);
    if (this.currentFormationId === id) {
      const keys = [...this.formations.keys()];
      this.currentFormationId = keys.length > 0 ? keys[0] : null;
    }
    this._emit({ type: 'formation-deleted', formationId: id });
    this._saveToStorage();
    return true;
  }

  switchFormation(id) {
    if (!this.formations.has(id)) return false;
    this.currentFormationId = id;
    this._emit({ type: 'formation-switched', formationId: id });
    return true;
  }

  renameFormation(id, name) {
    const f = this.formations.get(id);
    if (!f) return;
    f.name = name;
    f.updatedAt = Date.now();
    this._emit({ type: 'formation-renamed', formationId: id });
    this._saveToStorage();
  }

  addMember(memberData, source) {
    const f = this._getCurrent();
    if (!f) return null;
    const errors = this._validateMember(memberData, source);
    const id = memberData.id || genId('mbr');
    const member = {
      id,
      name: memberData.name || `成员${f.members.size + 1}`,
      vocalPart: memberData.vocalPart || 'soprano',
      position: {
        x: memberData.position?.x ?? 0,
        y: memberData.position?.y ?? 0,
        z: memberData.position?.z ?? 0
      },
      source: source || null
    };
    if (errors.length > 0) {
      for (const err of errors) {
        this._addError(err);
      }
    }
    f.members.set(id, member);
    f.updatedAt = Date.now();
    this._emit({ type: 'member-added', memberId: id, member });
    this._saveToStorage();
    return member;
  }

  updateMemberPosition(memberId, newPosition, isManual) {
    const f = this._getCurrent();
    if (!f) return;
    const member = f.members.get(memberId);
    if (!member) return;
    const oldPos = { ...member.position };
    member.position = { ...newPosition };
    f.updatedAt = Date.now();
    if (isManual) {
      this._addHistory({
        type: 'member-move',
        objectId: memberId,
        objectName: member.name,
        objectType: 'member',
        oldPosition: oldPos,
        newPosition: { ...newPosition }
      });
    }
    this._emit({ type: 'member-updated', memberId, member });
    this._saveToStorage();
  }

  removeMember(memberId) {
    const f = this._getCurrent();
    if (!f) return;
    const member = f.members.get(memberId);
    if (!member) return;
    f.members.delete(memberId);
    f.updatedAt = Date.now();
    this._addHistory({
      type: 'member-remove',
      objectId: memberId,
      objectName: member.name,
      objectType: 'member',
      oldPosition: { ...member.position }
    });
    this._emit({ type: 'member-removed', memberId });
    this._saveToStorage();
  }

  addMicrophone(micData, source) {
    const f = this._getCurrent();
    if (!f) return null;
    const errors = this._validateMic(micData, source);
    const id = micData.id || genId('mic');
    const mic = {
      id,
      name: micData.name || `麦克风${f.microphones.size + 1}`,
      position: {
        x: micData.position?.x ?? 0,
        y: micData.position?.y ?? 0,
        z: micData.position?.z ?? 2
      },
      direction: {
        x: micData.direction?.x ?? 0,
        y: micData.direction?.y ?? 0,
        z: micData.direction?.z ?? -1
      },
      type: micData.type || 'cardioid',
      source: source || null
    };
    if (errors.length > 0) {
      for (const err of errors) {
        this._addError(err);
      }
    }
    f.microphones.set(id, mic);
    f.updatedAt = Date.now();
    this._emit({ type: 'mic-added', micId: id, mic });
    this._saveToStorage();
    return mic;
  }

  updateMicrophonePosition(micId, newPosition, newDirection, isManual) {
    const f = this._getCurrent();
    if (!f) return;
    const mic = f.microphones.get(micId);
    if (!mic) return;
    const oldPos = { ...mic.position };
    const oldDir = { ...mic.direction };
    mic.position = { ...newPosition };
    if (newDirection) mic.direction = { ...newDirection };
    f.updatedAt = Date.now();
    if (isManual) {
      this._addHistory({
        type: 'mic-move',
        objectId: micId,
        objectName: mic.name,
        objectType: 'mic',
        oldPosition: oldPos,
        newPosition: { ...newPosition },
        oldDirection: oldDir,
        newDirection: { ...mic.direction }
      });
    }
    this._emit({ type: 'mic-updated', micId, mic });
    this._saveToStorage();
  }

  removeMicrophone(micId) {
    const f = this._getCurrent();
    if (!f) return;
    const mic = f.microphones.get(micId);
    if (!mic) return;
    f.microphones.delete(micId);
    f.updatedAt = Date.now();
    this._addHistory({
      type: 'mic-remove',
      objectId: micId,
      objectName: mic.name,
      objectType: 'mic',
      oldPosition: { ...mic.position }
    });
    this._emit({ type: 'mic-removed', micId });
    this._saveToStorage();
  }

  importMembers(dataArray, source) {
    const f = this._getCurrent();
    if (!f) return { added: 0, skipped: 0, errors: [] };
    let added = 0;
    let skipped = 0;
    const allErrors = [];
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      const itemSource = `${source} #${i + 1}`;
      try {
        if (item.id && f.members.has(item.id)) {
          skipped++;
          allErrors.push({
            level: 'warning',
            code: 'DUPLICATE_MEMBER',
            message: `成员ID "${item.id}" 已存在，跳过覆盖`,
            source: itemSource,
            objectId: item.id
          });
          continue;
        }
        this.addMember(item, itemSource);
        added++;
      } catch (e) {
        allErrors.push({
          level: 'error',
          code: 'IMPORT_MEMBER_FAILED',
          message: `导入成员失败: ${e.message}`,
          source: itemSource,
          rawLine: JSON.stringify(item)
        });
      }
    }
    for (const err of allErrors) {
      this._addError(err);
    }
    return { added, skipped, errors: allErrors };
  }

  importMicrophones(dataArray, source) {
    const f = this._getCurrent();
    if (!f) return { added: 0, skipped: 0, errors: [] };
    let added = 0;
    let skipped = 0;
    const allErrors = [];
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      const itemSource = `${source} #${i + 1}`;
      try {
        if (item.id && f.microphones.has(item.id)) {
          skipped++;
          allErrors.push({
            level: 'warning',
            code: 'DUPLICATE_MIC',
            message: `麦克风ID "${item.id}" 已存在，跳过覆盖`,
            source: itemSource,
            objectId: item.id
          });
          continue;
        }
        this.addMicrophone(item, itemSource);
        added++;
      } catch (e) {
        allErrors.push({
          level: 'error',
          code: 'IMPORT_MIC_FAILED',
          message: `导入麦克风失败: ${e.message}`,
          source: itemSource,
          rawLine: JSON.stringify(item)
        });
      }
    }
    for (const err of allErrors) {
      this._addError(err);
    }
    return { added, skipped, errors: allErrors };
  }

  runDiagnostics() {
    const f = this._getCurrent();
    if (!f) return [];
    this.errors = [];
    this._checkVocalOverlap(f);
    this._checkMicReverse(f);
    this._emit({ type: 'diagnostics-complete', errors: this.errors });
    return this.errors;
  }

  _checkVocalOverlap(f) {
    const members = [...f.members.values()];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        if (a.vocalPart === b.vocalPart) continue;
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < OVERLAP_THRESHOLD) {
          this._addError({
            level: 'warning',
            code: 'VOCAL_OVERLAP',
            message: `声部重叠: "${a.name}"(${VOCAL_PARTS[a.vocalPart].label}) 与 "${b.name}"(${VOCAL_PARTS[b.vocalPart].label}) 距离仅 ${dist.toFixed(2)}m`,
            source: `${a.source || '手动添加'} / ${b.source || '手动添加'}`,
            objectId: `${a.id}+${b.id}`,
            rawLine: `距离=${dist.toFixed(3)} 阈值=${OVERLAP_THRESHOLD}`
          });
        }
      }
    }
  }

  _checkMicReverse(f) {
    const members = [...f.members.values()];
    for (const mic of f.microphones.values()) {
      if (mic.type === 'omni') continue;
      const dirLen = Math.sqrt(mic.direction.x ** 2 + mic.direction.z ** 2);
      if (dirLen < 0.01) {
        this._addError({
          level: 'warning',
          code: 'MIC_NO_DIRECTION',
          message: `麦克风 "${mic.name}" 方向向量接近零，无法确定朝向`,
          source: mic.source || '手动添加',
          objectId: mic.id
        });
        continue;
      }
      const dirNorm = { x: mic.direction.x / dirLen, z: mic.direction.z / dirLen };
      let closestMemberAngle = Infinity;
      let closestMember = null;
      for (const m of members) {
        const toMember = {
          x: m.position.x - mic.position.x,
          z: m.position.z - mic.position.z
        };
        const toMemberLen = Math.sqrt(toMember.x ** 2 + toMember.z ** 2);
        if (toMemberLen < 0.01) continue;
        const dot = dirNorm.x * (toMember.x / toMemberLen) + dirNorm.z * (toMember.z / toMemberLen);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
        if (angle < closestMemberAngle) {
          closestMemberAngle = angle;
          closestMember = m;
        }
      }
      if (closestMember && closestMemberAngle > MIC_REVERSE_THRESHOLD) {
        this._addError({
          level: 'error',
          code: 'MIC_REVERSE',
          message: `麦克风 "${mic.name}" 朝向偏离最近成员 "${closestMember.name}" 超过 ${(MIC_REVERSE_THRESHOLD * 180 / Math.PI).toFixed(0)}° (实际 ${(closestMemberAngle * 180 / Math.PI).toFixed(0)}°)，收音方向可能反转`,
          source: mic.source || '手动添加',
          objectId: mic.id,
          rawLine: `角度=${(closestMemberAngle * 180 / Math.PI).toFixed(1)}° 阈值=${(MIC_REVERSE_THRESHOLD * 180 / Math.PI).toFixed(0)}°`
        });
      }
    }
  }

  _validateMember(data, source) {
    const errors = [];
    if (data.vocalPart && !VOCAL_PARTS[data.vocalPart]) {
      errors.push({
        level: 'error',
        code: 'INVALID_VOCAL_PART',
        message: `成员 "${data.name || '未知'}" 的声部 "${data.vocalPart}" 无效，应为 soprano/alto/tenor/bass`,
        source: source || '未知来源',
        rawLine: `vocalPart=${data.vocalPart}`
      });
    }
    if (data.position) {
      if (typeof data.position.x !== 'number' || typeof data.position.z !== 'number') {
        errors.push({
          level: 'error',
          code: 'INVALID_POSITION',
          message: `成员 "${data.name || '未知'}" 的位置数据无效 (x/z 应为数字)`,
          source: source || '未知来源',
          rawLine: `position=${JSON.stringify(data.position)}`
        });
      }
    }
    return errors;
  }

  _validateMic(data, source) {
    const errors = [];
    if (data.type && !MIC_TYPES[data.type]) {
      errors.push({
        level: 'error',
        code: 'INVALID_MIC_TYPE',
        message: `麦克风 "${data.name || '未知'}" 的类型 "${data.type}" 无效，应为 cardioid/omni/figure8`,
        source: source || '未知来源',
        rawLine: `type=${data.type}`
      });
    }
    if (data.direction) {
      const dirLen = Math.sqrt((data.direction.x || 0) ** 2 + (data.direction.y || 0) ** 2 + (data.direction.z || 0) ** 2);
      if (dirLen < 0.001) {
        errors.push({
          level: 'warning',
          code: 'ZERO_DIRECTION',
          message: `麦克风 "${data.name || '未知'}" 的方向向量为零`,
          source: source || '未知来源',
          rawLine: `direction=${JSON.stringify(data.direction)}`
        });
      }
    }
    return errors;
  }

  _addError(error) {
    const full = {
      id: genId('err'),
      timestamp: Date.now(),
      ...error
    };
    this.errors.push(full);
    this._emit({ type: 'error-added', error: full });
  }

  _addHistory(entry) {
    const full = {
      id: genId('hst'),
      timestamp: Date.now(),
      ...entry
    };
    this.history.push(full);
    this._emit({ type: 'history-added', entry: full });
  }

  clearHistory() {
    this.history = [];
    this._emit({ type: 'history-cleared' });
  }

  getErrors() { return this.errors; }
  getHistory() { return this.history; }
  getCurrentFormation() { return this._getCurrent(); }

  _saveToStorage() {
    try {
      const data = {
        formations: [],
        currentFormationId: this.currentFormationId
      };
      for (const [id, f] of this.formations) {
        data.formations.push({
          id: f.id,
          name: f.name,
          members: [...f.members.values()],
          microphones: [...f.microphones.values()],
          createdAt: f.createdAt,
          updatedAt: f.updatedAt
        });
      }
      localStorage.setItem(this._localStorageKey, JSON.stringify(data));
    } catch (e) {
      this._addError({
        level: 'error',
        code: 'SAVE_FAILED',
        message: `站位保存失败: ${e.message}`,
        source: 'localStorage'
      });
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(this._localStorageKey);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.formations.clear();
      for (const fd of data.formations) {
        const formation = {
          id: fd.id,
          name: fd.name,
          members: new Map(),
          microphones: new Map(),
          createdAt: fd.createdAt,
          updatedAt: fd.updatedAt
        };
        if (fd.members) {
          for (const m of fd.members) {
            formation.members.set(m.id, m);
          }
        }
        if (fd.microphones) {
          for (const mic of fd.microphones) {
            formation.microphones.set(mic.id, mic);
          }
        }
        this.formations.set(fd.id, formation);
      }
      this.currentFormationId = data.currentFormationId;
      if (this.currentFormationId && !this.formations.has(this.currentFormationId)) {
        const keys = [...this.formations.keys()];
        this.currentFormationId = keys.length > 0 ? keys[0] : null;
      }
      this._emit({ type: 'data-loaded' });
      return true;
    } catch (e) {
      this._addError({
        level: 'error',
        code: 'LOAD_FAILED',
        message: `站位数据加载失败: ${e.message}`,
        source: 'localStorage',
        rawLine: e.stack?.split('\n')[0] || ''
      });
      return false;
    }
  }
}

export { DataManager, VOCAL_PARTS, MIC_TYPES, genId };
