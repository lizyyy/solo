import { Issue, Suggestion, Severity, IssueCategory } from '../types';

export abstract class BaseAnalyzer {
  protected issues: Issue[] = [];
  protected suggestions: Suggestion[] = [];
  protected issueIdCounter: number = 0;
  protected suggestionIdCounter: number = 0;

  protected addIssue(
    category: IssueCategory,
    severity: Severity,
    title: string,
    description: string,
    affectedObjects: string[] = [],
    evidence: string = ''
  ): void {
    this.issues.push({
      id: `ISSUE-${++this.issueIdCounter}`,
      category,
      severity,
      title,
      description,
      affectedObjects,
      evidence
    });
  }

  protected addSuggestion(
    title: string,
    description: string,
    priority: 'high' | 'medium' | 'low',
    implementation: string = ''
  ): void {
    this.suggestions.push({
      id: `SUGG-${++this.suggestionIdCounter}`,
      title,
      description,
      priority,
      implementation
    });
  }

  getIssues(): Issue[] {
    return [...this.issues];
  }

  getSuggestions(): Suggestion[] {
    return [...this.suggestions];
  }

  abstract analyze(): void;
}
