const Papa = require('papaparse');
const { 
  REQUIRED_COLUMNS, 
  ERROR_TYPES, 
  PITCH_CENTS_THRESHOLD, 
  BEAT_MS_THRESHOLD,
  DEFAULT_INSTRUMENTS,
  DEFAULT_SECTIONS
} = require('../models');

class ValidationError extends Error {
  constructor(message, type, row = null, column = null) {
    super(message);
    this.name = 'ValidationError';
    this.type = type;
    this.row = row;
    this.column = column;
  }
}

class DataValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  reset() {
    this.errors = [];
    this.warnings = [];
  }

  addError(message, type, row = null, column = null) {
    this.errors.push({ message, type, row, column });
  }

  addWarning(message, type, row = null, column = null) {
    this.warnings.push({ message, type, row, column });
  }

  parseCSV(content) {
    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV 解析错误: ${results.errors.map(e => e.message).join(', ')}`));
          }
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  validateColumns(data, expectedColumns, tableName) {
    if (!data || data.length === 0) {
      this.addError(`${tableName} 数据为空`, 'empty_data');
      return false;
    }

    const actualColumns = Object.keys(data[0]);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
    const extraColumns = actualColumns.filter(col => !expectedColumns.includes(col));

    if (missingColumns.length > 0) {
      this.addError(
        `${tableName} 缺少必填列: ${missingColumns.join(', ')}`,
        'missing_columns',
        null,
        missingColumns
      );
      return false;
    }

    if (extraColumns.length > 0) {
      this.addWarning(
        `${tableName} 有多余列，将被忽略: ${extraColumns.join(', ')}`,
        'extra_columns',
        null,
        extraColumns
      );
    }

    return true;
  }

  validateSessions(data) {
    this.reset();
    
    if (!this.validateColumns(data, REQUIRED_COLUMNS.sessions, 'sessions')) {
      return { valid: false, errors: this.errors, warnings: this.warnings };
    }

    const sessionIds = new Set();
    
    data.forEach((row, index) => {
      const rowNum = index + 2;

      if (!row.session_id || String(row.session_id).trim() === '') {
        this.addError(`第 ${rowNum} 行: session_id 不能为空`, 'required_field', rowNum, 'session_id');
      } else {
        const sessionId = String(row.session_id).trim();
        if (sessionIds.has(sessionId)) {
          this.addError(`第 ${rowNum} 行: session_id "${sessionId}" 重复`, 'duplicate_id', rowNum, 'session_id');
        }
        sessionIds.add(sessionId);
      }

      if (!row.date || String(row.date).trim() === '') {
        this.addError(`第 ${rowNum} 行: date 不能为空`, 'required_field', rowNum, 'date');
      } else {
        const dateStr = String(row.date).trim();
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
          this.addError(
            `第 ${rowNum} 行: date 格式错误，应为 YYYY-MM-DD，当前值: ${dateStr}`,
            'invalid_format',
            rowNum,
            'date'
          );
        } else {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            this.addError(
              `第 ${rowNum} 行: date 不是有效的日期: ${dateStr}`,
              'invalid_date',
              rowNum,
              'date'
            );
          }
        }
      }
    });

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  validateSetlist(data, validSessionIds = [], validSongIds = []) {
    this.reset();
    
    if (!this.validateColumns(data, REQUIRED_COLUMNS.setlist, 'setlist')) {
      return { valid: false, errors: this.errors, warnings: this.warnings };
    }

    const sessionSet = new Set(validSessionIds);
    const songSet = new Set(validSongIds);
    const seenCombinations = new Set();
    
    data.forEach((row, index) => {
      const rowNum = index + 2;
      const sessionId = String(row.session_id || '').trim();
      const songId = String(row.song_id || '').trim();
      const combo = `${sessionId}|${songId}`;

      if (!sessionId) {
        this.addError(`第 ${rowNum} 行: session_id 不能为空`, 'required_field', rowNum, 'session_id');
      } else if (validSessionIds.length > 0 && !sessionSet.has(sessionId)) {
        this.addWarning(
          `第 ${rowNum} 行: session_id "${sessionId}" 未在 sessions 中定义`,
          'unknown_reference',
          rowNum,
          'session_id'
        );
      }

      if (!songId) {
        this.addError(`第 ${rowNum} 行: song_id 不能为空`, 'required_field', rowNum, 'song_id');
      }

      if (!row.song_name || String(row.song_name).trim() === '') {
        this.addError(`第 ${rowNum} 行: song_name 不能为空`, 'required_field', rowNum, 'song_name');
      }

      if (row.order === undefined || row.order === null || isNaN(Number(row.order))) {
        this.addError(`第 ${rowNum} 行: order 必须是数字`, 'invalid_type', rowNum, 'order');
      }

      if (seenCombinations.has(combo)) {
        this.addWarning(
          `第 ${rowNum} 行: 同一 session 中 song_id "${songId}" 重复`,
          'duplicate_entry',
          rowNum
        );
      }
      seenCombinations.add(combo);
    });

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  validateTakes(data, validSessionIds = [], validSongIds = []) {
    this.reset();
    
    if (!this.validateColumns(data, REQUIRED_COLUMNS.takes, 'takes')) {
      return { valid: false, errors: this.errors, warnings: this.warnings };
    }

    const sessionSet = new Set(validSessionIds);
    const songSet = new Set(validSongIds);
    const seenTakeIds = new Set();
    
    data.forEach((row, index) => {
      const rowNum = index + 2;
      const sessionId = String(row.session_id || '').trim();
      const songId = String(row.song_id || '').trim();
      const takeId = String(row.take_id || '').trim();

      if (!sessionId) {
        this.addError(`第 ${rowNum} 行: session_id 不能为空`, 'required_field', rowNum, 'session_id');
      } else if (validSessionIds.length > 0 && !sessionSet.has(sessionId)) {
        this.addWarning(
          `第 ${rowNum} 行: session_id "${sessionId}" 未在 sessions 中定义`,
          'unknown_reference',
          rowNum,
          'session_id'
        );
      }

      if (!songId) {
        this.addError(`第 ${rowNum} 行: song_id 不能为空`, 'required_field', rowNum, 'song_id');
      } else if (validSongIds.length > 0 && !songSet.has(songId)) {
        this.addWarning(
          `第 ${rowNum} 行: song_id "${songId}" 未在 setlist 中定义`,
          'unknown_reference',
          rowNum,
          'song_id'
        );
      }

      if (!takeId) {
        this.addError(`第 ${rowNum} 行: take_id 不能为空`, 'required_field', rowNum, 'take_id');
      } else {
        if (seenTakeIds.has(takeId)) {
          this.addError(
            `第 ${rowNum} 行: take_id "${takeId}" 重复`,
            'duplicate_id',
            rowNum,
            'take_id'
          );
        }
        seenTakeIds.add(takeId);
      }

      if (row.start_time === undefined || row.start_time === null || isNaN(Number(row.start_time))) {
        this.addError(`第 ${rowNum} 行: start_time 必须是数字（秒）`, 'invalid_type', rowNum, 'start_time');
      } else if (Number(row.start_time) < 0) {
        this.addError(`第 ${rowNum} 行: start_time 不能为负数`, 'invalid_value', rowNum, 'start_time');
      }

      if (row.end_time === undefined || row.end_time === null || isNaN(Number(row.end_time))) {
        this.addError(`第 ${rowNum} 行: end_time 必须是数字（秒）`, 'invalid_type', rowNum, 'end_time');
      } else if (Number(row.end_time) < 0) {
        this.addError(`第 ${rowNum} 行: end_time 不能为负数`, 'invalid_value', rowNum, 'end_time');
      }

      if (row.start_time !== undefined && row.end_time !== undefined && 
          !isNaN(Number(row.start_time)) && !isNaN(Number(row.end_time))) {
        if (Number(row.end_time) <= Number(row.start_time)) {
          this.addError(
            `第 ${rowNum} 行: end_time 必须大于 start_time`,
            'invalid_range',
            rowNum
          );
        }
      }

      if (!row.musician || String(row.musician).trim() === '') {
        this.addWarning(`第 ${rowNum} 行: musician 为空`, 'missing_field', rowNum, 'musician');
      }

      if (!row.instrument || String(row.instrument).trim() === '') {
        this.addWarning(`第 ${rowNum} 行: instrument 为空`, 'missing_field', rowNum, 'instrument');
      } else {
        const instrument = String(row.instrument).trim().toLowerCase();
        if (!DEFAULT_INSTRUMENTS.includes(instrument)) {
          this.addWarning(
            `第 ${rowNum} 行: instrument "${instrument}" 不是标准乐器类型`,
            'uncommon_value',
            rowNum,
            'instrument'
          );
        }
      }
    });

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  validatePitchBeat(data, validSessionIds = [], validSongIds = [], validTakeIds = []) {
    this.reset();
    
    if (!this.validateColumns(data, REQUIRED_COLUMNS.pitchBeat, 'pitch-beat')) {
      return { valid: false, errors: this.errors, warnings: this.warnings };
    }

    const sessionSet = new Set(validSessionIds);
    const songSet = new Set(validSongIds);
    const takeSet = new Set(validTakeIds);
    const validErrorTypes = new Set(Object.values(ERROR_TYPES));
    
    let previousTime = null;
    
    data.forEach((row, index) => {
      const rowNum = index + 2;
      const sessionId = String(row.session_id || '').trim();
      const songId = String(row.song_id || '').trim();
      const takeId = String(row.take_id || '').trim();

      if (!sessionId) {
        this.addError(`第 ${rowNum} 行: session_id 不能为空`, 'required_field', rowNum, 'session_id');
      } else if (validSessionIds.length > 0 && !sessionSet.has(sessionId)) {
        this.addWarning(
          `第 ${rowNum} 行: session_id "${sessionId}" 未在 sessions 中定义`,
          'unknown_reference',
          rowNum,
          'session_id'
        );
      }

      if (!songId) {
        this.addError(`第 ${rowNum} 行: song_id 不能为空`, 'required_field', rowNum, 'song_id');
      } else if (validSongIds.length > 0 && !songSet.has(songId)) {
        this.addWarning(
          `第 ${rowNum} 行: song_id "${songId}" 未在 setlist 中定义`,
          'unknown_reference',
          rowNum,
          'song_id'
        );
      }

      if (!takeId) {
        this.addError(`第 ${rowNum} 行: take_id 不能为空`, 'required_field', rowNum, 'take_id');
      } else if (validTakeIds.length > 0 && !takeSet.has(takeId)) {
        this.addWarning(
          `第 ${rowNum} 行: take_id "${takeId}" 未在 takes 中定义`,
          'unknown_reference',
          rowNum,
          'take_id'
        );
      }

      if (row.time === undefined || row.time === null || isNaN(Number(row.time))) {
        this.addError(`第 ${rowNum} 行: time 必须是数字（秒）`, 'invalid_type', rowNum, 'time');
      } else if (Number(row.time) < 0) {
        this.addError(`第 ${rowNum} 行: time 不能为负数`, 'invalid_value', rowNum, 'time');
      } else {
        const currentTime = Number(row.time);
        if (previousTime !== null && currentTime < previousTime) {
          this.addWarning(
            `第 ${rowNum} 行: time 值 (${currentTime}) 小于前一行 (${previousTime})，数据可能乱序`,
            'out_of_order',
            rowNum,
            'time'
          );
        }
        previousTime = currentTime;
      }

      if (row.pitch_cents !== undefined && row.pitch_cents !== null && row.pitch_cents !== '') {
        if (isNaN(Number(row.pitch_cents))) {
          this.addError(`第 ${rowNum} 行: pitch_cents 必须是数字`, 'invalid_type', rowNum, 'pitch_cents');
        } else {
          const cents = Math.abs(Number(row.pitch_cents));
          if (cents > PITCH_CENTS_THRESHOLD.extreme) {
            this.addWarning(
              `第 ${rowNum} 行: pitch_cents 值 (${row.pitch_cents}) 超出合理范围，可能是误检`,
              'extreme_value',
              rowNum,
              'pitch_cents'
            );
          }
        }
      }

      if (row.beat_ms !== undefined && row.beat_ms !== null && row.beat_ms !== '') {
        if (isNaN(Number(row.beat_ms))) {
          this.addError(`第 ${rowNum} 行: beat_ms 必须是数字`, 'invalid_type', rowNum, 'beat_ms');
        } else {
          const ms = Math.abs(Number(row.beat_ms));
          if (ms > BEAT_MS_THRESHOLD.extreme) {
            this.addWarning(
              `第 ${rowNum} 行: beat_ms 值 (${row.beat_ms}) 超出合理范围，可能是误检`,
              'extreme_value',
              rowNum,
              'beat_ms'
            );
          }
        }
      }

      if (row.error_type) {
        const errorType = String(row.error_type).trim().toLowerCase();
        if (!validErrorTypes.has(errorType)) {
          this.addWarning(
            `第 ${rowNum} 行: error_type "${errorType}" 不是有效值，有效值: ${Array.from(validErrorTypes).join(', ')}`,
            'invalid_enum',
            rowNum,
            'error_type'
          );
        }
      }

      if (!row.musician || String(row.musician).trim() === '') {
        this.addWarning(`第 ${rowNum} 行: musician 为空`, 'missing_field', rowNum, 'musician');
      }

      if (!row.instrument || String(row.instrument).trim() === '') {
        this.addWarning(`第 ${rowNum} 行: instrument 为空`, 'missing_field', rowNum, 'instrument');
      }

      if (!row.section || String(row.section).trim() === '') {
        this.addWarning(`第 ${rowNum} 行: section 为空`, 'missing_field', rowNum, 'section');
      } else {
        const section = String(row.section).trim().toLowerCase();
        if (!DEFAULT_SECTIONS.includes(section)) {
          this.addWarning(
            `第 ${rowNum} 行: section "${section}" 不是标准段落类型`,
            'uncommon_value',
            rowNum,
            'section'
          );
        }
      }
    });

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  validateAll(sessionsData, setlistData, takesData, pitchBeatData) {
    const results = {
      sessions: this.validateSessions(sessionsData),
      setlist: null,
      takes: null,
      pitchBeat: null,
      overall: {
        valid: true,
        totalErrors: 0,
        totalWarnings: 0
      }
    };

    const validSessionIds = sessionsData ? 
      sessionsData.filter(s => s.session_id).map(s => String(s.session_id).trim()) : [];
    
    const validSongIds = setlistData ? 
      setlistData.filter(s => s.song_id).map(s => String(s.song_id).trim()) : [];
    
    const validTakeIds = takesData ? 
      takesData.filter(t => t.take_id).map(t => String(t.take_id).trim()) : [];

    if (setlistData) {
      results.setlist = this.validateSetlist(setlistData, validSessionIds, validSongIds);
    }

    if (takesData) {
      results.takes = this.validateTakes(takesData, validSessionIds, validSongIds);
    }

    if (pitchBeatData) {
      results.pitchBeat = this.validatePitchBeat(
        pitchBeatData, 
        validSessionIds, 
        validSongIds, 
        validTakeIds
      );
    }

    results.overall.valid = 
      (results.sessions ? results.sessions.valid : true) &&
      (results.setlist ? results.setlist.valid : true) &&
      (results.takes ? results.takes.valid : true) &&
      (results.pitchBeat ? results.pitchBeat.valid : true);

    results.overall.totalErrors = 
      (results.sessions ? results.sessions.errors.length : 0) +
      (results.setlist ? results.setlist.errors.length : 0) +
      (results.takes ? results.takes.errors.length : 0) +
      (results.pitchBeat ? results.pitchBeat.errors.length : 0);

    results.overall.totalWarnings = 
      (results.sessions ? results.sessions.warnings.length : 0) +
      (results.setlist ? results.setlist.warnings.length : 0) +
      (results.takes ? results.takes.warnings.length : 0) +
      (results.pitchBeat ? results.pitchBeat.warnings.length : 0);

    return results;
  }
}

module.exports = { DataValidator, ValidationError };
