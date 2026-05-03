import { FocusOrderChecker } from './focus-order.checker';
import { FocusVisibilityChecker } from './focus-visibility.checker';
import { SkipLinkChecker } from './skip-link.checker';
import { FormLabelChecker } from './form-label.checker';
import { ButtonNameChecker } from './button-name.checker';
import { ModalTrapChecker } from './modal-trap.checker';
import { Checker, CheckerContext, CheckerResult } from './types';
import { AccessibilityIssue } from '../types';

export {
  FocusOrderChecker,
  FocusVisibilityChecker,
  SkipLinkChecker,
  FormLabelChecker,
  ButtonNameChecker,
  ModalTrapChecker,
};

export type { Checker, CheckerContext, CheckerResult };

export const allCheckers: Record<string, new () => Checker> = {
  'focus-order': FocusOrderChecker,
  'focus-visibility': FocusVisibilityChecker,
  'skip-link': SkipLinkChecker,
  'form-label': FormLabelChecker,
  'button-name': ButtonNameChecker,
  'modal-trap': ModalTrapChecker,
};

export const defaultCheckers: string[] = [
  'focus-order',
  'focus-visibility',
  'skip-link',
  'form-label',
  'button-name',
  'modal-trap',
];

export function getChecker(name: string): Checker | null {
  const CheckerClass = allCheckers[name];
  if (CheckerClass) {
    return new CheckerClass();
  }
  return null;
}

export function getCheckers(names: string[]): Checker[] {
  const checkers: Checker[] = [];
  for (const name of names) {
    const checker = getChecker(name);
    if (checker) {
      checkers.push(checker);
    }
  }
  return checkers;
}

export async function runAllCheckers(
  context: CheckerContext,
  checkerNames?: string[]
): Promise<{
  issues: AccessibilityIssue[];
  metadata: Record<string, Record<string, unknown>>;
}> {
  const names = checkerNames || defaultCheckers;
  const checkers = getCheckers(names);
  const allIssues: AccessibilityIssue[] = [];
  const allMetadata: Record<string, Record<string, unknown>> = {};

  for (const checker of checkers) {
    try {
      const result = await checker.check(context);
      allIssues.push(...result.issues);
      if (result.metadata) {
        allMetadata[checker.name] = result.metadata;
      }
    } catch (error) {
      console.error(`Checker ${checker.name} failed:`, error);
    }
  }

  return {
    issues: allIssues,
    metadata: allMetadata,
  };
}

export function getCheckerDescriptions(): Array<{ name: string; description: string }> {
  return Object.entries(allCheckers).map(([name, CheckerClass]) => {
    const instance = new CheckerClass();
    return {
      name: instance.name,
      description: instance.description,
    };
  });
}
