const Comparator = require('../services/comparator');

describe('Comparator', () => {
  describe('formatMetricName', () => {
    test('should format metric names correctly', () => {
      expect(Comparator.formatMetricName('ns_op')).toBe('ns/op');
      expect(Comparator.formatMetricName('b_op')).toBe('B/op');
      expect(Comparator.formatMetricName('allocs_op')).toBe('allocs/op');
      expect(Comparator.formatMetricName('mb_s')).toBe('MB/s');
      expect(Comparator.formatMetricName('unknown')).toBe('unknown');
    });
  });

  describe('formatComparisonResult', () => {
    test('should format comparison result with text output', () => {
      const comparison = {
        baseRun: { run_id: 'v1.0.0' },
        newRun: { run_id: 'v1.1.0' },
        overallStatus: 'improvement',
        summary: {
          regressions: 0,
          improvements: 1,
          unchanged: 2
        },
        details: [
          {
            benchmark_name: 'BenchmarkTest-8',
            metric: 'ns_op',
            base_value: 1000,
            new_value: 800,
            delta_percent: -20.0,
            status: 'improvement',
            threshold_exceeded: true
          },
          {
            benchmark_name: 'BenchmarkTest-8',
            metric: 'b_op',
            base_value: 256,
            new_value: 256,
            delta_percent: 0.0,
            status: 'unchanged',
            threshold_exceeded: false
          }
        ]
      };

      const formatted = Comparator.formatComparisonResult(comparison);
      
      expect(formatted).toContain('Comparison: v1.0.0 vs v1.1.0');
      expect(formatted).toContain('Overall Status: IMPROVEMENT');
      expect(formatted).toContain('[IMPROVEMENT]');
      expect(formatted).toContain('-20.00%');
    });

    test('should handle empty details', () => {
      const comparison = {
        baseRun: { run_id: 'v1.0.0' },
        newRun: { run_id: 'v1.1.0' },
        overallStatus: 'unchanged',
        summary: {
          regressions: 0,
          improvements: 0,
          unchanged: 0
        },
        details: []
      };

      const formatted = Comparator.formatComparisonResult(comparison);
      
      expect(formatted).toContain('No benchmarks to compare.');
    });
  });
});
