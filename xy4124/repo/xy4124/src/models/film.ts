import { BaseEntity } from './common';

export enum SoundFormat {
  DOLBY_5_1 = 'dolby_5_1',
  DOLBY_7_1 = 'dolby_7_1',
  DOLBY_ATMOS = 'dolby_atmos',
  DTS = 'dts',
  PCM = 'pcm',
}

export enum AspectRatio {
  RATIO_1_85 = '1.85',
  RATIO_2_39 = '2.39',
  RATIO_16_9 = '16:9',
}

export enum SubtitleType {
  EMBEDDED = 'embedded',
  SIDELOAD = 'sideload',
  NONE = 'none',
}

export interface FilmVersion extends BaseEntity {
  filmId: string;
  filmTitle: string;
  versionId: string;
  versionName: string;
  audioLanguage: string;
  subtitleLanguage: string;
  subtitleType: SubtitleType;
  aspectRatio: AspectRatio;
  soundFormat: SoundFormat;
  runtimeMinutes: number;
  dcpHash: string;
  notes?: string;
  isActive: boolean;
}

export interface FilmVersionCreateInput {
  filmId: string;
  filmTitle: string;
  versionId: string;
  versionName: string;
  audioLanguage: string;
  subtitleLanguage: string;
  subtitleType: SubtitleType;
  aspectRatio: AspectRatio;
  soundFormat: SoundFormat;
  runtimeMinutes: number;
  dcpHash: string;
  notes?: string;
}
