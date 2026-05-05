package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"go-perf-helper/internal/analyzer"
)

// Storage 存储接口
type Storage interface {
	Save(analysis *analyzer.Analysis) error
	Load(id string) (*analyzer.Analysis, error)
	List() ([]*AnalysisRecord, error)
	Delete(id string) error
}

// AnalysisRecord 分析记录元数据
type AnalysisRecord struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	CreatedAt   time.Time `json:"created_at"`
	ProfileTypes []string `json:"profile_types"`
	BottleneckCount int `json:"bottleneck_count"`
}

// FileStorage 文件存储实现
type FileStorage struct {
	baseDir string
}

// NewFileStorage 创建新的文件存储
func NewFileStorage(baseDir string) (*FileStorage, error) {
	// 确保目录存在
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	return &FileStorage{
		baseDir: baseDir,
	}, nil
}

// DefaultStorage 默认存储位置
func DefaultStorage() (*FileStorage, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get user home directory: %w", err)
	}

	storageDir := filepath.Join(homeDir, ".go-perf-helper", "analyses")
	return NewFileStorage(storageDir)
}

// Save 保存分析结果
func (s *FileStorage) Save(analysis *analyzer.Analysis) error {
	if analysis.ID == "" {
		analysis.ID = generateID()
	}

	// 创建分析目录
	analysisDir := filepath.Join(s.baseDir, analysis.ID)
	if err := os.MkdirAll(analysisDir, 0755); err != nil {
		return fmt.Errorf("failed to create analysis directory: %w", err)
	}

	// 保存分析数据为 JSON
	analysisPath := filepath.Join(analysisDir, "analysis.json")
	data, err := json.MarshalIndent(analysis, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal analysis: %w", err)
	}

	if err := os.WriteFile(analysisPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write analysis file: %w", err)
	}

	// 更新索引
	if err := s.updateIndex(analysis); err != nil {
		return fmt.Errorf("failed to update index: %w", err)
	}

	return nil
}

// Load 加载分析结果
func (s *FileStorage) Load(id string) (*analyzer.Analysis, error) {
	analysisDir := filepath.Join(s.baseDir, id)
	analysisPath := filepath.Join(analysisDir, "analysis.json")

	// 检查文件是否存在
	if _, err := os.Stat(analysisPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("analysis not found: %s", id)
	}

	// 读取文件
	data, err := os.ReadFile(analysisPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read analysis file: %w", err)
	}

	// 解析 JSON
	var analysis analyzer.Analysis
	if err := json.Unmarshal(data, &analysis); err != nil {
		return nil, fmt.Errorf("failed to unmarshal analysis: %w", err)
	}

	return &analysis, nil
}

// List 列出所有分析记录
func (s *FileStorage) List() ([]*AnalysisRecord, error) {
	indexPath := filepath.Join(s.baseDir, "index.json")

	// 检查索引文件是否存在
	if _, err := os.Stat(indexPath); os.IsNotExist(err) {
		return []*AnalysisRecord{}, nil
	}

	// 读取索引文件
	data, err := os.ReadFile(indexPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read index file: %w", err)
	}

	// 解析 JSON
	var index AnalysisIndex
	if err := json.Unmarshal(data, &index); err != nil {
		return nil, fmt.Errorf("failed to unmarshal index: %w", err)
	}

	// 按创建时间排序
	sort.Slice(index.Records, func(i, j int) bool {
		return index.Records[i].CreatedAt.After(index.Records[j].CreatedAt)
	})

	return index.Records, nil
}

// Delete 删除分析记录
func (s *FileStorage) Delete(id string) error {
	analysisDir := filepath.Join(s.baseDir, id)

	// 检查目录是否存在
	if _, err := os.Stat(analysisDir); os.IsNotExist(err) {
		return fmt.Errorf("analysis not found: %s", id)
	}

	// 删除目录
	if err := os.RemoveAll(analysisDir); err != nil {
		return fmt.Errorf("failed to delete analysis directory: %w", err)
	}

	// 从索引中移除
	if err := s.removeFromIndex(id); err != nil {
		return fmt.Errorf("failed to remove from index: %w", err)
	}

	return nil
}

