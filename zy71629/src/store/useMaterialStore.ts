import { create } from 'zustand';
import type { Chord, Phrase, ChordProgression, RhythmPattern, MaterialLibrary } from '@/types/music';
import { DEFAULT_CHORDS, getChordById } from '@/data/chords';
import { DEFAULT_PHRASES, getPhraseById } from '@/data/phrases';
import { DEFAULT_PROGRESSIONS, DEFAULT_RHYTHMS, getProgressionById, getRhythmById } from '@/data/progressions';

interface MaterialStore extends MaterialLibrary {
  isLoaded: boolean;
  loadMaterials: () => void;
  addChord: (chord: Chord) => void;
  updateChord: (chord: Chord) => void;
  deleteChord: (id: string) => void;
  addPhrase: (phrase: Phrase) => void;
  updatePhrase: (phrase: Phrase) => void;
  deletePhrase: (id: string) => void;
  addProgression: (progression: ChordProgression) => void;
  updateProgression: (progression: ChordProgression) => void;
  deleteProgression: (id: string) => void;
  addRhythm: (rhythm: RhythmPattern) => void;
  updateRhythm: (rhythm: RhythmPattern) => void;
  deleteRhythm: (id: string) => void;
  getChord: (id: string) => Chord | undefined;
  getPhrase: (id: string) => Phrase | undefined;
  getProgression: (id: string) => ChordProgression | undefined;
  getRhythm: (id: string) => RhythmPattern | undefined;
}

export const useMaterialStore = create<MaterialStore>((set, get) => ({
  chords: [],
  phrases: [],
  chordProgressions: [],
  rhythmPatterns: [],
  isLoaded: false,

  loadMaterials: () => {
    const storedChords = localStorage.getItem('jazz_chords');
    const storedPhrases = localStorage.getItem('jazz_phrases');
    const storedProgressions = localStorage.getItem('jazz_progressions');
    const storedRhythms = localStorage.getItem('jazz_rhythms');

    set({
      chords: storedChords ? JSON.parse(storedChords) : DEFAULT_CHORDS,
      phrases: storedPhrases ? JSON.parse(storedPhrases) : DEFAULT_PHRASES,
      chordProgressions: storedProgressions ? JSON.parse(storedProgressions) : DEFAULT_PROGRESSIONS,
      rhythmPatterns: storedRhythms ? JSON.parse(storedRhythms) : DEFAULT_RHYTHMS,
      isLoaded: true,
    });
  },

  addChord: (chord: Chord) => {
    const { chords } = get();
    const updated = [...chords, chord];
    set({ chords: updated });
    localStorage.setItem('jazz_chords', JSON.stringify(updated));
  },

  updateChord: (chord: Chord) => {
    const { chords } = get();
    const updated = chords.map((c) => (c.id === chord.id ? chord : c));
    set({ chords: updated });
    localStorage.setItem('jazz_chords', JSON.stringify(updated));
  },

  deleteChord: (id: string) => {
    const { chords } = get();
    const updated = chords.filter((c) => c.id !== id);
    set({ chords: updated });
    localStorage.setItem('jazz_chords', JSON.stringify(updated));
  },

  addPhrase: (phrase: Phrase) => {
    const { phrases } = get();
    const updated = [...phrases, phrase];
    set({ phrases: updated });
    localStorage.setItem('jazz_phrases', JSON.stringify(updated));
  },

  updatePhrase: (phrase: Phrase) => {
    const { phrases } = get();
    const updated = phrases.map((p) => (p.id === phrase.id ? phrase : p));
    set({ phrases: updated });
    localStorage.setItem('jazz_phrases', JSON.stringify(updated));
  },

  deletePhrase: (id: string) => {
    const { phrases } = get();
    const updated = phrases.filter((p) => p.id !== id);
    set({ phrases: updated });
    localStorage.setItem('jazz_phrases', JSON.stringify(updated));
  },

  addProgression: (progression: ChordProgression) => {
    const { chordProgressions } = get();
    const updated = [...chordProgressions, progression];
    set({ chordProgressions: updated });
    localStorage.setItem('jazz_progressions', JSON.stringify(updated));
  },

  updateProgression: (progression: ChordProgression) => {
    const { chordProgressions } = get();
    const updated = chordProgressions.map((p) => (p.id === progression.id ? progression : p));
    set({ chordProgressions: updated });
    localStorage.setItem('jazz_progressions', JSON.stringify(updated));
  },

  deleteProgression: (id: string) => {
    const { chordProgressions } = get();
    const updated = chordProgressions.filter((p) => p.id !== id);
    set({ chordProgressions: updated });
    localStorage.setItem('jazz_progressions', JSON.stringify(updated));
  },

  addRhythm: (rhythm: RhythmPattern) => {
    const { rhythmPatterns } = get();
    const updated = [...rhythmPatterns, rhythm];
    set({ rhythmPatterns: updated });
    localStorage.setItem('jazz_rhythms', JSON.stringify(updated));
  },

  updateRhythm: (rhythm: RhythmPattern) => {
    const { rhythmPatterns } = get();
    const updated = rhythmPatterns.map((r) => (r.id === rhythm.id ? rhythm : r));
    set({ rhythmPatterns: updated });
    localStorage.setItem('jazz_rhythms', JSON.stringify(updated));
  },

  deleteRhythm: (id: string) => {
    const { rhythmPatterns } = get();
    const updated = rhythmPatterns.filter((r) => r.id !== id);
    set({ rhythmPatterns: updated });
    localStorage.setItem('jazz_rhythms', JSON.stringify(updated));
  },

  getChord: (id: string) => get().chords.find((c) => c.id === id),
  getPhrase: (id: string) => get().phrases.find((p) => p.id === id),
  getProgression: (id: string) => get().chordProgressions.find((p) => p.id === id),
  getRhythm: (id: string) => get().rhythmPatterns.find((r) => r.id === id),
}));

export function initializeMaterialData(): void {
  if (!localStorage.getItem('jazz_chords')) {
    localStorage.setItem('jazz_chords', JSON.stringify(DEFAULT_CHORDS));
  }
  if (!localStorage.getItem('jazz_phrases')) {
    localStorage.setItem('jazz_phrases', JSON.stringify(DEFAULT_PHRASES));
  }
  if (!localStorage.getItem('jazz_progressions')) {
    localStorage.setItem('jazz_progressions', JSON.stringify(DEFAULT_PROGRESSIONS));
  }
  if (!localStorage.getItem('jazz_rhythms')) {
    localStorage.setItem('jazz_rhythms', JSON.stringify(DEFAULT_RHYTHMS));
  }
  useMaterialStore.getState().loadMaterials();
}
