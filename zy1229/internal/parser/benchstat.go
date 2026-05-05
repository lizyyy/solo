package parser

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"go-perf-helper/internal/analyzer"
)

// BenchstatParser 解析 benchstat 输出格式
type BenchstatParser struct{}

// ParseBenchstatFile 解析 benchstat 输出文件
func (p *BenchstatParser) ParseBenchstatFile(path string) ([]analyzer.BenchmarkResult, map[string]BenchmarkComparison, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open benchstat file: %w", err)
	}
	defer file.Close()

	return p.parseBenchstatOutput(file)
}

// parseBenchstatOutput 解析 benchstat 输出
func (p *BenchstatParser) parseBenchstatOutput(r io.Reader) ([]analyzer.BenchmarkResult, map[string]BenchmarkComparison, error) {
	scanner := bufio.NewScanner(r)
	var results []analyzer.BenchmarkResult
	comparisons := make(map[string]BenchmarkComparison)

	// benchstat 输出格式通常是：
	// name                old time/op  new time/op  delta
	// BenchmarkFunc-8       100ns ± 5%    80ns ± 3%  -20.00%  (p=0.000 n=5+5)
	// 
	// 或者只有单个基准测试结果的格式

	var headers []string
	var inTable bool

	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)

		if line == "" {
			continue
		}

		// 检测表头
		if strings.Contains(line, "name") && strings.Contains(line, "time/op") {
			headers = strings.Fields(line)
			inTable = true
			continue
		}

		if inTable {
			// 解析数据行
			result, comparison, err := p.parseBenchstatLine(line, headers)
			if err == nil {
				if result != nil {
					results = append(results, *result)
				}
				if comparison != nil {
					comparisons[comparison.Name] = *comparison
				}
			}
		} else {
			// 尝试解析简单的基准测试行
			// 格式：BenchmarkName-8        1000        1000000 ns/op
			result := p.parseSimpleBenchmarkLine(line)
			if result != nil {
				results = append(results, *result)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, nil, err
	}

	return results, comparisons, nil
}

// parseBenchstatLine 解析 benchstat 数据行
func (p *BenchstatParser) parseBenchstatLine(line string, headers []string) (*analyzer.BenchmarkResult, *BenchmarkComparison, error) {
	parts := strings.Fields(line)
	if len(parts) < 2 {
		return nil, nil, fmt.Errorf("invalid line format")
	}

	name := parts[0]

	// 检查是否是对比格式（包含 old/new/delta）
	if len(parts) >= 6 && (strings.Contains(parts[len(parts)-1], "p=") || strings.Contains(parts[len(parts)-2], "%")) {
		// 这是对比格式
		comparison := &BenchmarkComparison{
			Name: name,
		}

		// 尝试解析 time/op
		// 格式：BenchmarkFunc-8       100ns ± 5%    80ns ± 3%  -20.00%  (p=0.000 n=5+5)

		// 解析旧值
		for i, part := range parts {
			if strings.HasSuffix(part, "ns/op") || strings.HasSuffix(part, "µs/op") || 
			   strings.HasSuffix(part, "ms/op") || strings.HasSuffix(part, "s/op") {
				// 这是时间值
				value, err := p.parseDurationValue(part)
				if err == nil {
					if comparison.OldNsPerOp == 0 {
						comparison.OldNsPerOp = value
					} else {
						comparison.NewNsPerOp = value
					}
				}
			}

			// 解析 delta
			if strings.HasSuffix(part, "%") && i > 0 {
				deltaStr := strings.TrimSuffix(part, "%")
				delta, err := strconv.ParseFloat(deltaStr, 64)
				if err == nil {
					comparison.DeltaPercent = delta
				}
			}

			// 解析 p 值
			if strings.HasPrefix(part, "(p=") {
				pStr := strings.TrimPrefix(part, "(p=")
				pStr = strings.TrimSuffix(pStr, ")")
				pValue, err := strconv.ParseFloat(pStr, 64)
				if err == nil {
					comparison.PValue = pValue
				}
			}
		}

		// 创建结果（使用新值）
		result := &analyzer.BenchmarkResult{
			Name:    name,
			NsPerOp: comparison.NewNsPerOp,
		}

		return result, comparison, nil
	}

	// 简单格式
	result := p.parseSimpleBenchmarkLine(line)
	return result, nil, nil
}

