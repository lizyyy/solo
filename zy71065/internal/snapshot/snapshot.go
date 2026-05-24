package snapshot

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"proto-enum-lint/pkg/types"
)

type Manager struct {
	outputDir string
	service   string
}

func NewManager(outputDir, service string) *Manager {
	return &Manager{
		outputDir: outputDir,
		service:   service,
	}
}

func (m *Manager) Save(files []types.ProtoFile, version string) (string, error) {
	if err := os.MkdirAll(m.outputDir, 0755); err != nil {
		return "", fmt.Errorf("create output dir: %w", err)
	}

	snap := types.Snapshot{
		Version:   version,
		Timestamp: time.Now(),
		Service:   m.service,
		Files:     files,
	}

	filename := fmt.Sprintf("snapshot_%s_%s.json",
		m.service,
		time.Now().Format("20060102_150405"))
	if version != "" {
		filename = fmt.Sprintf("snapshot_%s_%s.json", m.service, version)
	}

	filePath := filepath.Join(m.outputDir, filename)

	data, err := json.MarshalIndent(snap, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal snapshot: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", fmt.Errorf("write snapshot: %w", err)
	}

	return filePath, nil
}

func (m *Manager) Load(snapshotFile string) (*types.Snapshot, error) {
	data, err := os.ReadFile(snapshotFile)
	if err != nil {
		return nil, fmt.Errorf("read snapshot: %w", err)
	}

	var snap types.Snapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return nil, fmt.Errorf("unmarshal snapshot: %w", err)
	}

	return &snap, nil
}

func (m *Manager) List() ([]string, error) {
	pattern := filepath.Join(m.outputDir, fmt.Sprintf("snapshot_%s_*.json", m.service))
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return nil, err
	}
	return matches, nil
}

func (m *Manager) GetLatest() (*types.Snapshot, string, error) {
	files, err := m.List()
	if err != nil {
		return nil, "", err
	}

	if len(files) == 0 {
		return nil, "", fmt.Errorf("no snapshots found")
	}

	var latestFile string
	var latestTime time.Time

	for _, f := range files {
		info, err := os.Stat(f)
		if err != nil {
			continue
		}
		if info.ModTime().After(latestTime) {
			latestTime = info.ModTime()
			latestFile = f
		}
	}

	if latestFile == "" {
		return nil, "", fmt.Errorf("no valid snapshots found")
	}

	snap, err := m.Load(latestFile)
	if err != nil {
		return nil, "", err
	}

	return snap, latestFile, nil
}
