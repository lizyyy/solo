export interface BenchmarkConfig {
  test_name: string;
  array_size: number;
  stride: number;
  thread_count: number;
  cache_line_size: number;
  iterations: number;
  seed: number;
  struct_layout: string;
  numa_node: number;
}

export interface BenchmarkResult {
  test_name: string;
  total_time_ms: number;
  throughput_mbs: number;
  avg_latency_ns: number;
  cache_hits: number;
  cache_misses: number;
  latency_timeline: number[];
  thread_conflicts: number[];
  metadata: {
    config?: Record<string, any>;
    layout_analysis?: {
      layout_type: string;
      issue: string;
      description: string;
    };
    numa_slowdown?: {
      local_local_ms: number;
      local_remote_ms: number;
      slowdown_factor: number;
      slowdown_percent: number;
    };
    optimization_suggestions?: string[];
  };
  config: BenchmarkConfig;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  config: BenchmarkConfig;
  result?: BenchmarkResult;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface ExperimentListItem {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  has_result: boolean;
  test_name: string;
  tags: string[];
}

export interface Comparison {
  id: string;
  name: string;
  experiment_ids: string[];
  metrics: string[];
  created_at: string;
  notes: string;
}

export interface MetricComparison {
  metric: string;
  baseline_value: number;
  values: {
    experiment_id: string;
    experiment_name: string;
    value: number;
    relative_change_pct: number;
  }[];
}

export interface ComparisonAnalysis {
  comparison_id: string;
  name: string;
  experiments: {
    id: string;
    name: string;
    config: BenchmarkConfig;
    result: BenchmarkResult;
  }[];
  metrics: string[];
  baseline_index: number;
  comparisons: MetricComparison[];
}

export interface TestInfo {
  name: string;
  description: string;
  config_params: string[];
}
