import { Midi, Track } from '@tonejs/midi';
import { Pattern, DrumTrack } from '@/types';

const drumNoteMap: Record<string, number> = {
  kick: 36,
  snare: 38,
  hihat: 42,
  clap: 39,
  tom: 45,
  crash: 49,
  ride: 51,
  openhat: 46,
  closedhat: 42,
};

const getMidiNote = (sampleUrl: string): number => {
  const key = Object.keys(drumNoteMap).find((k) =>
    sampleUrl.toLowerCase().includes(k)
  );
  return key ? drumNoteMap[key] : 36;
};

export const exportToMidi = (
  pattern: Pattern,
  filterTrackIds: string[] = [],
  startStep: number = 0,
  endStep?: number
): Uint8Array => {
  const midi = new Midi();
  midi.header.setTempo(pattern.bpm);
  midi.header.timeSignature = [4, 4];

  const drumTrack = midi.addTrack();
  drumTrack.name = pattern.name;
  drumTrack.channel = 9;

  const tracksToExport =
    filterTrackIds.length > 0
      ? pattern.tracks.filter((t) => filterTrackIds.includes(t.id))
      : pattern.tracks;

  const actualEndStep = endStep ?? pattern.steps;

  tracksToExport.forEach((track: DrumTrack) => {
    const midiNote = getMidiNote(track.sampleUrl);

    track.notes.forEach((note) => {
      if (note.isActive && note.step >= startStep && note.step < actualEndStep) {
        const time = (note.step / pattern.steps) * 4;
        const duration = 0.25;
        drumTrack.addNote({
          midi: midiNote,
          time,
          duration,
          velocity: note.velocity / 127,
        });
      }
    });
  });

  return midi.toArray();
};

export const downloadMidi = (
  pattern: Pattern,
  filterTrackIds: string[] = [],
  startStep?: number,
  endStep?: number
): void => {
  const midiData = exportToMidi(pattern, filterTrackIds, startStep, endStep);
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pattern.name.replace(/\s+/g, '_')}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportPatternToJson = (pattern: Pattern): string => {
  return JSON.stringify(pattern, null, 2);
};

export const downloadPatternJson = (pattern: Pattern): void => {
  const jsonData = exportPatternToJson(pattern);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pattern.name.replace(/\s+/g, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
