const PlanGenerator = require('../../src/services/planGenerator');
const MigrationParser = require('../../src/services/migrationParser');

describe('PlanGenerator', () => {
  describe('buildDependencyGraph', () => {
    it('should build dependency graph with explicit dependencies', () => {
      const migrations = [
        { id: '1', version: '0001', name: 'first', dependencies: [] },
        { id: '2', version: '0002', name: 'second', dependencies: ['0001'] },
        { id: '3', version: '0003', name: 'third', dependencies: ['0002'] }
      ];
      
      const { graph } = PlanGenerator.buildDependencyGraph(migrations, 'up');
      
      expect(graph.size).toBe(3);
      expect(graph.get('2').dependencies).toContain('1');
      expect(graph.get('3').dependencies).toContain('2');
    });

    it('should add implicit dependencies based on version order', () => {
      const migrations = [
        { id: '1', version: '0001', name: 'first', dependencies: [] },
        { id: '2', version: '0002', name: 'second', dependencies: [] },
        { id: '3', version: '0003', name: 'third', dependencies: [] }
      ];
      
      const { graph } = PlanGenerator.buildDependencyGraph(migrations, 'up');
      
      expect(graph.get('2').dependencies).toContain('1');
      expect(graph.get('3').dependencies).toContain('2');
      expect(graph.get('3').dependencies).toContain('1');
    });
  });

  describe('topologicalSort', () => {
    it('should sort simple dependency graph correctly', () => {
      const graph = new Map();
      graph.set('1', { id: '1', version: '0001', dependencies: [], migration: { id: '1', version: '0001' } });
      graph.set('2', { id: '2', version: '0002', dependencies: ['1'], migration: { id: '2', version: '0002' } });
      graph.set('3', { id: '3', version: '0003', dependencies: ['2'], migration: { id: '3', version: '0003' } });
      
      const sorted = PlanGenerator.topologicalSort(graph, 'up');
      
      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('3');
    });

    it('should throw error for circular dependencies', () => {
      const graph = new Map();
      graph.set('1', { id: '1', version: '0001', dependencies: ['2'], migration: { id: '1', version: '0001' } });
      graph.set('2', { id: '2', version: '0002', dependencies: ['1'], migration: { id: '2', version: '0002' } });
      
      expect(() => PlanGenerator.topologicalSort(graph, 'up')).toThrow(/Circular dependency/);
    });
  });

  describe('validatePlan', () => {
    it('should validate apply plan with destructive operations', () => {
      const plan = {
        action: 'apply',
        migrations: [
          {
            id: '1',
            version: '0001',
            name: 'drop_table',
            up_sql: 'DROP TABLE users;',
            down_sql: ''
          }
        ]
      };
      
      const result = PlanGenerator.validatePlan(plan);
      
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe('destructive_operation');
      expect(result.issues[0].severity).toBe('warning');
    });

    it('should validate rollback plan with missing down scripts', () => {
      const plan = {
        action: 'rollback',
        migrations: [
          {
            id: '1',
            version: '0001',
            name: 'no_down',
            down_sql: null
          }
        ]
      };
      
      const result = PlanGenerator.validatePlan(plan);
      
      expect(result.valid).toBe(false);
      expect(result.issues[0].type).toBe('missing_down');
      expect(result.issues[0].severity).toBe('error');
    });
  });
});
