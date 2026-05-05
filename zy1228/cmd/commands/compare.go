package commands

import (
	"encoding/json"
	"fmt"
	"strings"

	"concurrency-inspector/internal/models"
	"concurrency-inspector/internal/storage"

	"github.com/spf13/cobra"
)

func CompareCommand(s *storage.SQLiteStorage) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "compare [project1] [project2]",
		Short: "比较两个并发设计方案",
		Long: `compare 命令用于比较两个不同的并发设计方案，
分析它们在拓扑结构、队列配置、超时策略、错误处理等方面的差异，
帮助团队选择更优的设计方案。`,
		Args: cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			project1 := args[0]
			project2 := args[1]
			return runCompare(cmd, project1, project2, s)
		},
	}

	cmd.Flags().BoolP("verbose", "v", false, "显示详细比较信息")

	return cmd
}

func runCompare(cmd *cobra.Command, project1, project2 string, s *storage.SQLiteStorage) error {
	verbose, _ := cmd.Flags().GetBool("verbose")

	fmt.Printf("比较方案: %s vs %s\n\n", project1, project2)

	result1, err := loadAnalysisResult(s, project1)
	if err != nil {
		return fmt.Errorf("failed to load analysis for %s: %w", project1, err)
	}

	result2, err := loadAnalysisResult(s, project2)
	if err != nil {
		return fmt.Errorf("failed to load analysis for %s: %w", project2, err)
	}

	printComparison(result1, result2, project1, project2, verbose)

	return nil
}

func loadAnalysisResult(s *storage.SQLiteStorage, projectName string) (*models.AnalysisResult, error) {
	db := s.DB()

	var designID int64
	err := db.QueryRow(`
		SELECT d.id FROM designs d
		JOIN projects p ON d.project_id = p.id
		WHERE p.name = ?
		ORDER BY d.created_at DESC
		LIMIT 1
	`, projectName).Scan(&designID)
	if err != nil {
		return nil, fmt.Errorf("project %s not found: %w", projectName, err)
	}

	var topologyJSON, queueJSON, backpressureJSON, priorityJSON string
	var timeoutJSON, errorJSON, shutdownJSON, issuesJSON, recommendationsJSON string
	var overallScore int

	err = db.QueryRow(`
		SELECT goroutine_topology, queue_analysis, backpressure_analysis, 
		       priority_analysis, timeout_analysis, error_analysis, 
		       shutdown_analysis, issues, recommendations, overall_score
		FROM analysis_results
		WHERE design_id = ?
	`, designID).Scan(
		&topologyJSON, &queueJSON, &backpressureJSON, &priorityJSON,
		&timeoutJSON, &errorJSON, &shutdownJSON, &issuesJSON, &recommendationsJSON, &overallScore,
	)
	if err != nil {
		return nil, fmt.Errorf("analysis result not found for %s: %w", projectName, err)
	}

	result := &models.AnalysisResult{
		DesignID:     designID,
		OverallScore: overallScore,
	}

	json.Unmarshal([]byte(topologyJSON), &result.GoroutineTopology)
	json.Unmarshal([]byte(queueJSON), &result.QueueAnalysis)
	json.Unmarshal([]byte(backpressureJSON), &result.BackpressureAnalysis)
	json.Unmarshal([]byte(priorityJSON), &result.PriorityAnalysis)
	json.Unmarshal([]byte(timeoutJSON), &result.TimeoutAnalysis)
	json.Unmarshal([]byte(errorJSON), &result.ErrorAnalysis)
	json.Unmarshal([]byte(shutdownJSON), &result.ShutdownAnalysis)
	json.Unmarshal([]byte(issuesJSON), &result.Issues)
	json.Unmarshal([]byte(recommendationsJSON), &result.Recommendations)

	return result, nil
}

