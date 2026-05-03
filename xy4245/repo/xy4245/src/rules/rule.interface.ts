import { ScanResult, Issue, IssueType } from '../types';

export interface Rule {
  readonly type: IssueType;
  readonly name: string;
  readonly description: string;
  
  check(scanResult: ScanResult): Issue[];
}
