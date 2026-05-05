package commands

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"concurrency-inspector/internal/analyzer"
	"concurrency-inspector/internal/models"
	"concurrency-inspector/internal/storage"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

func AnalyzeCommand(s *storage.SQLiteStorage) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "analyze [project-name]",
		Short: "分析并发设计并生成报告",
		Long: `analyze 命令读取 design.yaml、events.jsonl 和 snippets/*.go，
分析 goroutine 拓扑、队列容量、背压、优先级、超时预算、错误传播和关闭顺序，
指出可能的 goroutine 泄漏、无限堆积、乱序结果和吞吐瓶颈。`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			projectName := args[0]
			return runAnalyze(cmd, projectName, s)
		},
	}

	cmd.Flags().StringP("dir", "d", ".", "项目目录路径")
	cmd.Flags().BoolP("verbose", "v", false, "显示详细分析过程")
	cmd.Flags().StringP("output", "o", "", "输出文件路径")

	return cmd
}

func runAnalyze(cmd *cobra.Command, projectName string, s *storage.SQLiteStorage) error {
	dir, _ := cmd.Flags().GetString("dir")
	verbose, _ := cmd.Flags().GetBool("verbose")

	projectDir := filepath.Join(dir, projectName)
	configPath := filepath.Join(projectDir, "design.yaml")
	eventsPath := filepath.Join(projectDir, "events.jsonl")
	snippetsDir := filepath.Join(projectDir, "snippets")

	if verbose {
		fmt.Printf("分析项目: %s\n", projectName)
		fmt.Printf("目录: %s\n", projectDir)
	}

	config, err := loadDesignConfig(configPath)
	if err != nil {
		return fmt.Errorf("failed to load design config: %w", err)
	}

	if verbose {
		fmt.Printf("✓ 加载 design.yaml 成功\n")
		fmt.Printf("  - 版本: %s\n", config.Version)
		fmt.Printf("  - 并发模式: %v\n", config.Concurrency.Patterns)
		fmt.Printf("  - 队列数量: %d\n", len(config.Queues))
		fmt.Printf("  - Goroutine 数量: %d\n", len(config.Goroutines))
	}

	events, err := loadEvents(eventsPath)
	if err != nil {
		return fmt.Errorf("failed to load events: %w", err)
	}

	if verbose {
		fmt.Printf("✓ 加载 events.jsonl 成功 (%d 条记录)\n", len(events))
	}

	snippets, err := loadCodeSnippets(snippetsDir)
	if err != nil {
		return fmt.Errorf("failed to load code snippets: %w", err)
	}

	if verbose {
		fmt.Printf("✓ 加载代码片段成功 (%d 个文件)\n", len(snippets))
		for _, snippet := range snippets {
			fmt.Printf("  - %s\n", snippet.Filename)
		}
	}

	if verbose {
		fmt.Println("\n开始分析...")
	}

	analyzerInstance := analyzer.NewAnalyzer(config, events, snippets)
	result, err := analyzerInstance.Analyze()
	if err != nil {
		return fmt.Errorf("failed to analyze: %w", err)
	}

	db := s.DB()

	var projectID int64
	err = db.QueryRow("SELECT id FROM projects WHERE name = ?", projectName).Scan(&projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			result2, err := db.Exec(
				"INSERT INTO projects (name, description) VALUES (?, ?)",
				projectName, "",
			)
			if err != nil {
				return fmt.Errorf("failed to create project: %w", err)
			}
			projectID, _ = result2.LastInsertId()
		} else {
			return fmt.Errorf("failed to get project: %w", err)
		}
	}

	var designID int64
	yamlContent, _ := yaml.Marshal(config)
	err = db.QueryRow(
		"SELECT id FROM designs WHERE project_id = ? AND name = ?",
		projectID, projectName,
	).Scan(&designID)

	if err == sql.ErrNoRows {
		result2, err := db.Exec(
			"INSERT INTO designs (project_id, name, yaml_content) VALUES (?, ?, ?)",
			projectID, projectName, string(yamlContent),
		)
		if err != nil {
			return fmt.Errorf("failed to save design: %w", err)
		}
		designID, _ = result2.LastInsertId()
	} else if err != nil {
		return fmt.Errorf("failed to check design: %w", err)
	} else {
		_, err = db.Exec(
			"UPDATE designs SET yaml_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
			string(yamlContent), designID,
		)
		if err != nil {
			return fmt.Errorf("failed to update design: %w", err)
		}
	}

	for _, snippet := range snippets {
		_, err = db.Exec(
			`INSERT OR REPLACE INTO code_snippets (design_id, filename, content, created_at) 
			 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
			designID, snippet.Filename, snippet.Content,
		)
		if err != nil {
			return fmt.Errorf("failed to save snippet: %w", err)
		}
	}

	topologyJSON, _ := json.Marshal(result.GoroutineTopology)
	queueJSON, _ := json.Marshal(result.QueueAnalysis)
	backpressureJSON, _ := json.Marshal(result.BackpressureAnalysis)
	priorityJSON, _ := json.Marshal(result.PriorityAnalysis)
	timeoutJSON, _ := json.Marshal(result.TimeoutAnalysis)
	errorJSON, _ := json.Marshal(result.ErrorAnalysis)
	shutdownJSON, _ := json.Marshal(result.ShutdownAnalysis)
	issuesJSON, _ := json.Marshal(result.Issues)
	recommendationsJSON, _ := json.Marshal(result.Recommendations)

	_, err = db.Exec(
		`INSERT OR REPLACE INTO analysis_results 
		 (design_id, goroutine_topology, queue_analysis, backpressure_analysis, 
		  priority_analysis, timeout_analysis, error_analysis, shutdown_analysis,
		  issues, recommendations, overall_score, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		designID, string(topologyJSON), string(queueJSON), string(backpressureJSON),
		string(priorityJSON), string(timeoutJSON), string(errorJSON), string(shutdownJSON),
		string(issuesJSON), string(recommendationsJSON), result.OverallScore,
	)
	if err != nil {
		return fmt.Errorf("failed to save analysis result: %w", err)
	}

	printAnalysisResult(result, verbose)

	return nil
}

func loadDesignConfig(path string) (*models.DesignConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var config models.DesignConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal yaml: %w", err)
	}

	return &config, nil
}