func printComparison(r1, r2 *models.AnalysisResult, name1, name2 string, verbose bool) {
	fmt.Println(strings.Repeat("=", 80))
	fmt.Println("并发设计方案比较")
	fmt.Println(strings.Repeat("=", 80))

	fmt.Println("\n--- 综合评分比较 ---")
	scoreDiff := r1.OverallScore - r2.OverallScore
	fmt.Printf("  %s: %d/100\n", name1, r1.OverallScore)
	fmt.Printf("  %s: %d/100\n", name2, r2.OverallScore)
	if scoreDiff > 0 {
		fmt.Printf("  结论: %s 更优 (+%d 分)\n", name1, scoreDiff)
	} else if scoreDiff < 0 {
		fmt.Printf("  结论: %s 更优 (+%d 分)\n", name2, -scoreDiff)
	} else {
		fmt.Println("  结论: 评分相同")
	}

	fmt.Println("\n--- 拓扑结构比较 ---")
	fmt.Printf("  %s - 节点数: %d, 边数: %d\n", name1, len(r1.GoroutineTopology.Nodes), len(r1.GoroutineTopology.Edges))
	fmt.Printf("  %s - 节点数: %d, 边数: %d\n", name2, len(r2.GoroutineTopology.Nodes), len(r2.GoroutineTopology.Edges))

	if len(r1.GoroutineTopology.Cycles) > 0 {
		fmt.Printf("  ⚠️ %s 存在循环依赖: %v\n", name1, r1.GoroutineTopology.Cycles)
	}
	if len(r2.GoroutineTopology.Cycles) > 0 {
		fmt.Printf("  ⚠️ %s 存在循环依赖: %v\n", name2, r2.GoroutineTopology.Cycles)
	}

	if verbose {
		fmt.Println("\n  检测到的模式:")
		fmt.Printf("    %s: ", name1)
		for i, p := range r1.GoroutineTopology.Patterns {
			if i > 0 {
				fmt.Print(", ")
			}
			fmt.Print(p.Name)
		}
		fmt.Println()
		fmt.Printf("    %s: ", name2)
		for i, p := range r2.GoroutineTopology.Patterns {
			if i > 0 {
				fmt.Print(", ")
			}
			fmt.Print(p.Name)
		}
		fmt.Println()
	}

	fmt.Println("\n--- 队列配置比较 ---")
	fmt.Printf("  %s - 队列数: %d\n", name1, len(r1.QueueAnalysis.Queues))
	fmt.Printf("  %s - 队列数: %d\n", name2, len(r2.QueueAnalysis.Queues))

	fmt.Println("\n--- 背压分析比较 ---")
	fmt.Printf("  %s - 背压问题: %v\n", name1, r1.BackpressureAnalysis.HasBackpressure)
	if r1.BackpressureAnalysis.HasBackpressure {
		fmt.Printf("    瓶颈: %v\n", r1.BackpressureAnalysis.Bottlenecks)
	}
	fmt.Printf("  %s - 背压问题: %v\n", name2, r2.BackpressureAnalysis.HasBackpressure)
	if r2.BackpressureAnalysis.HasBackpressure {
		fmt.Printf("    瓶颈: %v\n", r2.BackpressureAnalysis.Bottlenecks)
	}

	fmt.Println("\n--- 超时与取消传播比较 ---")
	fmt.Printf("  %s - 默认超时: %s, 取消传播: %v\n", name1, r1.TimeoutAnalysis.DefaultTimeout, r1.TimeoutAnalysis.HasCancelPropagate)
	fmt.Printf("  %s - 默认超时: %s, 取消传播: %v\n", name2, r2.TimeoutAnalysis.DefaultTimeout, r2.TimeoutAnalysis.HasCancelPropagate)

	fmt.Println("\n--- 错误处理比较 ---")
	fmt.Printf("  %s - 策略: %s, 错误队列: %v, PanicHandler: %v\n", 
		name1, r1.ErrorAnalysis.Strategy, r1.ErrorAnalysis.HasErrorQueue, r1.ErrorAnalysis.HasPanicHandler)
	fmt.Printf("  %s - 策略: %s, 错误队列: %v, PanicHandler: %v\n", 
		name2, r2.ErrorAnalysis.Strategy, r2.ErrorAnalysis.HasErrorQueue, r2.ErrorAnalysis.HasPanicHandler)

	fmt.Println("\n--- 优雅关闭比较 ---")
	fmt.Printf("  %s - 优雅关闭: %v, 等待超时: %s\n", name1, r1.ShutdownAnalysis.Graceful, r1.ShutdownAnalysis.WaitTimeout)
	fmt.Printf("  %s - 优雅关闭: %v, 等待超时: %s\n", name2, r2.ShutdownAnalysis.Graceful, r2.ShutdownAnalysis.WaitTimeout)

	fmt.Println("\n--- 问题统计 ---")
	severityCount1 := countIssuesBySeverity(r1.Issues)
	severityCount2 := countIssuesBySeverity(r2.Issues)
	
	fmt.Printf("  %s - Critical: %d, High: %d, Warning: %d, Total: %d\n",
		name1, severityCount1["critical"], severityCount1["high"], severityCount1["warning"], len(r1.Issues))
	fmt.Printf("  %s - Critical: %d, High: %d, Warning: %d, Total: %d\n",
		name2, severityCount2["critical"], severityCount2["high"], severityCount2["warning"], len(r2.Issues))

	if verbose {
		fmt.Println("\n--- 详细问题列表 ---")
		fmt.Printf("\n%s 的问题:\n", name1)
		for _, issue := range r1.Issues {
			icon := "ℹ️"
			if issue.Severity == "critical" {
				icon = "❌"
			} else if issue.Severity == "high" {
				icon = "⚠️"
			}
			fmt.Printf("  %s [%s] %s\n", icon, issue.Category, issue.Description)
		}

		fmt.Printf("\n%s 的问题:\n", name2)
		for _, issue := range r2.Issues {
			icon := "ℹ️"
			if issue.Severity == "critical" {
				icon = "❌"
			} else if issue.Severity == "high" {
				icon = "⚠️"
			}
			fmt.Printf("  %s [%s] %s\n", icon, issue.Category, issue.Description)
		}
	}

	fmt.Println("\n" + strings.Repeat("=", 80))
}

func countIssuesBySeverity(issues []models.Issue) map[string]int {
	count := map[string]int{
		"critical": 0,
		"high":     0,
		"warning":  0,
		"low":      0,
	}
	for _, issue := range issues {
		count[issue.Severity]++
	}
	return count
}
