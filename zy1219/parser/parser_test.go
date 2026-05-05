package parser

import (
	"strings"
	"testing"
)

func TestGCTraceParser_Parse(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		expectErr  bool
		expectCount int
	}{
		{
			name: "valid single GC line",
			input: `gc 1 @0.001s 0%: 0.010+0.48+0.005 ms clock, 0.020+0/0.30/0.25+0.010 ms cpu, 4->4->2 MB, 5 MB goal, 4 P
`,
			expectErr:   false,
			expectCount: 1,
		},
		{
			name: "valid multiple GC lines",
			input: `gc 1 @0.001s 0%: 0.010+0.48+0.005 ms clock, 0.020+0/0.30/0.25+0.010 ms cpu, 4->4->2 MB, 5 MB goal, 4 P
gc 2 @0.005s 1%: 0.015+0.62+0.008 ms clock, 0.030+0/0.45/0.30+0.016 ms cpu, 6->6->3 MB, 7 MB goal, 4 P
gc 3 @0.012s 2%: 0.012+0.85+0.010 ms clock, 0.024+0/0.60/0.40+0.020 ms cpu, 8->8->4 MB, 10 MB goal, 4 P
`,
			expectErr:   false,
			expectCount: 3,
		},
		{
			name: "GC line with assist",
			input: `gc 14 @8.000s 13%: 0.080+45.00+0.080 ms clock, 0.160+0/32.00/25.00+0.160 ms cpu, 777->777->388 MB, 971 MB goal, 4 P, assisted: 12 goroutines, 156.25 MB
`,
			expectErr:   false,
			expectCount: 1,
		},
		{
			name: "empty lines should be skipped",
			input: `

gc 1 @0.001s 0%: 0.010+0.48+0.005 ms clock, 0.020+0/0.30/0.25+0.010 ms cpu, 4->4->2 MB, 5 MB goal, 4 P

`,
			expectErr:   false,
			expectCount: 1,
		},
		{
			name: "invalid GC number format",
			input: `gc INVALID @0.001s 0%: 0.010+0.48+0.005 ms clock, 0.020+0/0.30/0.25+0.010 ms cpu, 4->4->2 MB, 5 MB goal, 4 P
`,
			expectErr:   true,
			expectCount: 0,
		},
	}

	parser := NewGCTraceParser()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := strings.NewReader(tt.input)
			entries, err := parser.Parse(reader)

			if tt.expectErr {
				if err == nil {
					t.Error("expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if len(entries) != tt.expectCount {
					t.Errorf("expected %d entries, got %d", tt.expectCount, len(entries))
				}
			}
		})
	}
}

func TestHeapSampleParser_Parse(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		expectErr  bool
		expectCount int
	}{
		{
			name: "valid CSV data",
			input: `timestamp,heap_alloc,heap_sys,heap_inuse,heap_idle,heap_released,heap_objects,mallocs,frees,next_gc,last_gc,num_gc,num_forced_gc,gc_cpu_fraction
2026-05-05T10:00:00Z,4194304,8388608,4194304,4194304,0,1024,2048,1024,5242880,0,0,0,0.00
`,
			expectErr:   false,
			expectCount: 1,
		},
		{
			name: "multiple CSV rows",
			input: `timestamp,heap_alloc,heap_sys,heap_inuse,heap_idle,heap_released,heap_objects,mallocs,frees,next_gc,last_gc,num_gc,num_forced_gc,gc_cpu_fraction
2026-05-05T10:00:00Z,4194304,8388608,4194304,4194304,0,1024,2048,1024,5242880,0,0,0,0.00
2026-05-05T10:00:01Z,6291456,10485760,6291456,4194304,0,1536,3072,1536,7340032,0,1,0,0.01
2026-05-05T10:00:02Z,8388608,12582912,8388608,4194304,0,2048,4096,2048,10485760,1000000,2,0,0.02
`,
			expectErr:   false,
			expectCount: 3,
		},
		{
			name: "missing header fields",
			input: `timestamp,heap_alloc,heap_sys
2026-05-05T10:00:00Z,4194304,8388608
`,
			expectErr:   true,
			expectCount: 0,
		},
	}

	parser := NewHeapSampleParser()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := strings.NewReader(tt.input)
			samples, err := parser.Parse(reader)

			if tt.expectErr {
				if err == nil {
					t.Error("expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if len(samples) != tt.expectCount {
					t.Errorf("expected %d samples, got %d", tt.expectCount, len(samples))
				}
			}
		})
	}
}

func TestAllocEventParser_Parse(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		expectErr  bool
		expectCount int
	}{
		{
			name: "valid JSONL data",
			input: `{"timestamp":"2026-05-05T10:00:00.001Z","type":"alloc","size":8192,"address":140737488355328,"stack":"runtime.allocm","goroutine":1}
`,
			expectErr:   false,
			expectCount: 1,
		},
		{
			name: "multiple JSONL lines",
			input: `{"timestamp":"2026-05-05T10:00:00.001Z","type":"alloc","size":8192,"address":140737488355328,"stack":"runtime.allocm","goroutine":1}
{"timestamp":"2026-05-05T10:00:00.002Z","type":"alloc","size":4096,"address":140737488363520,"stack":"runtime.allocm","goroutine":5}
{"timestamp":"2026-05-05T10:00:00.005Z","type":"free","size":8192,"address":140737488355328,"stack":"runtime.mcentral_cacheSpan","goroutine":1}
`,
			expectErr:   false,
			expectCount: 3,
		},
		{
			name: "invalid JSON format",
			input: `{"timestamp":"2026-05-05T10:00:00.001Z","type":"alloc","size":8192
invalid json
`,
			expectErr:   true,
			expectCount: 0,
		},
	}

	parser := NewAllocEventParser()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := strings.NewReader(tt.input)
			events, err := parser.Parse(reader)

			if tt.expectErr {
				if err == nil {
					t.Error("expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if len(events) != tt.expectCount {
					t.Errorf("expected %d events, got %d", tt.expectCount, len(events))
				}
			}
		})
	}
}

func TestValidateGCTraceFormat(t *testing.T) {
	tests := []struct {
		name     string
		line     string
		expectErr bool
	}{
		{
			name:     "valid gc line",
			line:     "gc 1 @0.001s 0%: 0.010+0.48+0.005 ms clock, 0.020+0/0.30/0.25+0.010 ms cpu, 4->4->2 MB, 5 MB goal, 4 P",
			expectErr: false,
		},
		{
			name:     "valid scvg line",
			line:     "scvg: 8 KB released",
			expectErr: false,
		},
		{
			name:     "empty line",
			line:     "",
			expectErr: false,
		},
		{
			name:     "invalid line format",
			line:     "这是一个无效的 GC 日志行",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateGCTraceFormat(tt.line)

			if tt.expectErr {
				if err == nil {
					t.Error("expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestParseError_Error(t *testing.T) {
	err := &ParseError{
		LineNumber: 5,
		Line:       "invalid line",
		Message:    "unrecognized format",
		Cause:      nil,
	}

	expected := "line 5: unrecognized format: invalid line"
	if err.Error() != expected {
		t.Errorf("expected '%s', got '%s'", expected, err.Error())
	}
}