func loadEvents(path string) ([]models.Event, error) {
	events := []models.Event{}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return events, nil
		}
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var event models.Event
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			continue
		}
		events = append(events, event)
	}

	return events, nil
}

func loadCodeSnippets(dir string) ([]models.CodeSnippet, error) {
	snippets := []models.CodeSnippet{}

	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return snippets, nil
	}

	files, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}
		if !strings.HasSuffix(file.Name(), ".go") {
			continue
		}

		filePath := filepath.Join(dir, file.Name())
		content, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to read file %s: %w", filePath, err)
		}

		snippets = append(snippets, models.CodeSnippet{
			Filename: file.Name(),
			Content:  string(content),
		})
	}

	return snippets, nil
}

func printAnalysisResult(result *models.AnalysisResult, verbose bool) {
	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Println("分析结果")
	fmt.Println(strings.Repeat("=", 80))

	fmt.Printf("\n综合评分: %d/100\n", result.OverallScore)

	if result.OverallScore >= 80 {
		fmt.Println("状态: ✅ 良好")
	} else if result.OverallScore >= 60 {
		fmt.Println("状态: ⚠️ 需要改进")
	} else {
		fmt.Println("状态: ❌ 存在严重问题")
	}

	fmt.Println("\n--- 检测到的并发模式 ---")
	for _, pattern := range result.GoroutineTopology.Patterns {
		fmt.Printf("  - %s (置信度: %.1f%%)\n", pattern.Name, pattern.Confidence*100)
		if verbose {
			fmt.Printf("    描述: %s\n", pattern.Description)
		}
	}

	if len(result.GoroutineTopology.Cycles) > 0 {
		fmt.Println("\n--- ⚠️ 检测到循环依赖 ---")
		for _, cycle := range result.GoroutineTopology.Cycles {
			fmt.Printf("  - %s\n", cycle)
		}
	}

	if len(result.GoroutineTopology.Orphaned) > 0 {
		fmt.Println("\n--- ⚠️ 孤立的 Goroutine ---")
		for _, orphan := range result.GoroutineTopology.Orphaned {
			fmt.Printf("  - %s\n", orphan)
		}
	}

	fmt.Println("\n--- 队列分析 ---")
	for _, queue := range result.QueueAnalysis.Queues {
		statusIcon := "✅"
		if queue.Status == "warning" {
			statusIcon = "⚠️"
		} else if queue.Status == "critical" {
			statusIcon = "❌"
		}
		fmt.Printf("  %s %s (容量: %d, 类型: %s)\n", statusIcon, queue.Name, queue.Capacity, queue.Type)
	}

	fmt.Println("\n--- 背压分析 ---")
	if result.BackpressureAnalysis.HasBackpressure {
		fmt.Println("  ⚠️ 检测到潜在背压问题")
		fmt.Printf("  瓶颈队列: %v\n", result.BackpressureAnalysis.Bottlenecks)
	} else {
		fmt.Println("  ✅ 无明显背压问题")
	}
	if verbose && len(result.BackpressureAnalysis.Strategies) > 0 {
		fmt.Println("  现有策略:")
		for _, strategy := range result.BackpressureAnalysis.Strategies {
			fmt.Printf("    - %s\n", strategy)
		}
	}

	fmt.Println("\n--- 超时与取消传播 ---")
	if result.TimeoutAnalysis.HasCancelPropagate {
		fmt.Println("  ✅ 已启用取消传播")
	} else {
		fmt.Println("  ❌ 未启用取消传播")
	}
	fmt.Printf("  默认超时: %s\n", result.TimeoutAnalysis.DefaultTimeout)
	fmt.Printf("  总超时预算: %s\n", result.TimeoutAnalysis.TimeoutBudget)
	if len(result.TimeoutAnalysis.UncoveredOperations) > 0 {
		fmt.Println("  ⚠️ 未覆盖的操作:")
		for _, op := range result.TimeoutAnalysis.UncoveredOperations {
			fmt.Printf("    - %s\n", op)
		}
	}

	fmt.Println("\n--- 错误处理 ---")
	fmt.Printf("  策略: %s\n", result.ErrorAnalysis.Strategy)
	if result.ErrorAnalysis.HasErrorQueue {
		fmt.Println("  ✅ 有错误队列")
	} else {
		fmt.Println("  ⚠️ 无错误队列")
	}
	if result.ErrorAnalysis.HasPanicHandler {
		fmt.Println("  ✅ 有 panic handler")
	} else {
		fmt.Println("  ❌ 无 panic handler")
	}
	if result.ErrorAnalysis.RetryConfig != nil {
		fmt.Printf("  重试配置: 最多 %d 次, 退避: %s\n",
			result.ErrorAnalysis.RetryConfig.MaxRetries,
			result.ErrorAnalysis.RetryConfig.Backoff)
	}
	if len(result.ErrorAnalysis.UnhandledPaths) > 0 {
		fmt.Println("  ⚠️ 未处理的路径:")
		for _, path := range result.ErrorAnalysis.UnhandledPaths {
			fmt.Printf("    - %s\n", path)
		}
	}

	fmt.Println("\n--- 优雅关闭 ---")
	if result.ShutdownAnalysis.Graceful {
		fmt.Println("  ✅ 已启用优雅关闭")
	} else {
		fmt.Println("  ❌ 未启用优雅关闭")
	}
	if len(result.ShutdownAnalysis.ShutdownOrder) > 0 {
		fmt.Printf("  关闭顺序: %v\n", result.ShutdownAnalysis.ShutdownOrder)
	}
	fmt.Printf("  等待超时: %s\n", result.ShutdownAnalysis.WaitTimeout)
	if result.ShutdownAnalysis.HasForceKill {
		fmt.Println("  支持强制终止")
	}
	if len(result.ShutdownAnalysis.Issues) > 0 {
		fmt.Println("  ⚠️ 关闭问题:")
		for _, issue := range result.ShutdownAnalysis.Issues {
			severityIcon := "⚠️"
			if issue.Severity == "critical" {
				severityIcon = "❌"
			}
			fmt.Printf("    %s %s: %s\n", severityIcon, issue.IssueType, issue.Description)
		}
	}

	fmt.Println("\n--- 发现的问题 ---")
	if len(result.Issues) == 0 {
		fmt.Println("  ✅ 未发现问题")
	} else {
		severityCount := make(map[string]int)
		for _, issue := range result.Issues {
			severityCount[issue.Severity]++
		}
		fmt.Printf("  总计: %d 个问题\n", len(result.Issues))
		if severityCount["critical"] > 0 {
			fmt.Printf("    ❌ Critical: %d\n", severityCount["critical"])
		}
		if severityCount["high"] > 0 {
			fmt.Printf("    ⚠️ High: %d\n", severityCount["high"])
		}
		if severityCount["warning"] > 0 {
			fmt.Printf("    ℹ️ Warning: %d\n", severityCount["warning"])
		}

		if verbose {
			for _, issue := range result.Issues {
				severityIcon := "ℹ️"
				if issue.Severity == "critical" {
					severityIcon = "❌"
				} else if issue.Severity == "high" {
					severityIcon = "⚠️"
				}
				fmt.Printf("\n  %s [%s] %s\n", severityIcon, issue.Category, issue.Description)
				if issue.Location != "" {
					fmt.Printf("      位置: %s\n", issue.Location)
				}
				if issue.Suggestion != "" {
					fmt.Printf("      建议: %s\n", issue.Suggestion)
				}
			}
		}
	}

	fmt.Println("\n--- 改进建议 ---")
	if len(result.Recommendations) == 0 {
		fmt.Println("  ✅ 暂无建议")
	} else {
		for _, rec := range result.Recommendations {
			priorityIcon := "📌"
			if rec.Priority == "critical" {
				priorityIcon = "🔴"
			} else if rec.Priority == "high" {
				priorityIcon = "🟡"
			}
			fmt.Printf("\n  %s [%s] %s\n", priorityIcon, rec.Category, rec.Description)
			fmt.Printf("      影响: %s\n", rec.Impact)
		}
	}

	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Printf("分析完成时间: %s\n", time.Now().Format("2006-01-02 15:04:05"))
	fmt.Println(strings.Repeat("=", 80))
}
