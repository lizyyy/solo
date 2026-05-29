import {
  MelodySegment,
  Work,
  RetrievalResult,
  RetrievalParams,
  ScoreBreakdown,
  CalculationDetails,
  Note,
} from '@/types';
import { encodeContour, getContourEncodingSteps } from './contourEncoder';
import { normalizeRhythm, getRhythmNormalizationSteps } from './rhythmNormalizer';
import { dynamicTimeWarping, editDistance, normalizeScore } from './similarity';

export function createMelodySegment(
  notes: Note[],
  workId: string,
  startBeat: number = 0
): MelodySegment {
  const pitches = notes.map((n) => n.pitch);
  const durations = notes.map((n) => n.duration);
  const endBeat = startBeat + durations.reduce((a, b) => a + b, 0);

  return {
    id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    workId,
    notes,
    pitches,
    durations,
    startBeat,
    endBeat,
    contour: encodeContour(pitches),
    rhythm: normalizeRhythm(durations),
  };
}

export function calculateSimilarity(
  querySegment: MelodySegment,
  targetSegment: MelodySegment,
  targetWork: Work,
  params: RetrievalParams
): RetrievalResult {
  const contourSteps = getContourEncodingSteps(querySegment.pitches);
  const rhythmSteps = getRhythmNormalizationSteps(querySegment.durations);

  const queryContour = querySegment.contour.relative;
  const targetContour = targetSegment.contour.relative;
  const dtwResult = dynamicTimeWarping(queryContour, targetContour);

  const queryRhythm = querySegment.rhythm.normalized;
  const targetRhythm = targetSegment.rhythm.normalized;
  const editResult = editDistance(queryRhythm, targetRhythm, 0.05);

  const contourScore = normalizeScore(dtwResult.normalizedDistance, true);
  const rhythmScore = normalizeScore(editResult.normalizedDistance, true);

  const totalWeight = params.contourWeight + params.rhythmWeight;
  const normalizedContourWeight = params.contourWeight / totalWeight;
  const normalizedRhythmWeight = params.rhythmWeight / totalWeight;

  const contourWeighted = contourScore * normalizedContourWeight;
  const rhythmWeighted = rhythmScore * normalizedRhythmWeight;
  const overallScore = contourWeighted + rhythmWeighted;

  const scores: ScoreBreakdown = {
    contour: {
      raw: dtwResult.distance,
      normalized: contourScore,
      weight: normalizedContourWeight,
      weighted: contourWeighted,
      details: dtwResult,
    },
    rhythm: {
      raw: editResult.distance,
      normalized: rhythmScore,
      weight: normalizedRhythmWeight,
      weighted: rhythmWeighted,
      details: editResult,
    },
    overall: overallScore,
  };

  const queryTotal = querySegment.durations.reduce((a, b) => a + b, 0);
  const targetTotal = targetSegment.durations.reduce((a, b) => a + b, 0);
  const timeStretch = queryTotal > 0 ? targetTotal / queryTotal : 1;

  const calculationDetails: CalculationDetails = {
    parameters: params,
    contourEncoding: {
      input: querySegment.pitches,
      output: querySegment.contour.rawSequence,
      steps: contourSteps,
    },
    rhythmNormalization: {
      input: querySegment.durations,
      output: rhythmSteps.output,
      stretchFactor: querySegment.rhythm.stretchFactor,
    },
    similarityCalc: {
      contourDTW: {
        distance: dtwResult.distance,
        path: dtwResult.path,
      },
      rhythmEdit: {
        distance: editResult.distance,
        operations: editResult.operations,
      },
    },
  };

  return {
    id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    querySegment,
    targetSegment,
    targetWork,
    scores,
    transposition: 0,
    timeStretch,
    matched: overallScore >= params.minMatchScore,
    calculationDetails,
  };
}

export function retrieveSimilarMelodies(
  querySegment: MelodySegment,
  works: Work[],
  params: RetrievalParams
): RetrievalResult[] {
  const results: RetrievalResult[] = [];

  for (const work of works) {
    for (const targetSegment of work.segments) {
      const result = calculateSimilarity(
        querySegment,
        targetSegment,
        work,
        params
      );
      results.push(result);
    }
  }

  results.sort((a, b) => b.scores.overall - a.scores.overall);

  return results.slice(0, params.maxResults);
}

export function splitIntoSegments(
  notes: Note[],
  segmentLength: number = 8
): Note[][] {
  const segments: Note[][] = [];
  let currentSegment: Note[] = [];
  let currentDuration = 0;

  for (const note of notes) {
    if (currentDuration + note.duration > segmentLength && currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [];
      currentDuration = 0;
    }
    currentSegment.push(note);
    currentDuration += note.duration;
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}
