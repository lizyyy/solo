package scanner

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"go-quality-scanner/internal/models"
)

// GoModScanner go.mod 扫描器
type GoModScanner struct{}

// NewGoModScanner 创建新的 go.mod 扫描器
func NewGoModScanner() *GoModScanner {
	return &GoModScanner{}
}

// Scan 扫描 go.mod 文件
func (s *GoModScanner) Scan(projectPath string) (*models.GoModInfo, error) {
	// 查找 go.mod 文件
	goModPath := filepath.Join(projectPath, "go.mod")
	if _, err := os.Stat(goModPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("go.mod file not found in %s", projectPath)
	}

	// 读取并解析 go.mod
	file, err := os.Open(goModPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open go.mod: %w", err)
	}
	defer file.Close()

	goModInfo := &models.GoModInfo{}
	var dependencies []*models.Dependency
	inRequireBlock := false

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		
		if line == "" || strings.HasPrefix(line, "//") {
			continue
		}

		// 解析 module
		if strings.HasPrefix(line, "module ") {
			moduleParts := strings.Fields(line)
			if len(moduleParts) >= 2 {
				goModInfo.ModuleName = moduleParts[1]
			}
			continue
		}

		// 解析 go 版本
		if strings.HasPrefix(line, "go ") {
			goParts := strings.Fields(line)
			if len(goParts) >= 2 {
				goModInfo.GoVersion = goParts[1]
			}
			continue
		}

		// 处理 require 块
		if strings.HasPrefix(line, "require (") {
			inRequireBlock = true
			continue
		}
		if inRequireBlock && strings.HasPrefix(line, ")") {
			inRequireBlock = false
			continue
		}

		// 解析依赖
		if inRequireBlock || strings.HasPrefix(line, "require ") {
			var depLine string
			if strings.HasPrefix(line, "require ") {
				// 单行 require
				depLine = strings.TrimPrefix(line, "require ")
			} else if inRequireBlock {
				// require 块中的行
				depLine = line
			} else {
				continue
			}

			dep := parseDependency(depLine)
			if dep != nil {
				dependencies = append(dependencies, dep)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to scan go.mod: %w", err)
	}

	goModInfo.Dependencies = dependencies
	return goModInfo, nil
}

// parseDependency 解析依赖行
func parseDependency(line string) *models.Dependency {
	parts := strings.Fields(line)
	if len(parts) < 2 {
		return nil
	}

	dep := &models.Dependency{
		Path:    parts[0],
		Version: parts[1],
	}

	// 检查是否是 indirect
	for _, part := range parts {
		if part == "//" || part == "indirect" {
			dep.Indirect = true
			break
		}
	}

	return dep
}
