import * as Diff from 'diff';
import type { DiffChunk, NoteRevision, Note } from '../types';
import { generateId } from './gameEngine';
import { defaultOperator } from '../data/mockLevels';

export function diffNotes(oldContent: string, newContent: string): DiffChunk[] {
  const changes = Diff.diffChars(oldContent, newContent);
  
  return changes.map((change) => ({
    value: change.value,
    added: change.added,
    removed: change.removed,
  }));
}

export function createNoteRevision(
  noteId: string,
  oldContent: string,
  newContent: string,
  author: string = defaultOperator,
  reason: string = '补录备注'
): NoteRevision {
  const diff = diffNotes(oldContent, newContent);
  
  return {
    id: generateId(),
    noteId,
    oldContent,
    newContent,
    diff,
    createdAt: Date.now(),
    author,
    reason,
  };
}

export function createNote(
  sessionId: string,
  type: 'original' | 'supplementary',
  content: string,
  author: string = defaultOperator,
  source: string = '手动输入'
): Note {
  return {
    id: generateId(),
    sessionId,
    type,
    content,
    author,
    createdAt: Date.now(),
    source,
    revisions: [],
  };
}

export function createOriginalNoteFromLevel(
  sessionId: string,
  rawNotes: string,
  source: string
): Note {
  return {
    id: generateId(),
    sessionId,
    type: 'original',
    content: rawNotes,
    author: defaultOperator,
    createdAt: Date.now(),
    source,
    revisions: [],
  };
}

export function updateSupplementaryNote(
  note: Note,
  newContent: string,
  author: string = defaultOperator,
  reason: string = '补录备注'
): Note {
  if (note.type !== 'supplementary') {
    throw new Error('只能修改补录备注');
  }

  const revision = createNoteRevision(
    note.id,
    note.content,
    newContent,
    author,
    reason
  );

  return {
    ...note,
    content: newContent,
    revisions: [...(note.revisions || []), revision],
  };
}

export function renderDiffToHTML(diff: DiffChunk[]): string {
  return diff
    .map((chunk) => {
      if (chunk.removed) {
        return `<del class="text-red-500 line-through bg-red-100">${chunk.value}</del>`;
      }
      if (chunk.added) {
        return `<ins class="text-green-600 underline bg-green-100">${chunk.value}</ins>`;
      }
      return chunk.value;
    })
    .join('');
}

export function hasSignificantChanges(diff: DiffChunk[]): boolean {
  return diff.some((chunk) => chunk.added || chunk.removed);
}

export function getDiffStats(diff: DiffChunk[]): {
  added: number;
  removed: number;
  unchanged: number;
} {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  diff.forEach((chunk) => {
    if (chunk.added) {
      added += chunk.value.length;
    } else if (chunk.removed) {
      removed += chunk.value.length;
    } else {
      unchanged += chunk.value.length;
    }
  });

  return { added, removed, unchanged };
}
