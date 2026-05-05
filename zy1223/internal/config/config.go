package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type InterfaceCase struct {
	Name        string   `yaml:"name" json:"name"`
	Category    string   `yaml:"category" json:"category"`
	Description string   `yaml:"description" json:"description"`
	SourceFile  string   `yaml:"source_file" json:"source_file"`
	LineNumber  int      `yaml:"line_number" json:"line_number"`
	Tags        []string `yaml:"tags" json:"tags"`
}

type CallRecord struct {
	Timestamp   string `json:"timestamp"`
	Operation   string `json:"operation"`
	Interface   string `json:"interface"`
	Concrete    string `json:"concrete"`
	Allocation  bool   `json:"allocation"`
	MethodCall  string `json:"method_call"`
	SourceFile  string `json:"source_file"`
	LineNumber  int    `json:"line_number"`
}

type InterfaceConfig struct {
	Cases []InterfaceCase `yaml:"cases"`
}

func LoadInterfaceCases(filePath string) (*InterfaceConfig, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read interface cases file: %w", err)
	}

	var config InterfaceConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	return &config, nil
}

func LoadCallRecords(filePath string) ([]CallRecord, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read calls file: %w", err)
	}

	lines := splitLines(data)
	var records []CallRecord

	for i, line := range lines {
		if len(line) == 0 {
			continue
		}

		var record CallRecord
		if err := json.Unmarshal([]byte(line), &record); err != nil {
			return nil, fmt.Errorf("line %d: failed to parse JSON: %w", i+1, err)
		}
		records = append(records, record)
	}

	return records, nil
}

func LoadSnippets(dirPath string) (map[string]string, error) {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read snippets directory: %w", err)
	}

	snippets := make(map[string]string)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if filepath.Ext(entry.Name()) != ".go" {
			continue
		}

		filePath := filepath.Join(dirPath, entry.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to read snippet %s: %w", entry.Name(), err)
		}
		snippets[entry.Name()] = string(data)
	}

	return snippets, nil
}

func splitLines(data []byte) []string {
	var lines []string
	var current []byte

	for _, b := range data {
		if b == '\n' {
			if len(current) > 0 {
				lines = append(lines, string(current))
				current = nil
			}
		} else {
			current = append(current, b)
		}
	}

	if len(current) > 0 {
		lines = append(lines, string(current))
	}

	return lines
}
