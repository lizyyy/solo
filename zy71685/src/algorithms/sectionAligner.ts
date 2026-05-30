import { ScoreSection, AlignmentResult } from '@/types';

export class SectionAligner {
  private sampleRate: number = 44100;

  setSampleRate(rate: number): void {
    this.sampleRate = rate;
  }

  async align(
    audioBuffer: AudioBuffer,
    sections: ScoreSection[],
    _referencePitches: string[]
  ): Promise<AlignmentResult[]> {
    const channelData = audioBuffer.getChannelData(0);
    const results: AlignmentResult[] = [];

    const onsets = this.detectOnsets(channelData);

    for (const section of sections) {
      const expectedStartSample = Math.floor(section.startTime * this.sampleRate);
      const expectedEndSample = Math.floor(section.endTime * this.sampleRate);

      const searchWindowStart = Math.max(0, expectedStartSample - this.sampleRate * 2);
      const searchWindowEnd = Math.min(
        channelData.length,
        expectedStartSample + this.sampleRate * 2
      );

      let bestStartSample = expectedStartSample;
      let bestScore = 0;

      for (
        let offset = searchWindowStart;
        offset < searchWindowEnd;
        offset += Math.floor(this.sampleRate * 0.01)
      ) {
        const score = this.calculateAlignmentScore(
          channelData,
          onsets,
          offset,
          expectedEndSample - expectedStartSample
        );

        if (score > bestScore) {
          bestScore = score;
          bestStartSample = offset;
        }
      }

      const duration = expectedEndSample - expectedStartSample;
      const alignedStart = bestStartSample / this.sampleRate;
      const alignedEnd = (bestStartSample + duration) / this.sampleRate;
      const confidence = Math.min(1, bestScore);

      results.push({
        scoreSectionId: section.id,
        alignedStartTime: alignedStart,
        alignedEndTime: alignedEnd,
        confidence,
      });
    }

    return results;
  }

  private detectOnsets(channelData: Float32Array): number[] {
    const onsets: number[] = [];
    const frameSize = 512;
    const hopSize = 256;
    const threshold = 0.3;

    let prevEnergy = 0;
    for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
      let energy = 0;
      for (let j = 0; j < frameSize; j++) {
        energy += Math.abs(channelData[i + j]);
      }
      energy /= frameSize;

      if (prevEnergy > 0 && energy / prevEnergy > (1 + threshold)) {
        onsets.push(i);
      }

      prevEnergy = energy;
    }

    return onsets;
  }

  private calculateAlignmentScore(
    channelData: Float32Array,
    onsets: number[],
    startSample: number,
    durationSamples: number
  ): number {
    let score = 0;
    const endSample = startSample + durationSamples;

    const localOnsets = onsets.filter(
      (o) => o >= startSample && o <= endSample
    );

    if (localOnsets.length > 0) {
      score += 0.5;
    }

    let rmsEnergy = 0;
    for (let i = startSample; i < Math.min(endSample, channelData.length); i++) {
      rmsEnergy += channelData[i] * channelData[i];
    }
    rmsEnergy = Math.sqrt(rmsEnergy / durationSamples);

    if (rmsEnergy > 0.01) {
      score += Math.min(0.5, rmsEnergy * 10);
    }

    return score;
  }
}

export const sectionAligner = new SectionAligner();
