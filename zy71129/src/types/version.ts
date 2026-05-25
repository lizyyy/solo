
import { ModelElement, Point3D } from './model';

export type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ElementChange {
  elementId: string;
  type: ChangeType;
  oldElement?: ModelElement;
  newElement?: ModelElement;
  changes?: {
    property: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface VersionDiff {
  versionA: number;
  versionB: number;
  changes: ElementChange[];
  statistics: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

export interface CompareViewState {
  enabled: boolean;
  viewMode: 'sideBySide' | 'split' | 'overlay';
  syncViews: boolean;
  highlightDiff: boolean;
}
