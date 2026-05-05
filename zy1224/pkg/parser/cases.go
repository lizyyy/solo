package parser

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Case struct {
	Name           string                 `yaml:"name"`
	Description    string                 `yaml:"description"`
	Snippet        string                 `yaml:"snippet"`
	ExpectedReturn map[string]interface{} `yaml:"expected_return"`
	ExpectedStatus string                 `yaml:"expected_status"`
	RiskLevel      string                 `yaml:"risk_level"`
}

type CasesData struct {
	Cases []*Case `yaml:"cases"`
}

func ParseCases(path string) ([]*Case, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}

	var casesData CasesData
	if err := yaml.Unmarshal(data, &casesData); err != nil {
		return nil, fmt.Errorf("解析 YAML 失败: %w", err)
	}

	for _, cs := range casesData.Cases {
		if cs.Name == "" {
			return nil, fmt.Errorf("用例缺少 name 字段")
		}
		if cs.Snippet == "" {
			return nil, fmt.Errorf("用例 %s 缺少 snippet 字段", cs.Name)
		}
	}

	return casesData.Cases, nil
}
