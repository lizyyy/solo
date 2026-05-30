import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Decimal } from 'decimal.js';
import {
  DividendChoice,
  DividendType,
  SourceReference,
  ReconciliationIssue,
} from '../types/models';
import { parseDate, compareDates, isSameDate } from '../utils/dateUtils';

export interface ChoiceQuery {
  accountId: string;
  fundId: string;
  effectiveDate: string;
}

export interface ChoiceWithHistory {
  current: DividendChoice | null;
  history: DividendChoice[];
  effectiveOnRecordDate: DividendChoice | null;
  hasOverlap: boolean;
  hasGap: boolean;
}

export class ChoiceManager {
  private choices: Map<string, DividendChoice[]> = new Map();

  private getKey(accountId: string, fundId: string): string {
    return `${accountId}:${fundId}`;
  }

  public addChoice(choice: Omit<DividendChoice, 'id' | 'createdAt' | 'updatedAt' | 'version'>): DividendChoice {
    const key = this.getKey(choice.accountId, choice.fundId);
    const now = dayjs().toISOString();
    
    const newChoice: DividendChoice = {
      ...choice,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    if (!this.choices.has(key)) {
      this.choices.set(key, []);
    }
    
    const accountChoices = this.choices.get(key)!;
    accountChoices.push(newChoice);
    
    this.sortChoices(accountChoices);

    return newChoice;
  }

  private sortChoices(choices: DividendChoice[]): void {
    choices.sort((a, b) => compareDates(a.effectiveDate, b.effectiveDate));
  }

  public getChoice(query: ChoiceQuery): DividendChoice | null {
    const key = this.getKey(query.accountId, query.fundId);
    const accountChoices = this.choices.get(key);
    
    if (!accountChoices || accountChoices.length === 0) {
      return null;
    }

    const targetDate = parseDate(query.effectiveDate);
    
    for (let i = accountChoices.length - 1; i >= 0; i--) {
      const choice = accountChoices[i];
      const effectiveDate = parseDate(choice.effectiveDate);
      
      if (effectiveDate.isAfter(targetDate)) {
        continue;
      }
      
      if (choice.expiryDate) {
        const expiryDate = parseDate(choice.expiryDate);
        if (expiryDate.isBefore(targetDate)) {
          continue;
        }
      }
      
      return choice;
    }

    return accountChoices[0] || null;
  }

  public getChoiceWithHistory(query: ChoiceQuery): ChoiceWithHistory {
    const key = this.getKey(query.accountId, query.fundId);
    const accountChoices = this.choices.get(key) || [];
    
    const current = this.getChoice(query);
    const history = [...accountChoices].sort((a, b) => 
      compareDates(b.effectiveDate, a.effectiveDate)
    );
    
    const effectiveOnRecordDate = this.getChoice(query);
    
    const { hasOverlap, hasGap } = this.checkChoiceContinuity(accountChoices);

    return {
      current,
      history,
      effectiveOnRecordDate,
      hasOverlap,
      hasGap,
    };
  }

  private checkChoiceContinuity(choices: DividendChoice[]): { hasOverlap: boolean; hasGap: boolean } {
    let hasOverlap = false;
    let hasGap = false;

    if (choices.length <= 1) {
      return { hasOverlap, hasGap };
    }

    const sorted = [...choices];
    this.sortChoices(sorted);

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      
      const currentEnd = current.expiryDate 
        ? parseDate(current.expiryDate)
        : parseDate(next.effectiveDate).subtract(1, 'day');
      
      const nextStart = parseDate(next.effectiveDate);
      
      if (nextStart.isBefore(currentEnd)) {
        hasOverlap = true;
      }
      
      if (nextStart.isAfter(currentEnd.add(1, 'day'))) {
        hasGap = true;
      }
    }

    return { hasOverlap, hasGap };
  }

  public updateChoice(
    choiceId: string,
    updates: Partial<DividendChoice>,
    changeReason?: string
  ): DividendChoice | null {
    for (const [, choices] of this.choices) {
      const index = choices.findIndex(c => c.id === choiceId);
      if (index !== -1) {
        const original = choices[index];
        const updated: DividendChoice = {
          ...original,
          ...updates,
          version: original.version + 1,
          updatedAt: dayjs().toISOString(),
        };
        choices[index] = updated;
        return updated;
      }
    }
    return null;
  }

  public expireChoice(choiceId: string, expiryDate: string): DividendChoice | null {
    return this.updateChoice(choiceId, { expiryDate });
  }

  public switchDividendType(
    query: ChoiceQuery,
    newType: DividendType,
    source: SourceReference,
    changeReason?: string
  ): DividendChoice {
    const existing = this.getChoice(query);
    
    const newChoice = this.addChoice({
      accountId: query.accountId,
      fundId: query.fundId,
      dividendType: newType,
      effectiveDate: query.effectiveDate,
      source,
    });

    if (existing) {
      const dayBefore = parseDate(query.effectiveDate).subtract(1, 'day');
      this.expireChoice(existing.id, dayBefore.format('YYYY-MM-DD'));
    }

    return newChoice;
  }

  public validateChoicesForAnnouncement(
    announcementRegistrationDate: string,
    accountIds: string[],
    fundId: string
  ): {
    valid: string[];
    invalid: {
      accountId: string;
      reason: string;
      issues: ReconciliationIssue[];
    }[];
  } {
    const valid: string[] = [];
    const invalid: {
      accountId: string;
      reason: string;
      issues: ReconciliationIssue[];
    }[] = [];

    for (const accountId of accountIds) {
      const result = this.getChoiceWithHistory({
        accountId,
        fundId,
        effectiveDate: announcementRegistrationDate,
      });

      const issues: ReconciliationIssue[] = [];

      if (!result.effectiveOnRecordDate) {
        invalid.push({
          accountId,
          reason: '未找到权益登记日有效的分红方式选择',
          issues,
        });
        continue;
      }

      if (result.hasOverlap) {
        issues.push({
          id: uuidv4(),
          type: 'choice_mismatch',
          severity: 'warning',
          message: '分红方式选择存在日期重叠，请确认有效性',
          sourceReferences: result.history.map(h => h.source),
          resolved: false,
          createdAt: dayjs().toISOString(),
        });
      }

      if (result.hasGap) {
        issues.push({
          id: uuidv4(),
          type: 'choice_mismatch',
          severity: 'warning',
          message: '分红方式选择存在日期断层，请确认有效性',
          sourceReferences: result.history.map(h => h.source),
          resolved: false,
          createdAt: dayjs().toISOString(),
        });
      }

      if (issues.length > 0) {
        invalid.push({
          accountId,
          reason: '分红方式选择存在警告',
          issues,
        });
      } else {
        valid.push(accountId);
      }
    }

    return { valid, invalid };
  }

  public importChoices(choices: Omit<DividendChoice, 'id' | 'createdAt' | 'updatedAt' | 'version'>[]): DividendChoice[] {
    return choices.map(c => this.addChoice(c));
  }

  public getAllChoices(): DividendChoice[] {
    const all: DividendChoice[] = [];
    for (const [, choices] of this.choices) {
      all.push(...choices);
    }
    return all;
  }

  public clear(): void {
    this.choices.clear();
  }
}