// parseSimpleBenchmarkLine 解析简单的基准测试行
func (p *BenchstatParser) parseSimpleBenchmarkLine(line string) *analyzer.BenchmarkResult {
	// 格式：BenchmarkName-8        1000        1000000 ns/op
	// 或者：BenchmarkName        1000        1000000 ns/op  500 B/op  10 allocs/op

	parts := strings.Fields(line)
	if len(parts) < 3 {
		return nil
	}

	// 第一个字段是名称
	name := parts[0]

	// 检查是否是基准测试名称
	if !strings.HasPrefix(name, "Benchmark") {
		return nil
	}

	result := &analyzer.BenchmarkResult{
		Name: name,
	}

	// 解析字段
	for i := 1; i < len(parts); i++ {
		part := parts[i]

		// 解析 ns/op
		if strings.HasSuffix(part, "ns/op") {
			valueStr := strings.TrimSuffix(part, "ns/op")
			value, err := strconv.ParseFloat(valueStr, 64)
			if err == nil {
				result.NsPerOp = value
			}
		}

		// 解析 MB/s
		if strings.HasSuffix(part, "MB/s") {
			valueStr := strings.TrimSuffix(part, "MB/s")
			value, err := strconv.ParseFloat(valueStr, 64)
			if err == nil {
				result.MBPerSec = value
			}
		}

		// 解析 B/op
		if strings.HasSuffix(part, "B/op") {
			valueStr := strings.TrimSuffix(part, "B/op")
			value, err := strconv.ParseInt(valueStr, 10, 64)
			if err == nil {
				result.BytesPerOp = value
			}
		}

		// 解析 allocs/op
		if strings.HasSuffix(part, "allocs/op") {
			valueStr := strings.TrimSuffix(part, "allocs/op")
			value, err := strconv.ParseInt(valueStr, 10, 64)
			if err == nil {
				result.AllocsPerOp = value
			}
		}

		// 解析迭代次数（第二个字段，如果是整数且后面跟着其他指标）
		if i == 1 {
			iterations, err := strconv.ParseInt(part, 10, 64)
			if err == nil {
				result.Iterations = iterations
			}
		}
	}

	return result
}

// parseDurationValue 解析持续时间值
func (p *BenchstatParser) parseDurationValue(value string) (float64, error) {
	// 格式：100ns, 50µs, 10ms, 2s
	value = strings.TrimSpace(value)
	
	var multiplier float64 = 1
	var numericPart string

	if strings.HasSuffix(value, "ns/op") {
		multiplier = 1
		numericPart = strings.TrimSuffix(value, "ns/op")
	} else if strings.HasSuffix(value, "µs/op") {
		multiplier = 1000
		numericPart = strings.TrimSuffix(value, "µs/op")
	} else if strings.HasSuffix(value, "ms/op") {
		multiplier = 1000000
		numericPart = strings.TrimSuffix(value, "ms/op")
	} else if strings.HasSuffix(value, "s/op") {
		multiplier = 1000000000
		numericPart = strings.TrimSuffix(value, "s/op")
	} else {
		// 尝试直接解析
		numericPart = value
	}

	// 移除 ± 后面的部分
	if idx := strings.Index(numericPart, "±"); idx != -1 {
		numericPart = strings.TrimSpace(numericPart[:idx])
	}

	numericPart = strings.TrimSpace(numericPart)
	result, err := strconv.ParseFloat(numericPart, 64)
	if err != nil {
		return 0, err
	}

	return result * multiplier, nil
}

// BenchmarkComparison 基准测试对比结果
type BenchmarkComparison struct {
	Name          string
	OldNsPerOp    float64
	NewNsPerOp    float64
	OldBytesPerOp int64
	NewBytesPerOp int64
	OldAllocsPerOp int64
	NewAllocsPerOp int64
	DeltaPercent  float64
	PValue        float64
	IsSignificant bool
}

// IsImprovement 判断是否是改进
func (c *BenchmarkComparison) IsImprovement() bool {
	return c.DeltaPercent < 0
}

// IsRegression 判断是否是回归
func (c *BenchmarkComparison) IsRegression() bool {
	return c.DeltaPercent > 0
}

// GetImprovementPercent 获取改进百分比
func (c *BenchmarkComparison) GetImprovementPercent() float64 {
	if c.DeltaPercent < 0 {
		return -c.DeltaPercent
	}
	return 0
}

// GetRegressionPercent 获取回归百分比
func (c *BenchmarkComparison) GetRegressionPercent() float64 {
	if c.DeltaPercent > 0 {
		return c.DeltaPercent
	}
	return 0
}
