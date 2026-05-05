package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"escape-analyzer/pkg/types"
)

const (
	historyDir   = ".escape-history"
	indexFile    = "index.json"
	historyLimit = 100
)

type HistoryEntry struct {
	ID          string    `json:"id"`
	Timestamp   time.Time `json:"timestamp"`
	Description string    `json:"description"`
	EscapeCount int       `json:"escape_count"`
	FileName    string    `json:"file_name"`
}

type Index struct {
	Entries []HistoryEntry `json:"entries"`
}

type Store struct {
	baseDir string
}

func NewStore() (*Store, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	baseDir := filepath.Join(home, historyDir)
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create history directory: %w", err)
	}

	return &Store{baseDir: baseDir}, nil
}

func NewStoreWithDir(baseDir string) (*Store, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create history directory: %w", err)
	}
	return &Store{baseDir: baseDir}, nil
}

func (s *Store) Save(result *types.AnalysisResult) error {
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal analysis result: %w", err)
	}

	fileName := fmt.Sprintf("%s.json", result.ID)
	filePath := filepath.Join(s.baseDir, fileName)

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write analysis result: %w", err)
	}

	if err := s.updateIndex(result, fileName); err != nil {
		return fmt.Errorf("failed to update index: %w", err)
	}

	return nil
}

func (s *Store) Load(id string) (*types.AnalysisResult, error) {
	fileName := fmt.Sprintf("%s.json", id)
	filePath := filepath.Join(s.baseDir, fileName)

	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("analysis result with ID '%s' not found", id)
		}
		return nil, fmt.Errorf("failed to read analysis result: %w", err)
	}

	var result types.AnalysisResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal analysis result: %w", err)
	}

	return &result, nil
}

func (s *Store) List() ([]HistoryEntry, error) {
	index, err := s.loadIndex()
	if err != nil {
		return nil, err
	}

	sort.Slice(index.Entries, func(i, j int) bool {
		return index.Entries[i].Timestamp.After(index.Entries[j].Timestamp)
	})

	return index.Entries, nil
}

func (s *Store) GetLatest(n int) ([]*types.AnalysisResult, error) {
	entries, err := s.List()
	if err != nil {
		return nil, err
	}

	if n > len(entries) {
		n = len(entries)
	}

	var results []*types.AnalysisResult
	for i := 0; i < n; i++ {
		result, err := s.Load(entries[i].ID)
		if err != nil {
			continue
		}
		results = append(results, result)
	}

	return results, nil
}

func (s *Store) Delete(id string) error {
	fileName := fmt.Sprintf("%s.json", id)
	filePath := filepath.Join(s.baseDir, fileName)

	if err := os.Remove(filePath); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("analysis result with ID '%s' not found", id)
		}
		return fmt.Errorf("failed to delete analysis result: %w", err)
	}

	index, err := s.loadIndex()
	if err != nil {
		return err
	}

	newEntries := make([]HistoryEntry, 0, len(index.Entries))
	for _, entry := range index.Entries {
		if entry.ID != id {
			newEntries = append(newEntries, entry)
		}
	}
	index.Entries = newEntries

	return s.saveIndex(index)
}

func (s *Store) Clear() error {
	entries, err := s.List()
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if err := s.Delete(entry.ID); err != nil {
			return err
		}
	}

	return nil
}

func (s *Store) updateIndex(result *types.AnalysisResult, fileName string) error {
	index, err := s.loadIndex()
	if err != nil {
		return err
	}

	newEntry := HistoryEntry{
		ID:          result.ID,
		Timestamp:   result.Timestamp,
		Description: result.Description,
		EscapeCount: result.EscapeCount,
		FileName:    fileName,
	}

	index.Entries = append(index.Entries, newEntry)

	if len(index.Entries) > historyLimit {
		sort.Slice(index.Entries, func(i, j int) bool {
			return index.Entries[i].Timestamp.Before(index.Entries[j].Timestamp)
		})
		index.Entries = index.Entries[len(index.Entries)-historyLimit:]
	}

	return s.saveIndex(index)
}

func (s *Store) loadIndex() (*Index, error) {
	indexPath := filepath.Join(s.baseDir, indexFile)

	data, err := os.ReadFile(indexPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &Index{Entries: []HistoryEntry{}}, nil
		}
		return nil, fmt.Errorf("failed to read index: %w", err)
	}

	var index Index
	if err := json.Unmarshal(data, &index); err != nil {
		return nil, fmt.Errorf("failed to unmarshal index: %w", err)
	}

	return &index, nil
}

func (s *Store) saveIndex(index *Index) error {
	indexPath := filepath.Join(s.baseDir, indexFile)

	data, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal index: %w", err)
	}

	if err := os.WriteFile(indexPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write index: %w", err)
	}

	return nil
}
