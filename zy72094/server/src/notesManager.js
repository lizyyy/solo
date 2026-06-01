const fs = require('fs');
const path = require('path');

const NOTES_FILE = path.join(__dirname, '../data/notes.json');

function loadNotesFile() {
  try {
    if (fs.existsSync(NOTES_FILE)) {
      return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading notes:', e);
  }
  return {};
}

function saveNotesFile(data) {
  try {
    const dir = path.dirname(NOTES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving notes:', e);
    return false;
  }
}

function loadNotes(recordId) {
  const allNotes = loadNotesFile();
  const notes = allNotes[recordId] || [];
  return notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function saveNote(recordId, content, author = '匿名') {
  const allNotes = loadNotesFile();
  
  if (!allNotes[recordId]) {
    allNotes[recordId] = [];
  }

  const note = {
    id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    recordId,
    content,
    author,
    timestamp: new Date().toISOString()
  };

  allNotes[recordId].push(note);
  saveNotesFile(allNotes);
  
  return note;
}

function deleteNote(noteId) {
  const allNotes = loadNotesFile();
  
  for (const recordId in allNotes) {
    const index = allNotes[recordId].findIndex(n => n.id === noteId);
    if (index !== -1) {
      allNotes[recordId].splice(index, 1);
      saveNotesFile(allNotes);
      return true;
    }
  }
  
  return false;
}

function compareNotes(beforeNotes, afterNotes) {
  const changes = [];
  
  const beforeIds = new Set(beforeNotes.map(n => n.id));
  const afterIds = new Set(afterNotes.map(n => n.id));
  
  for (const note of afterNotes) {
    if (!beforeIds.has(note.id)) {
      changes.push({
        type: 'add',
        note,
        message: `新增备注: "${note.content}" (${note.author})`
      });
    }
  }
  
  for (const note of beforeNotes) {
    if (!afterIds.has(note.id)) {
      changes.push({
        type: 'remove',
        note,
        message: `删除备注: "${note.content}" (${note.author})`
      });
    }
  }
  
  return changes;
}

module.exports = {
  loadNotes,
  saveNote,
  deleteNote,
  compareNotes
};
