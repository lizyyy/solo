import { AppState, Fixture, Cue, SceneRules, ParsingError } from '../types';
import { DEFAULT_RULES } from '../parsers/yamlParser';
import { validateAll, ValidationResult } from '../validators';

type Listener = (state: AppState) => void;

const initialState: AppState = {
  fixtures: [],
  cues: [],
  rules: DEFAULT_RULES,
  risks: [],
  timeline: {
    currentTime: 0,
    isPlaying: false,
    selectedCueId: null,
    zoomLevel: 1
  },
  activeChannelValues: new Map(),
  dataLoaded: false
};

class Store {
  private state: AppState;
  private listeners: Set<Listener> = new Set();
  private validationResult: ValidationResult | null = null;
  private parsingErrors: ParsingError[] = [];

  constructor(initialState: AppState) {
    this.state = { ...initialState };
  }

  getState(): AppState {
    return { ...this.state };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(): void {
    this.listeners.forEach((listener) => listener({ ...this.state }));
  }

  setFixtures(fixtures: Fixture[]): void {
    this.state.fixtures = [...fixtures];
    this.state.dataLoaded = this.checkDataLoaded();
    this.runValidation();
    this.notify();
  }

  setCues(cues: Cue[]): void {
    this.state.cues = [...cues].sort((a, b) => a.startTime - b.startTime);
    this.state.dataLoaded = this.checkDataLoaded();
    this.updateTimelineRange();
    this.runValidation();
    this.notify();
  }

  setRules(rules: SceneRules): void {
    this.state.rules = { ...rules };
    this.runValidation();
    this.notify();
  }

  setParsingErrors(errors: ParsingError[]): void {
    this.parsingErrors = [...errors];
  }

  getParsingErrors(): ParsingError[] {
    return [...this.parsingErrors];
  }

  setTimelineCurrentTime(time: number): void {
    this.state.timeline.currentTime = Math.max(0, time);
    this.updateActiveChannelValues();
    this.notify();
  }

  setTimelinePlaying(isPlaying: boolean): void {
    this.state.timeline.isPlaying = isPlaying;
    this.notify();
  }

  setSelectedCue(cueId: string | null): void {
    this.state.timeline.selectedCueId = cueId;
    
    if (cueId) {
      const cue = this.state.cues.find((c) => c.id === cueId);
      if (cue) {
        this.state.timeline.currentTime = cue.startTime;
      }
    }
    
    this.notify();
  }

  setZoomLevel(level: number): void {
    this.state.timeline.zoomLevel = Math.max(0.5, Math.min(5, level));
    this.notify();
  }

  clearAll(): void {
    this.state = { ...initialState };
    this.validationResult = null;
    this.parsingErrors = [];
    this.notify();
  }

  loadSampleData(sampleData: {
    fixtures: Fixture[];
    cues: Cue[];
    rules: SceneRules;
  }): void {
    this.state.fixtures = [...sampleData.fixtures];
    this.state.cues = [...sampleData.cues].sort((a, b) => a.startTime - b.startTime);
    this.state.rules = { ...sampleData.rules };
    this.state.dataLoaded = true;
    this.parsingErrors = [];
    
    this.updateTimelineRange();
    this.runValidation();
    this.notify();
  }

  getValidationResult(): ValidationResult | null {
    return this.validationResult;
  }

  private runValidation(): void {
    if (this.state.fixtures.length === 0 || this.state.cues.length === 0) {
      this.validationResult = null;
      this.state.risks = [];
      return;
    }

    const result = validateAll(
      this.state.fixtures,
      this.state.cues,
      this.state.rules
    );

    this.validationResult = result;
    this.state.risks = result.risks;
  }

  private checkDataLoaded(): boolean {
    return this.state.fixtures.length > 0 && this.state.cues.length > 0;
  }

  private updateTimelineRange(): void {
    if (this.state.cues.length === 0) {
      this.state.timeline.currentTime = 0;
      return;
    }

    const maxTime = Math.max(
      ...this.state.cues.map((c) => c.startTime + c.duration + c.fadeOut)
    );

    if (this.state.timeline.currentTime > maxTime) {
      this.state.timeline.currentTime = 0;
    }
  }

  private updateActiveChannelValues(): void {
    const values = new Map<string, number>();
    const currentTime = this.state.timeline.currentTime;

    this.state.cues.forEach((cue) => {
      const cueStartTime = cue.startTime;
      const cueEndTime = cue.startTime + cue.duration + cue.fadeOut;

      if (currentTime >= cueStartTime && currentTime <= cueEndTime) {
        let fadeFactor = 1;

        if (currentTime < cue.startTime + cue.fadeIn) {
          const fadeInProgress = (currentTime - cue.startTime) / cue.fadeIn;
          fadeFactor = Math.min(1, Math.max(0, fadeInProgress));
        }

        if (currentTime > cue.startTime + cue.duration) {
          const fadeOutProgress = (currentTime - (cue.startTime + cue.duration)) / cue.fadeOut;
          fadeFactor = Math.max(0, 1 - fadeOutProgress);
        }

        cue.channelValues.forEach((cv) => {
          const interpolatedValue = Math.round(cv.value * fadeFactor);
          values.set(cv.channelId, interpolatedValue);
        });
      }
    });

    this.state.activeChannelValues = values;
  }
}

export const store = new Store(initialState);
export { initialState };
