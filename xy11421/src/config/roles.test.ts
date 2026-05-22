import { getPermission, canPerformAction, getVisibleFields } from './roles';

describe('权限系统', () => {
  describe('canPerformAction', () => {
    it('录入员应能导入但不能修复', () => {
      expect(canPerformAction('entry', 'import')).toBe(true);
      expect(canPerformAction('entry', 'fix')).toBe(false);
    });

    it('复核员应能导入和修复', () => {
      expect(canPerformAction('review', 'import')).toBe(true);
      expect(canPerformAction('review', 'fix')).toBe(true);
      expect(canPerformAction('review', 'export')).toBe(false);
    });

    it('主管应能执行所有操作', () => {
      expect(canPerformAction('supervisor', 'init')).toBe(true);
      expect(canPerformAction('supervisor', 'import')).toBe(true);
      expect(canPerformAction('supervisor', 'fix')).toBe(true);
      expect(canPerformAction('supervisor', 'export')).toBe(true);
      expect(canPerformAction('supervisor', 'history')).toBe(true);
    });

    it('只读用户只能查看和报告', () => {
      expect(canPerformAction('readonly', 'view')).toBe(true);
      expect(canPerformAction('readonly', 'report')).toBe(true);
      expect(canPerformAction('readonly', 'import')).toBe(false);
      expect(canPerformAction('readonly', 'fix')).toBe(false);
    });
  });

  describe('getVisibleFields', () => {
    it('主管应看到所有字段', () => {
      const fields = getVisibleFields('supervisor', 'inspection');
      expect(fields).toEqual(['*']);
    });

    it('只读用户看到的字段比录入员少', () => {
      const readonlyFields = getVisibleFields('readonly', 'inspection');
      const entryFields = getVisibleFields('entry', 'inspection');
      expect(readonlyFields.length).toBeLessThan(entryFields.length);
    });
  });

  describe('getPermission', () => {
    it('应返回正确的权限配置', () => {
      const perm = getPermission('supervisor');
      expect(perm.allowedActions).toContain('export');
      expect(perm.allowedActions).toContain('history');
    });
  });
});
