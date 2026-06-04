const InspectionNote = require('../models/InspectionNote');
const store = require('../store/DataStore');

class NoteService {
  static createNote(data) {
    const note = new InspectionNote(data);
    return store.create('notes', note.toJSON());
  }

  static getNoteById(id) {
    return store.findById('notes', id);
  }

  static getNotesByPhotoId(photoId) {
    return store.find('notes', n => n.photoId === photoId);
  }

  static getNotesBySensorNumber(sensorNumber) {
    return store.find('notes', n => n.sensorNumber === sensorNumber);
  }

  static getNotesByAuthor(author) {
    return store.find('notes', n => n.author === author);
  }

  static getNotesByRole(role) {
    return store.find('notes', n => n.authorRole === role);
  }

  static getPendingVerificationNotes() {
    return store.find('notes', n => n.verificationStatus === 'pending');
  }

  static getAllNotes() {
    return store.findAll('notes');
  }

  static updateNoteContent(id, newContent, editor) {
    const noteData = this.getNoteById(id);
    if (!noteData) return null;
    
    const note = new InspectionNote(noteData);
    note.updateContent(newContent, editor);
    return store.update('notes', id, note.toJSON());
  }

  static getNoteVersion(id, versionNumber) {
    const noteData = this.getNoteById(id);
    if (!noteData) return null;
    
    const note = new InspectionNote(noteData);
    return note.getVersion(versionNumber);
  }

  static getNoteVersionDiff(id, version1, version2) {
    const noteData = this.getNoteById(id);
    if (!noteData) return null;
    
    const note = new InspectionNote(noteData);
    return note.getVersionDiff(version1, version2);
  }

  static getNoteHistory(id) {
    const noteData = this.getNoteById(id);
    if (!noteData) return null;
    
    return {
      id: noteData.id,
      currentVersion: noteData.version,
      currentContent: noteData.content,
      previousVersions: noteData.previousVersions
    };
  }

  static verifyNote(id, verifier, status = 'verified') {
    const noteData = this.getNoteById(id);
    if (!noteData) return null;
    
    const note = new InspectionNote(noteData);
    note.verify(verifier, status);
    return store.update('notes', id, note.toJSON());
  }

  static rollbackNote(id, toVersion, editor) {
    const noteData = this.getNoteById(id);
    if (!noteData) return null;
    
    const note = new InspectionNote(noteData);
    try {
      note.rollback(toVersion, editor);
      return store.update('notes', id, note.toJSON());
    } catch (e) {
      return { error: e.message };
    }
  }

  static comparePhotoNotes(photoId) {
    const notes = this.getNotesByPhotoId(photoId);
    const sensorGroups = {};

    notes.forEach(note => {
      if (!sensorGroups[note.sensorNumber]) {
        sensorGroups[note.sensorNumber] = [];
      }
      sensorGroups[note.sensorNumber].push(note);
    });

    const comparisons = [];
    Object.entries(sensorGroups).forEach(([sensorNumber, sensorNotes]) => {
      if (sensorNotes.length > 1) {
        const sortedNotes = sensorNotes.sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        comparisons.push({
          sensorNumber,
          notes: sortedNotes,
          needsReview: this.checkNoteConsistency(sortedNotes)
        });
      }
    });

    return comparisons;
  }

  static checkNoteConsistency(notes) {
    if (notes.length < 2) return false;

    for (let i = 1; i < notes.length; i++) {
      const prev = notes[i - 1];
      const curr = notes[i];
      
      if (prev.content !== curr.content) {
        return true;
      }
    }
    return false;
  }

  static getNotesForHeatLoad(heatLoadId) {
    const heatLoad = store.findById('heatLoads', heatLoadId);
    if (!heatLoad) return [];
    
    return store.find('notes', n => heatLoad.noteIds.includes(n.id));
  }

  static deleteNote(id) {
    return store.delete('notes', id);
  }

  static getNoteTraceInfo(noteId) {
    const note = this.getNoteById(noteId);
    if (!note) return null;

    const photo = store.findById('photos', note.photoId);
    const heatLoads = store.find('heatLoads', h => h.noteIds.includes(noteId));

    return {
      note,
      photo,
      referencedInHeatLoads: heatLoads
    };
  }
}

module.exports = NoteService;
