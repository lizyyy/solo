class Parser {
    constructor() {
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    }

    parseScoreJSON(jsonString) {
        try {
            const scoreData = JSON.parse(jsonString);
            return this.normalizeScore(scoreData);
        } catch (error) {
            throw new Error(`乐谱JSON解析失败: ${error.message}`);
        }
    }

    normalizeScore(scoreData) {
        const normalized = {
            title: scoreData.title || '未命名乐谱',
            composer: scoreData.composer || '未知',
            timeSignature: scoreData.timeSignature || '4/4',
            tempo: scoreData.tempo || 120,
            measures: []
        };

        const beatsPerMeasure = this.parseTimeSignature(normalized.timeSignature);

        if (scoreData.measures && Array.isArray(scoreData.measures)) {
            normalized.measures = scoreData.measures.map((measure, index) => {
                return this.normalizeMeasure(measure, index, beatsPerMeasure, normalized.tempo);
            });
        } else if (scoreData.notes && Array.isArray(scoreData.notes)) {
            normalized.measures = this.notesToMeasures(scoreData.notes, beatsPerMeasure, normalized.tempo);
        } else {
            throw new Error('无法识别的乐谱格式，需要包含 measures 或 notes 数组');
        }

        return normalized;
    }

    parseTimeSignature(timeSig) {
        const match = timeSig.match(/(\d+)\/(\d+)/);
        if (match) {
            return parseInt(match[1], 10);
        }
        return 4;
    }

    normalizeMeasure(measure, index, beatsPerMeasure, tempo) {
        const normalizedMeasure = {
            number: measure.number !== undefined ? measure.number : index + 1,
            timeSignature: measure.timeSignature || `${beatsPerMeasure}/4`,
            tempo: measure.tempo || tempo,
            notes: [],
            pedalEvents: []
        };

        if (measure.notes && Array.isArray(measure.notes)) {
            normalizedMeasure.notes = measure.notes.map(note => this.normalizeNote(note));
        }

        if (measure.pedalEvents && Array.isArray(measure.pedalEvents)) {
            normalizedMeasure.pedalEvents = measure.pedalEvents.map(p => this.normalizePedal(p));
        }

        return normalizedMeasure;
    }

    normalizeNote(note) {
        return {
            pitch: note.pitch || note.midiNote || 60,
            noteName: note.noteName || this.midiToNoteName(note.pitch || note.midiNote || 60),
            velocity: note.velocity || 64,
            startTime: note.startTime !== undefined ? note.startTime : (note.time || 0),
            duration: note.duration || 1,
            endTime: note.endTime !== undefined ? note.endTime : null,
            isSlurred: note.isSlurred || false,
            slurGroup: note.slurGroup || null,
            isAccent: note.isAccent || false,
            isStaccato: note.isStaccato || false
        };
    }

    normalizePedal(pedal) {
        return {
            type: pedal.type || 'damper',
            time: pedal.time !== undefined ? pedal.time : 0,
            value: pedal.value !== undefined ? pedal.value : 1,
            isPressed: pedal.isPressed !== undefined ? pedal.isPressed : (pedal.value > 0)
        };
    }

    notesToMeasures(notes, beatsPerMeasure, tempo) {
        const measures = [];
        const secondsPerBeat = 60 / tempo;
        const secondsPerMeasure = secondsPerBeat * beatsPerMeasure;

        const groupedNotes = {};
        
        notes.forEach(note => {
            const normalizedNote = this.normalizeNote(note);
            const measureNumber = Math.floor(normalizedNote.startTime / secondsPerMeasure) + 1;
            
            if (!groupedNotes[measureNumber]) {
                groupedNotes[measureNumber] = [];
            }
            groupedNotes[measureNumber].push(normalizedNote);
        });

        const measureNumbers = Object.keys(groupedNotes).map(Number).sort((a, b) => a - b);
        const maxMeasure = measureNumbers.length > 0 ? measureNumbers[measureNumbers.length - 1] : 1;

        for (let i = 1; i <= maxMeasure; i++) {
            measures.push({
                number: i,
                timeSignature: `${beatsPerMeasure}/4`,
                tempo: tempo,
                notes: groupedNotes[i] || [],
                pedalEvents: []
            });
        }

        return measures;
    }

    parsePerformanceCSV(csvString) {
        try {
            const lines = csvString.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV文件至少需要包含标题行和一行数据');
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const events = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                const event = this.parseCSVRow(headers, values);
                if (event) {
                    events.push(event);
                }
            }

            return this.normalizePerformanceEvents(events);
        } catch (error) {
            throw new Error(`演奏CSV解析失败: ${error.message}`);
        }
    }

    parseCSVRow(headers, values) {
        const event = {};
        
        headers.forEach((header, index) => {
            if (index < values.length) {
                const value = values[index];
                switch (header) {
                    case 'time':
                    case 'timestamp':
                    case 'starttime':
                        event.time = parseFloat(value);
                        break;
                    case 'type':
                    case 'event':
                        event.type = value.toLowerCase();
                        break;
                    case 'pitch':
                    case 'midinote':
                    case 'note':
                        event.pitch = parseInt(value, 10);
                        break;
                    case 'velocity':
                    case 'onvelocity':
                        event.velocity = parseInt(value, 10);
                        break;
                    case 'offvelocity':
                        event.offVelocity = parseInt(value, 10);
                        break;
                    case 'duration':
                        event.duration = parseFloat(value);
                        break;
                    case 'endtime':
                        event.endTime = parseFloat(value);
                        break;
                    case 'pedal':
                    case 'pedaltype':
                        event.pedalType = value.toLowerCase();
                        break;
                    case 'value':
                    case 'pedalvalue':
                        event.value = parseInt(value, 10);
                        break;
                    case 'notename':
                        event.noteName = value;
                        break;
                }
            }
        });

        if (!event.type) {
            if (event.pitch !== undefined) {
                event.type = 'note';
            } else if (event.pedalType || event.type === 'pedal') {
                event.type = 'pedal';
            }
        }

        return event;
    }

    normalizePerformanceEvents(events) {
        const normalized = {
            noteOnEvents: [],
            noteOffEvents: [],
            pedalEvents: [],
            notes: []
        };

        const noteOns = [];
        const noteOffs = [];

        events.forEach(event => {
            if (event.type === 'noteon' || (event.type === 'note' && event.velocity > 0)) {
                noteOns.push({
                    time: event.time,
                    pitch: event.pitch,
                    velocity: event.velocity || 64,
                    noteName: event.noteName || this.midiToNoteName(event.pitch)
                });
            } else if (event.type === 'noteoff' || (event.type === 'note' && (event.velocity === 0 || event.endTime !== undefined))) {
                noteOffs.push({
                    time: event.endTime || event.time,
                    pitch: event.pitch,
                    velocity: event.offVelocity || 0,
                    noteName: event.noteName || this.midiToNoteName(event.pitch)
                });
            } else if (event.type === 'pedal' || event.pedalType) {
                normalized.pedalEvents.push({
                    time: event.time,
                    type: event.pedalType || 'damper',
                    value: event.value !== undefined ? event.value : 64,
                    isPressed: event.value > 0
                });
            }
        });

        events.forEach(event => {
            if (event.duration !== undefined && event.pitch !== undefined) {
                normalized.notes.push({
                    pitch: event.pitch,
                    noteName: event.noteName || this.midiToNoteName(event.pitch),
                    velocity: event.velocity || 64,
                    startTime: event.time,
                    duration: event.duration,
                    endTime: event.time + event.duration
                });
            }
        });

        const pairedNotes = this.pairNoteEvents(noteOns, noteOffs);
        normalized.notes = [...normalized.notes, ...pairedNotes];
        normalized.notes.sort((a, b) => a.startTime - b.startTime);

        normalized.noteOnEvents = noteOns.sort((a, b) => a.time - b.time);
        normalized.noteOffEvents = noteOffs.sort((a, b) => a.time - b.time);
        normalized.pedalEvents.sort((a, b) => a.time - b.time);

        return normalized;
    }

    pairNoteEvents(noteOns, noteOffs) {
        const notes = [];
        const activeNotes = new Map();

        const allEvents = [
            ...noteOns.map(e => ({ ...e, eventType: 'on' })),
            ...noteOffs.map(e => ({ ...e, eventType: 'off' }))
        ].sort((a, b) => a.time - b.time);

        allEvents.forEach(event => {
            const key = event.pitch;

            if (event.eventType === 'on') {
                if (activeNotes.has(key)) {
                    const activeNote = activeNotes.get(key);
                    notes.push({
                        pitch: activeNote.pitch,
                        noteName: activeNote.noteName,
                        velocity: activeNote.velocity,
                        startTime: activeNote.time,
                        duration: event.time - activeNote.time,
                        endTime: event.time
                    });
                }
                activeNotes.set(key, event);
            } else {
                if (activeNotes.has(key)) {
                    const activeNote = activeNotes.get(key);
                    notes.push({
                        pitch: activeNote.pitch,
                        noteName: activeNote.noteName,
                        velocity: activeNote.velocity,
                        startTime: activeNote.time,
                        duration: event.time - activeNote.time,
                        endTime: event.time
                    });
                    activeNotes.delete(key);
                }
            }
        });

        activeNotes.forEach((note, key) => {
            notes.push({
                pitch: note.pitch,
                noteName: note.noteName,
                velocity: note.velocity,
                startTime: note.time,
                duration: 0.5,
                endTime: note.time + 0.5
            });
        });

        return notes;
    }

    midiToNoteName(midiNote) {
        const octave = Math.floor(midiNote / 12) - 1;
        const noteIndex = midiNote % 12;
        return this.noteNames[noteIndex] + octave;
    }

    noteNameToMidi(noteName) {
        const match = noteName.match(/([A-G][#b]?)(\d+)/);
        if (!match) return null;

        const note = match[1];
        const octave = parseInt(match[2], 10);
        
        let noteIndex = this.noteNames.indexOf(note);
        if (noteIndex === -1) {
            if (note.includes('b')) {
                const naturalNote = note[0];
                noteIndex = this.noteNames.indexOf(naturalNote);
                if (noteIndex > 0) noteIndex--;
            }
        }

        if (noteIndex === -1) return null;

        return (octave + 1) * 12 + noteIndex;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Parser;
}