// AnalysisIndex 分析索引
type AnalysisIndex struct {
	Records []*AnalysisRecord `json:"records"`
}

// updateIndex 更新索引
func (s *FileStorage) updateIndex(analysis *analyzer.Analysis) error {
	indexPath := filepath.Join(s.baseDir, "index.json")

	// 读取现有索引
	var index AnalysisIndex
	if _, err := os.Stat(indexPath); err == nil {
		data, err := os.ReadFile(indexPath)
		if err == nil {
			json.Unmarshal(data, &index)
		}
	}

	// 检查是否已存在
	found := false
	for i, record := range index.Records {
		if record.ID == analysis.ID {
			index.Records[i] = s.createRecord(analysis)
			found = true
			break
		}
	}

	if !found {
		index.Records = append(index.Records, s.createRecord(analysis))
	}

	// 保存索引
	data, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(indexPath, data, 0644)
}

// removeFromIndex 从索引中移除
func (s *FileStorage) removeFromIndex(id string) error {
	indexPath := filepath.Join(s.baseDir, "index.json")

	// 读取现有索引
	var index AnalysisIndex
	if _, err := os.Stat(indexPath); err != nil {
		return nil // 索引不存在，无需处理
	}

	data, err := os.ReadFile(indexPath)
	if err != nil {
		return err
	}

	if err := json.Unmarshal(data, &index); err != nil {
		return err
	}

	// 移除指定 ID
	newRecords := []*AnalysisRecord{}
	for _, record := range index.Records {
		if record.ID != id {
			newRecords = append(newRecords, record)
		}
	}

	index.Records = newRecords

	// 保存索引
	data, err = json.MarshalIndent(index, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(indexPath, data, 0644)
}

// createRecord 创建分析记录
func (s *FileStorage) createRecord(analysis *analyzer.Analysis) *AnalysisRecord {
	profileTypes := []string{}
	if len(analysis.CPUProfile) > 0 {
		profileTypes = append(profileTypes, "cpu")
	}
	if len(analysis.HeapProfile) > 0 {
		profileTypes = append(profileTypes, "heap")
	}
	if len(analysis.BlockProfile) > 0 {
		profileTypes = append(profileTypes, "block")
	}
	if len(analysis.MutexProfile) > 0 {
		profileTypes = append(profileTypes, "mutex")
	}
	if len(analysis.TraceEvents) > 0 {
		profileTypes = append(profileTypes, "trace")
	}
	if len(analysis.Benchmarks) > 0 {
		profileTypes = append(profileTypes, "benchstat")
	}

	return &AnalysisRecord{
		ID:            analysis.ID,
		Name:          analysis.Name,
		CreatedAt:     analysis.CreatedAt,
		ProfileTypes:  profileTypes,
		BottleneckCount: len(analysis.Bottlenecks),
	}
}

// generateID 生成唯一 ID
func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// FormatBytes 格式化字节数
func FormatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// FormatDuration 格式化持续时间
func FormatDuration(d time.Duration) string {
	switch {
	case d < time.Microsecond:
		return fmt.Sprintf("%d ns", d.Nanoseconds())
	case d < time.Millisecond:
		return fmt.Sprintf("%.2f µs", float64(d.Nanoseconds())/1000)
	case d < time.Second:
		return fmt.Sprintf("%.2f ms", float64(d.Microseconds())/1000)
	case d < time.Minute:
		return fmt.Sprintf("%.2f s", d.Seconds())
	default:
		return d.String()
	}
}

// SanitizeFilename 清理文件名
func SanitizeFilename(name string) string {
	// 替换不安全的字符
	replacer := strings.NewReplacer(
		"/", "_",
		"\\", "_",
		":", "_",
		"*", "_",
		"?", "_",
		"\"", "_",
		"<", "_",
		">", "_",
		"|", "_",
		" ", "_",
	)
	return replacer.Replace(name)
}
