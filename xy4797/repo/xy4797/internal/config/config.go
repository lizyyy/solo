package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// RulesConfig 规则配置
type RulesConfig struct {
	Rules struct {
		CrossLayerImport  CrossLayerImportRule  `yaml:"cross_layer_import"`
		BareReturnError   BareReturnErrorRule   `yaml:"bare_return_error"`
		UnhandledError    UnhandledErrorRule    `yaml:"unhandled_error"`
		ExpiredTodo       ExpiredTodoRule       `yaml:"expired_todo"`
		TestCoverage      TestCoverageRule      `yaml:"test_coverage"`
		FunctionComplexity FunctionComplexityRule `yaml:"function_complexity"`
	} `yaml:"rules"`
}

// CrossLayerImportRule 跨层导入规则
type CrossLayerImportRule struct {
	Enabled     bool   `yaml:"enabled"`
	Severity    string `yaml:"severity"`
	Description string `yaml:"description"`
	Layers      []LayerConfig `yaml:"layers"`
}

// LayerConfig 层配置
type LayerConfig struct {
	Name             string   `yaml:"name"`
	PathPattern      string   `yaml:"path_pattern"`
	AllowedImports   []string `yaml:"allowed_imports"`
	ForbiddenImports []string `yaml:"forbidden_imports"`
}

// BareReturnErrorRule 裸返回错误规则
type BareReturnErrorRule struct {
	Enabled     bool     `yaml:"enabled"`
	Severity    string   `yaml:"severity"`
	Description string   `yaml:"description"`
	Patterns    []string `yaml:"patterns"`
}

// UnhandledErrorRule 未处理错误规则
type UnhandledErrorRule struct {
	Enabled     bool     `yaml:"enabled"`
	Severity    string   `yaml:"severity"`
	Description string   `yaml:"description"`
	Patterns    []string `yaml:"patterns"`
}

// ExpiredTodoRule 过期 TODO 规则
type ExpiredTodoRule struct {
	Enabled     bool     `yaml:"enabled"`
	Severity    string   `yaml:"severity"`
	Description string   `yaml:"description"`
	ExpireDays  int      `yaml:"expire_days"`
	Patterns    []string `yaml:"patterns"`
}

// TestCoverageRule 测试覆盖率规则
type TestCoverageRule struct {
	Enabled         bool     `yaml:"enabled"`
	Severity        string   `yaml:"severity"`
	Description     string   `yaml:"description"`
	MinCoverage     float64  `yaml:"min_coverage"`
	ExcludePackages []string `yaml:"exclude_packages"`
}

// FunctionComplexityRule 函数复杂度规则
type FunctionComplexityRule struct {
	Enabled        bool   `yaml:"enabled"`
	Severity       string `yaml:"severity"`
	Description    string `yaml:"description"`
	MaxComplexity  int    `yaml:"max_complexity"`
}

// GlobalConfig 全局配置
var GlobalConfig *RulesConfig

// LoadConfig 加载配置文件
func LoadConfig(configPath string) (*RulesConfig, error) {
	// 读取配置文件
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// 解析 YAML
	var config RulesConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	GlobalConfig = &config
	return &config, nil
}

// GetConfig 获取全局配置
func GetConfig() *RulesConfig {
	return GlobalConfig
}
