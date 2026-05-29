const {
  calculateTransposeInterval,
  transposeNote,
  transposeChord,
  getKeyInfo,
  detectAccidentalIssues,
  KEY_SIGNATURES,
  MINOR_KEYS
} = require('./music-theory');

class TransposeEngine {
  constructor(options = {}) {
    this.options = {
      preserveLyricsAlignment: true,
      detectAccidentalChanges: true,
      strictChordValidation: false,
      ...options
    };
    this.issues = [];
    this.differences = [];
  }

  transpose(score, targetKey, options = {}) {
    this.issues = [];
    this.differences = [];
    
    const mergedOptions = { ...this.options, ...options };
    const originalKey = score.originalKey;
    
    if (!this.isValidKey(targetKey)) {
      this.issues.push({
        type: 'invalid_target_key',
        message: `目标调 "${targetKey}" 不是有效的调号`,
        severity: 'error',
        context: { targetKey }
      });
      return null;
    }

    const semitones = calculateTransposeInterval(originalKey, targetKey);
    const targetKeyInfo = getKeyInfo(targetKey);
    const originalKeyInfo = getKeyInfo(originalKey);

    const transposedScore = {
      ...score,
      originalKey,
      targetKey,
      transposeInterval: semitones,
      transposeDirection: semitones > 6 ? 'down' : 'up',
      keySignatureChange: {
        original: originalKeyInfo,
        target: targetKeyInfo
      },
      parts: []
    };

    if (semitones !== 0) {
      this.issues.push({
        type: 'transpose_info',
        message: `移调方向: ${semitones > 6 ? '向下' : '向上'} ${Math.min(semitones, 12 - semitones)} 个半音`,
        severity: 'info',
        context: { semitones }
      });
    }

    if (originalKeyInfo.sharps !== targetKeyInfo.sharps || originalKeyInfo.flats !== targetKeyInfo.flats) {
      this.issues.push({
        type: 'key_signature_change',
        message: `调号变化: ${this.formatKeySignature(originalKeyInfo)} → ${this.formatKeySignature(targetKeyInfo)}`,
        severity: 'info',
        context: { originalKeyInfo, targetKeyInfo }
      });
    }

    score.parts.forEach((part, partIndex) => {
      const transposedPart = this.transposePart(part, semitones, targetKeyInfo, {
        ...mergedOptions,
        partName: part.name,
        partIndex
      });
      transposedScore.parts.push(transposedPart);
    });

    this.detectGlobalIssues(score, transposedScore);

    return {
      score: transposedScore,
      issues: this.issues,
      differences: this.differences,
      summary: this.generateSummary()
    };
  }

  transposePart(part, semitones, targetKeyInfo, context = {}) {
    const transposedPart = {
      name: part.name,
      sections: []
    };

    part.sections.forEach((section, secIndex) => {
      const transposedSection = this.transposeSection(section, semitones, targetKeyInfo, {
        ...context,
        sectionName: section.name,
        sectionIndex: secIndex
      });
      transposedPart.sections.push(transposedSection);
    });

    return transposedPart;
  }

  transposeSection(section, semitones, targetKeyInfo, context = {}) {
    const transposedSection = {
      name: section.name,
      measures: [],
      chords: [],
      lyrics: section.lyrics.map(l => ({ ...l }))
    };

    section.measures.forEach((measure, measIndex) => {
      const transposedMeasure = this.transposeMeasure(measure, semitones, targetKeyInfo, {
        ...context,
        measureIndex: measIndex,
        line: measure.line
      });
      transposedSection.measures.push(transposedMeasure);
    });

    section.chords.forEach((chordLine, chordIndex) => {
      const transposedChordLine = this.transposeChordLine(chordLine, semitones, targetKeyInfo, {
        ...context,
        chordIndex,
        line: chordLine.line
      });
      transposedSection.chords.push(transposedChordLine);
    });

    if (this.options.preserveLyricsAlignment) {
      this.checkLyricsAlignment(section, transposedSection, context);
    }

    return transposedSection;
  }

