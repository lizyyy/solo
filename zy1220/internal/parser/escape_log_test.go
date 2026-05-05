package parser

import (
	"strings"
	"testing"

	"escape-analyzer/pkg/types"
)

func TestEscapeLogParser_Parse(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		expectedCount  int
		expectedReasons []types.EscapeReason
	}{
		{
			name: "basic escape to heap",
			input: `main.go:10:6: x escapes to heap
main.go:15:2: moved to heap: y`,
			expectedCount: 2,
		},
		{
			name: "leaking param",
			input: `main.go:5:10: leaking param: p`,
			expectedCount:  1,
			expectedReasons: []types.EscapeReason{types.EscapeReasonPointerReturn},
		},
		{
			name: "interface conversion",
			input: `main.go:20:8: runtime.convT64 escapes to heap
main.go:25:12: interface conversion`,
			expectedCount: 1,
		},
		{
			name: "mixed valid and invalid lines",
			input: `# some-random-package
main.go:10:6: x escapes to heap
This is not an escape log line
main.go:15:2: moved to heap: y`,
			expectedCount: 2,
		},
	}

	parser := NewEscapeLogParser()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entries, err := parser.Parse(strings.NewReader(tt.input))
			if err != nil {
				t.Fatalf("Parse() error = %v", err)
			}

			if len(entries) != tt.expectedCount {
				t.Errorf("Parse() got %d entries, want %d", len(entries), tt.expectedCount)
			}

			if len(tt.expectedReasons) > 0 {
				for i, expectedReason := range tt.expectedReasons {
					if i < len(entries) && entries[i].Reason != expectedReason {
						t.Errorf("Entry[%d] reason = %v, want %v", i, entries[i].Reason, expectedReason)
					}
				}
			}
		})
	}
}

func TestEscapeLogParser_ParseBenchmark(t *testing.T) {
	tests := []struct {
		name          string
		input         string
		expectedCount int
		expectedNames []string
	}{
		{
			name: "standard benchmark output",
			input: `BenchmarkFunction-8   	 1000000	      1234 ns/op	     567 B/op	       8 allocs/op`,
			expectedCount: 1,
			expectedNames: []string{"Function"},
		},
		{
			name: "benchmark with MB/s",
			input: `BenchmarkBufferWrite-8   	   50000	     23456 ns/op	  425.98 MB/s	    1024 B/op	       2 allocs/op`,
			expectedCount: 1,
			expectedNames: []string{"BufferWrite"},
		},
		{
			name: "multiple benchmarks",
			input: `BenchmarkA-8   	 1000000	      100 ns/op
BenchmarkB-8   	  500000	      200 ns/op`,
			expectedCount: 2,
			expectedNames: []string{"A", "B"},
		},
	}

	parser := NewEscapeLogParser()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			benchmarks, err := parser.ParseBenchmark(strings.NewReader(tt.input))
			if err != nil {
				t.Fatalf("ParseBenchmark() error = %v", err)
			}

			if len(benchmarks) != tt.expectedCount {
				t.Errorf("ParseBenchmark() got %d benchmarks, want %d", len(benchmarks), tt.expectedCount)
			}

			if len(tt.expectedNames) > 0 {
				for i, expectedName := range tt.expectedNames {
					if i < len(benchmarks) && benchmarks[i].Name != expectedName {
						t.Errorf("Benchmark[%d] name = %v, want %v", i, benchmarks[i].Name, expectedName)
					}
				}
			}
		})
	}
}

func TestDetermineReason(t *testing.T) {
	parser := NewEscapeLogParser()

	tests := []struct {
		name     string
		line     string
		variable string
		expected types.EscapeReason
	}{
		{
			name:     "interface conversion",
			line:     "main.go:10:8: runtime.convT64 escapes to heap",
			variable: "runtime.convT64",
			expected: types.EscapeReasonInterfaceBox,
		},
		{
			name:     "leaking param",
			line:     "main.go:5:10: leaking param: p",
			variable: "p",
			expected: types.EscapeReasonPointerReturn,
		},
		{
			name:     "goroutine",
			line:     "main.go:20:5: go func() uses var",
			variable: "var",
			expected: types.EscapeReasonGoroutine,
		},
		{
			name:     "unknown reason",
			line:     "main.go:15:6: x escapes to heap",
			variable: "x",
			expected: types.EscapeReasonUnknown,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reason := parser.determineReason(tt.line, tt.variable)
			if reason != tt.expected {
				t.Errorf("determineReason() = %v, want %v", reason, tt.expected)
			}
		})
	}
}
