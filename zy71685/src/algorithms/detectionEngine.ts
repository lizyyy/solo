import {
  Misnote,
  VoicePart,
  ScoreSection,
  PitchDetectionResult,
  SeparationResult,
  AlignmentResult,
  ProblemType,
  frequencyToNote,
  generateId,
} from '@/types';
import { pitchDetector } from './pitchDetector';
import { voiceSeparator } from './voiceSeparator';
import { sectionAligner } from './sectionAligner';

export interface DetectionConfig {
  sensitivity: number;
  minNoteDuration: number;
  maxDeviation: number;
  enableVoiceSeparation: boolean;
  enableSectionAlignment: boolean;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  sensitivity: 0.5,
  minNoteDuration: 0.1,
  maxDeviation: 500,
  enableVoiceSeparation: true,
  enableSectionAlignment: true,
};

export class DetectionEngine {
  async runDetection(
    audioBuffer: AudioBuffer,
    voiceParts: VoicePart[],
    scoreSections: ScoreSection[],
    config: DetectionConfig = DEFAULT_DETECTION_CONFIG,
    timeRange?: [number, number],
    rehearsalId?: string
  ): Promise<{
    pitchResults: PitchDetectionResult[];
    separationResults: SeparationResult[];
    alignmentResults: AlignmentResult[];
    misnotes: Misnote[];
  }> {
    const sampleRate = audioBuffer.sampleRate;
    pitchDetector.setSampleRate(sampleRate);
    voiceSeparator.setSampleRate(sampleRate);
    sectionAligner.setSampleRate(sampleRate);

    const startTime = timeRange ? timeRange[0] : 0;
    const endTime = timeRange ? timeRange[1] : audioBuffer.duration;

    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const slicedBuffer = this.sliceAudioBuffer(audioBuffer, startSample, endSample);

    const [pitchResults, separationResults] = await Promise.all([
      pitchDetector.detect(slicedBuffer),
      config.enableVoiceSeparation ? voiceSeparator.separate(slicedBuffer) : [],
    ]);

    const alignmentResults = config.enableSectionAlignment
      ? await sectionAligner.align(slicedBuffer, scoreSections, [])
      : [];

    const adjustedPitchResults = pitchResults.map((r) => ({
      ...r,
      time: r.time + startTime,
    }));

    const adjustedSeparationResults = separationResults.map((r) => ({
      ...r,
      time: r.time + startTime,
    }));

    const misnotes = this.generateMisnotes(
      adjustedPitchResults,
      adjustedSeparationResults,
      alignmentResults,
      voiceParts,
      scoreSections,
      config,
      rehearsalId
    );

    return {
      pitchResults: adjustedPitchResults,
      separationResults: adjustedSeparationResults,
      alignmentResults,
      misnotes,
    };
  }

  private sliceAudioBuffer(
    audioBuffer: AudioBuffer,
    startSample: number,
    endSample: number
  ): AudioBuffer {
    const audioContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      endSample - startSample,
      audioBuffer.sampleRate
    );