  transposeMeasure(measure, semitones, targetKeyInfo, context = {}) {
    return {
      notes: measure.notes.map((note, noteIndex) => {
        const originalNote = note.original;
        let transposedNote = originalNote;
        
        if (note.normalized) {
          transposedNote = transposeNote(originalNote, semitones, targetKeyInfo);
          
          if (this.options.detectAccidentalChanges) {
            const accidentalIssues = detectAccidentalIssues(originalNote, transposedNote, {
              ...context,
              noteIndex,
              original: originalNote,
              transposed: transposedNote
            });
            accidentalIssues.forEach(issue => {
              this.issues.push(issue);
              this.differences.push({
                type: 'accidental',
                original: originalNote,
                transposed: transposedNote,
                context: issue.context
              });
            });
          }

          if (originalNote !== transposedNote) {
            this.differences.push({
              type: 'note',
              original: originalNote,
              transposed: transposedNote,
              context
            });
          }
        } else {
          this.issues.push({
            type: 'untransposed_note',
            message: `音符 "${originalNote}" 无法识别，未进行移调，请人工核对`,
            severity: 'warning',
            context: { ...context, originalNote }
          });
        }

        return {
          original: originalNote,
          transposed: transposedNote,
          normalized: note.normalized
        };
      }),
      line: measure.line
    };
  }

  transposeChordLine(chordLine, semitones, targetKeyInfo, context = {}) {
    return {
      chords: chordLine.chords.map((chord, chordIndex) => {
        const originalChord = chord.original;
        let transposedChord = originalChord;
        
        if (chord.parsed && chord.parsed.root) {
          transposedChord = transposeChord(originalChord, semitones, targetKeyInfo);
          
          if (originalChord !== transposedChord) {
            this.differences.push({
              type: 'chord',
              original: originalChord,
              transposed: transposedChord,
              context: { ...context, chordIndex }
            });
          }
        } else {
          this.issues.push({
            type: 'unparsed_chord',
            message: `和弦 "${originalChord}" 格式不明确，移调结果 "${transposedChord}" 请务必人工核对`,
            severity: 'warning',
            context: { ...context, originalChord, transposedChord }
          });
        }

        return {
          original: originalChord,
          transposed: transposedChord,
          parsed: chord.parsed
        };
      }),
      line: chordLine.line
    };
  }

  checkLyricsAlignment(originalSection, transposedSection, context) {
    const originalMeasureCount = originalSection.measures.length;
    const originalNoteCount = originalSection.measures.reduce((sum, m) => sum + m.notes.length, 0);
    const lyricCount = originalSection.lyrics.length;

    if (lyricCount > 0 && originalNoteCount > 0 && Math.abs(lyricCount - originalNoteCount) > Math.max(3, originalNoteCount * 0.2)) {
      this.issues.push({
        type: 'lyrics_misalignment_risk',
        message: `[${context.partName} - ${context.sectionName}] 歌词数量(${lyricCount})与音符数量(${originalNoteCount})差异较大，移调后可能错位，请核对`,
        severity: 'warning',
        context: { ...context, lyricCount, noteCount: originalNoteCount }
      });
    }
  }

  detectGlobalIssues(originalScore, transposedScore) {
    const originalChords = this.collectAllChords(originalScore);
    const transposedChords = this.collectAllChords(transposedScore);
    
    const untransposedChords = originalChords.filter((c, i) => c === transposedChords[i] && c);
    if (untransposedChords.length > 0 && untransposedChords.length < originalChords.filter(c => c).length) {
      this.issues.push({
        type: 'partial_chords_untransposed',
        message: `检测到 ${untransposedChords.length} 个和弦可能未正确移调，请重点核对和弦标记`,
        severity: 'warning',
        context: { untransposedChords: untransposedChords.slice(0, 5) }
      });
    }
  }

  collectAllChords(score) {
    const chords = [];
    score.parts.forEach(part => {
      part.sections.forEach(section => {
        section.chords.forEach(chordLine => {
          chordLine.chords.forEach(chord => {
            chords.push(chord.original || chord.transposed);
          });
        });
      });
    });
    return chords;
  }

  isValidKey(key) {
    return KEY_SIGNATURES[key] || MINOR_KEYS[key] || Object.keys(KEY_SIGNATURES).includes(key.replace(/m$/, ''));
  }

  formatKeySignature(keyInfo) {
    if (keyInfo.sharps > 0) return `${keyInfo.sharps}个升号`;
    if (keyInfo.flats > 0) return `${keyInfo.flats}个降号`;
    return '无升降号';
  }

  generateSummary() {
    const errors = this.issues.filter(i => i.severity === 'error');
    const warnings = this.issues.filter(i => i.severity === 'warning');
    const infos = this.issues.filter(i => i.severity === 'info');
    
    const noteChanges = this.differences.filter(d => d.type === 'note').length;
    const chordChanges = this.differences.filter(d => d.type === 'chord').length;
    const accidentalChanges = this.differences.filter(d => d.type === 'accidental').length;

    return {
      errors: errors.length,
      warnings: warnings.length,
      infos: infos.length,
      noteChanges,
      chordChanges,
      accidentalChanges,
      totalDifferences: this.differences.length,
      needsReview: warnings.length > 0 || accidentalChanges > 0
    };
  }
}

module.exports = TransposeEngine;
