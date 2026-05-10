package chaos

import (
	"encoding/json"
	"testing"
	"time"
)

func TestDurationStringUnmarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		jsonStr  string
		expected DurationString
		wantErr  bool
	}{
		{
			name:     "string format 60s",
			jsonStr:  `"60s"`,
			expected: DurationString(60 * time.Second),
			wantErr:  false,
		},
		{
			name:     "string format 5m",
			jsonStr:  `"5m"`,
			expected: DurationString(5 * time.Minute),
			wantErr:  false,
		},
		{
			name:     "string format 1h30m",
			jsonStr:  `"1h30m"`,
			expected: DurationString(90 * time.Minute),
			wantErr:  false,
		},
		{
			name:     "empty string",
			jsonStr:  `""`,
			expected: DurationString(0),
			wantErr:  false,
		},
		{
			name:     "int64 format (nanoseconds)",
			jsonStr:  `1000000000`,
			expected: DurationString(1 * time.Second),
			wantErr:  false,
		},
		{
			name:     "float64 format (nanoseconds)",
			jsonStr:  `1000000000.0`,
			expected: DurationString(1 * time.Second),
			wantErr:  false,
		},
		{
			name:     "invalid format",
			jsonStr:  `true`,
			expected: DurationString(0),
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var d DurationString
			err := json.Unmarshal([]byte(tt.jsonStr), &d)

			if (err != nil) != tt.wantErr {
				t.Errorf("UnmarshalJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && d != tt.expected {
				t.Errorf("UnmarshalJSON() = %v, expected %v", d, tt.expected)
			}
		})
	}
}

func TestExperimentConfigUnmarshalJSON(t *testing.T) {
	jsonStr := `{
		"duration": "60s",
		"concurrent_users": 100,
		"requests_per_second": 1000
	}`

	var cfg ExperimentConfig
	err := json.Unmarshal([]byte(jsonStr), &cfg)
	if err != nil {
		t.Fatalf("Failed to unmarshal config: %v", err)
	}

	if cfg.Duration.Duration() != 60*time.Second {
		t.Errorf("Duration = %v, expected 60s", cfg.Duration.Duration())
	}

	if cfg.ConcurrentUsers != 100 {
		t.Errorf("ConcurrentUsers = %d, expected 100", cfg.ConcurrentUsers)
	}

	if cfg.RequestsPerSecond != 1000 {
		t.Errorf("RequestsPerSecond = %d, expected 1000", cfg.RequestsPerSecond)
	}
}

func TestParseDuration(t *testing.T) {
	tests := []struct {
		input    string
		expected DurationString
		wantErr  bool
	}{
		{
			input:    "60s",
			expected: DurationString(60 * time.Second),
			wantErr:  false,
		},
		{
			input:    "60",
			expected: DurationString(60 * time.Second),
			wantErr:  false,
		},
		{
			input:    "5m",
			expected: DurationString(5 * time.Minute),
			wantErr:  false,
		},
		{
			input:    "",
			expected: DurationString(0),
			wantErr:  false,
		},
		{
			input:    "invalid",
			expected: DurationString(0),
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			d, err := ParseDuration(tt.input)

			if (err != nil) != tt.wantErr {
				t.Errorf("ParseDuration() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && d != tt.expected {
				t.Errorf("ParseDuration() = %v, expected %v", d, tt.expected)
			}
		})
	}
}