    const newBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      endSample - startSample,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const newChannelData = newBuffer.getChannelData(channel);
      for (let i = 0; i < endSample - startSample; i++) {
        newChannelData[i] = channelData[startSample + i];
      }
    }

    return newBuffer;
  }

  private generateMisnotes(
    pitchResults: PitchDetectionResult[],
    separationResults: SeparationResult[],
    alignmentResults: AlignmentResult[],
    voiceParts: VoicePart[],
    scoreSections: ScoreSection[],
    config: DetectionConfig,
    rehearsalId?: string
  ): Misnote[] {
    const misnotes: Misnote[] = [];
    const detectionRunId = generateId();

    const expectedPitches = this.extractExpectedPitches(scoreSections);

    let currentTime = 0;
    let currentPitchIndex = 0;

    while (currentPitchIndex < pitchResults.length) {
      const currentPitch = pitchResults[currentPitchIndex];

      const nearestExpected = this.findNearestExpectedPitch(
        currentPitch.frequency,
        expectedPitches
      );

      const deviation = this.calculateDeviation(currentPitch.frequency, nearestExpected.freq);

      const separationAtTime = this.getSeparationAtTime(
        separationResults,
        currentPitch.time
      );

      const sectionAtTime = this.getSectionAtTime(
        alignmentResults,
        scoreSections,
        currentPitch.time
      );

      const isMisaligned = sectionAtTime && !sectionAtTime.isAligned;
      const isOverlap = separationAtTime?.dominantInstrument === 'both';
      const isNoisy = currentPitch.probability < 0.3 + config.sensitivity * 0.4;

      let problemType: ProblemType | null = null;

      if (Math.abs(deviation) > 50 * (2 - config.sensitivity)) {
        if (isOverlap) {
          problemType = 'voice_overlap';
        } else if (isMisaligned) {
          problemType = 'section_misalignment';
        } else if (isNoisy) {
          problemType = 'noise_misjudgment';
        } else {
          problemType = 'noise_misjudgment';
        }
      }

      if (problemType && Math.abs(deviation) <= config.maxDeviation) {
        let voicePartId = voiceParts[0]?.id || '';

        if (separationAtTime) {
          if (separationAtTime.dominantInstrument === 'violin') {
            const violinPart = voiceParts.find((p) => p.instrument === 'violin');
            if (violinPart) voicePartId = violinPart.id;
          } else if (separationAtTime.dominantInstrument === 'flute') {
            const flutePart = voiceParts.find((p) => p.instrument === 'flute');
            if (flutePart) voicePartId = flutePart.id;
          }
        }

        const duration = this.calculateNoteDuration(
          pitchResults,
          currentPitchIndex,
          config.minNoteDuration
        );

        misnotes.push({
          id: generateId(),
          rehearsalId: rehearsalId || '',
          detectionRunId,
          voicePartId,
          time: currentPitch.time,
          duration,
          problemType,
          expectedPitch: nearestExpected.note,
          actualPitch: frequencyToNote(currentPitch.frequency),
          deviationCents: Math.abs(deviation),
          confidence: currentPitch.probability,
          confirmationStatus: 'pending',
          sourceType: 'system',
          createdAt: new Date(),
        });

        currentPitchIndex += Math.max(1, Math.floor(duration / 0.023));
      } else {
        currentPitchIndex++;
      }

      currentTime = currentPitch.time;
    }

    return misnotes;
  }

  private extractExpectedPitches(
    scoreSections: ScoreSection[]
  ): { note: string; freq: number; time: number }[] {
    const pitches: { note: string; freq: number; time: number }[] = [];
    const noteFrequencies = this.getNoteFrequencies();

    for (const section of scoreSections) {
      const notes = section.expectedNotes.split(/[,\s]+/);
      const timeStep = (section.endTime - section.startTime) / Math.max(1, notes.length);

      notes.forEach((note, i) => {
        const cleanNote = note.trim();
        if (cleanNote && noteFrequencies[cleanNote]) {
          pitches.push({
            note: cleanNote,
            freq: noteFrequencies[cleanNote],
            time: section.startTime + i * timeStep,
          });
        }
      });
    }

    if (pitches.length === 0) {
      const defaultNotes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
      defaultNotes.forEach((note, i) => {
        pitches.push({
          note,
          freq: noteFrequencies[note],
          time: i * 0.5,
        });
      });
    }

    return pitches;
  }

  private getNoteFrequencies(): Record<string, number> {
    const notes: Record<string, number> = {};
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    for (let octave = 2; octave <= 7; octave++) {
      for (let i = 0; i < 12; i++) {
        const noteName = `${noteNames[i]}${octave}`;
        const midiNumber = octave * 12 + i + 12;
        notes[noteName] = 440 * Math.pow(2, (midiNumber - 69) / 12);
      }
    }

    return notes;
  }

  private findNearestExpectedPitch(
    frequency: number,
    expectedPitches: { note: string; freq: number; time: number }[]
  ): { note: string; freq: number } {
    let nearest = expectedPitches[0];
    let minDiff = Math.abs(Math.log2(frequency / nearest.freq));

    for (const pitch of expectedPitches) {
      const diff = Math.abs(Math.log2(frequency / pitch.freq));
      if (diff < minDiff) {
        minDiff = diff;
        nearest = pitch;
      }
    }

    return { note: nearest.note, freq: nearest.freq };
  }

  private calculateDeviation(freq1: number, freq2: number): number {
    return 1200 * Math.log2(freq1 / freq2);
  }

  private getSeparationAtTime(
    separationResults: SeparationResult[],
    time: number
  ): SeparationResult | null {
    if (separationResults.length === 0) return null;

    let left = 0;
    let right = separationResults.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (separationResults[mid].time < time) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    if (right >= 0 && right < separationResults.length) {
      return separationResults[right];
    }

    return null;
  }

  private getSectionAtTime(
    alignmentResults: AlignmentResult[],
    scoreSections: ScoreSection[],
    time: number
  ): { section: ScoreSection; isAligned: boolean } | null {
    for (const alignment of alignmentResults) {
      if (
        time >= alignment.alignedStartTime &&
        time <= alignment.alignedEndTime
      ) {
        const section = scoreSections.find((s) => s.id === alignment.scoreSectionId);
        if (section) {
          const expectedDuration = section.endTime - section.startTime;
          const actualDuration = alignment.alignedEndTime - alignment.alignedStartTime;
          const timeOffset = Math.abs(section.startTime - alignment.alignedStartTime);
          const isAligned =
            timeOffset < 0.5 && Math.abs(expectedDuration - actualDuration) < 0.5;

          return { section, isAligned };
        }
      }
    }

    for (const section of scoreSections) {
      if (time >= section.startTime && time <= section.endTime) {
        return { section, isAligned: true };
      }
    }

    return null;
  }

  private calculateNoteDuration(
    pitchResults: PitchDetectionResult[],
    startIndex: number,
    minDuration: number
  ): number {
    const startFreq = pitchResults[startIndex].frequency;
    let endIndex = startIndex + 1;

    while (endIndex < pitchResults.length) {
      const ratio = Math.max(
        pitchResults[endIndex].frequency / startFreq,
        startFreq / pitchResults[endIndex].frequency
      );
      if (ratio > 1.1 || pitchResults[endIndex].probability < 0.2) {
        break;
      }
      endIndex++;
    }

    const duration = pitchResults[endIndex - 1].time - pitchResults[startIndex].time;
    return Math.max(minDuration, duration);
  }
}

export const detectionEngine = new DetectionEngine();
