package models

import (
	"fmt"
	"io/ioutil"

	"gopkg.in/yaml.v3"
)

type ChannelCase struct {
	ID          string        `yaml:"id"`
	Name        string        `yaml:"name"`
	Description string        `yaml:"description"`
	Category    string        `yaml:"category"`
	Difficulty  string        `yaml:"difficulty"`
	Channels    []ChannelDef  `yaml:"channels"`
	Goroutines  []GoroutineDef `yaml:"goroutines"`
	Steps       []StepDef      `yaml:"steps"`
	Expected    ExpectedOutcome  `yaml:"expected"`
	Hints       []string      `yaml:"hints"`
	Solution    string        `yaml:"solution"`
	Tags        []string      `yaml:"tags"`
}

type ChannelDef struct {
	ID         string `yaml:"id"`
	Name       string `yaml:"name"`
	BufferSize int    `yaml:"buffer_size"`
	IsNil      bool   `yaml:"is_nil"`
}

type GoroutineDef struct {
	ID   string `yaml:"id"`
	Name string `yaml:"name"`
	Role string `yaml:"role"`
}

type StepDef struct {
	Step       int           `yaml:"step"`
	Action     string        `yaml:"action"`
	Goroutine  string        `yaml:"goroutine"`
	Channel    string        `yaml:"channel"`
	Value      interface{}   `yaml:"value"`
	SelectCase []SelectDef   `yaml:"select_case"`
	Timeout    string        `yaml:"timeout"`
	Blocked      bool          `yaml:"blocked"`
	Comment    string        `yaml:"comment"`
}

type SelectDef struct {
	Type      string      `yaml:"type"`
	Channel   string      `yaml:"channel"`
	Value     interface{} `yaml:"value"`
	Direction string      `yaml:"direction"`
	IsDefault bool        `yaml:"is_default"`
}

type ExpectedOutcome struct {
	Deadlock       bool              `yaml:"deadlock"`
	BlockedGoroutines []string       `yaml:"blocked_goroutines"`
	FinalChannels  map[string]ChannelStateDef `yaml:"final_channels"`
	Errors       []ExpectedError     `yaml:"errors"`
}

type ChannelStateDef struct {
	State     string        `yaml:"state"`
	BufferLen int           `yaml:"buffer_len"`
	SendqLen  int           `yaml:"sendq_len"`
	RecvqLen  int           `yaml:"recvq_len"`
}

type ExpectedError struct {
	Type    string `yaml:"type"`
	Message string `yaml:"message"`
	Step    int    `yaml:"step"`
}

func LoadChannelCases(path string) ([]*ChannelCase, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read cases file: %w", err)
	}

	var config struct {
		Cases []*ChannelCase `yaml:"cases"`
	}

	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse cases file: %w", err)
	}

	return config.Cases, nil
}

func LoadSingleCase(path string) (*ChannelCase, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read case file: %w", err)
	}

	var c ChannelCase
	if err := yaml.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("failed to parse case file: %w", err)
	}

	return &c, nil
}

func (c *ChannelCase) Validate() error {
	if c.ID == "" {
		return fmt.Errorf("case id is required")
	}
	if c.Name == "" {
		return fmt.Errorf("case name is required")
	}

	channelMap := make(map[string]bool)
	for _, ch := range c.Channels {
		if ch.ID == "" {
			return fmt.Errorf("channel id is required")
		}
		if channelMap[ch.ID] {
			return fmt.Errorf("duplicate channel id: %s", ch.ID)
		}
		channelMap[ch.ID] = true
	}

	goroutineMap := make(map[string]bool)
	for _, g := range c.Goroutines {
		if g.ID == "" {
			return fmt.Errorf("goroutine id is required")
		}
		if goroutineMap[g.ID] {
			return fmt.Errorf("duplicate goroutine id: %s", g.ID)
		}
		goroutineMap[g.ID] = true
	}

	for i, step := range c.Steps {
		if step.Goroutine != "" && !goroutineMap[step.Goroutine] {
			return fmt.Errorf("step %d references unknown goroutine: %s", i+1, step.Goroutine)
		}
		if step.Channel != "" && !channelMap[step.Channel] {
			return fmt.Errorf("step %d references unknown channel: %s", i+1, step.Channel)
		}
	}

	return nil
}

type AnalysisResult struct {
	CaseID       string
	CaseName     string
	Deadlock      bool
	DeadlockType  string
	Description   string
	BlockedGoroutines []*GoroutineSnapshot
	ChannelStates map[string]*ChannelSnapshot
	RiskLevel     string
	Suggestions   []Suggestion
	Timeline      *Timeline
	Stats         AnalysisStats
}

type Suggestion struct {
	Priority    string
	Category      string
	Description   string
	CodeExample   string
	Reference     string
}

type AnalysisStats struct {
	TotalEvents     int
	TotalChannels   int
	TotalGoroutines int
	BlockedCount    int
	ClosedChannels    int
	NilChannels     int
	Duration        string
}

type RiskLevel string

const (
	RiskLevelHigh    RiskLevel = "HIGH"
	RiskLevelMedium RiskLevel = "MEDIUM"
	RiskLevelLow   RiskLevel = "LOW"
)

func (r *AnalysisResult) HasHighRisk() bool {
	return r.RiskLevel == string(RiskLevelHigh)
}

func (r *AnalysisResult) HasMediumRisk() bool {
	return r.RiskLevel == string(RiskLevelMedium)
}

func (r *AnalysisResult) HasLowRisk() bool {
	return r.RiskLevel == string(RiskLevelLow)
}
