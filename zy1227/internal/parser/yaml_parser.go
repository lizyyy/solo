package parser

import (
	"os"

	"gopkg.in/yaml.v3"

	"github.com/yourteam/sync-analyzer/internal/models"
)

// YAMLParser 用于解析 sync-cases.yaml 文件
type YAMLParser struct{}

// NewYAMLParser 创建一个新的 YAML 解析器
func NewYAMLParser() *YAMLParser {
	return &YAMLParser{}
}

// ParseSyncCases 解析 sync-cases.yaml 文件
func (p *YAMLParser) ParseSyncCases(filePath string) ([]models.SyncCase, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var cases []models.SyncCase
	if err := yaml.Unmarshal(data, &cases); err != nil {
		return nil, err
	}

	return cases, nil
}

// ParseSingleCase 解析单个案例配置
func (p *YAMLParser) ParseSingleCase(data []byte) (*models.SyncCase, error) {
	var caseModel models.SyncCase
	if err := yaml.Unmarshal(data, &caseModel); err != nil {
		return nil, err
	}
	return &caseModel, nil
}
