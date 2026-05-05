package cmd

import (
	"fmt"
	"strconv"
	"time"

	"github.com/spf13/cobra"
	"go-iface-analyzer/internal/database"
	"go-iface-analyzer/internal/models"
)

var replayCmd = &cobra.Command{
	Use:   "replay [session_id]",
	Short: "回放历史分析记录",
	Long: `查看历史分析会话的详细结果。
如果不指定 session_id，则显示最近的分析记录列表。`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(args) == 0 {
			return listRecentSessions()
		}
		sessionID, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			return fmt.Errorf("无效的 session_id: %w", err)
		}
		return replaySession(sessionID)
	},
}

func init() {
	rootCmd.AddCommand(replayCmd)
}

func listRecentSessions() error {
	db, err := database.New()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer db.Close()

	if !db.DBExists() {
		fmt.Println("暂无分析记录。请先运行 'go-iface-analyzer analyze' 进行分析。")
		return nil
	}

	sessions, err := db.GetRecentSessions(10)
	if err != nil {
		return fmt.Errorf("获取会话列表失败: %w", err)
	}

	if len(sessions) == 0 {
		fmt.Println("暂无分析记录。")
		return nil
	}

	fmt.Println("最近的分析记录:")
	fmt.Println("====================")
	for _, s := range sessions {
		duration := "-"
		if !s.EndTime.IsZero() {
			duration = s.EndTime.Sub(s.StartTime).Round(time.Millisecond).String()
		}
		fmt.Printf("会话 ID: %d\n", s.ID)
		fmt.Printf("  开始时间: %s\n", s.StartTime.Format("2006-01-02 15:04:05"))
		fmt.Printf("  状态: %s\n", s.Status)
		fmt.Printf("  总案例: %d, 问题数: %d\n", s.TotalCases, s.IssuesFound)
		fmt.Printf("  耗时: %s\n", duration)
		fmt.Println()
	}

	fmt.Println("使用 'go-iface-analyzer replay <session_id>' 查看详细结果")
	return nil
}

func replaySession(sessionID int64) error {
	db, err := database.New()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer db.Close()

	session, cases, issues, err := db.GetSessionWithDetails(sessionID)
	if err != nil {
		return fmt.Errorf("获取会话详情失败: %w", err)
	}

	fmt.Println("分析会话详情")
	fmt.Println("====================")
	fmt.Printf("会话 ID: %d\n", session.ID)
	fmt.Printf("开始时间: %s\n", session.StartTime.Format("2006-01-02 15:04:05"))
	if !session.EndTime.IsZero() {
		fmt.Printf("结束时间: %s\n", session.EndTime.Format("2006-01-02 15:04:05"))
		fmt.Printf("耗时: %s\n", session.EndTime.Sub(session.StartTime).Round(time.Millisecond).String())
	}
	fmt.Printf("状态: %s\n", session.Status)
	fmt.Printf("总案例数: %d\n", session.TotalCases)
	fmt.Printf("发现问题数: %d\n", session.IssuesFound)

	fmt.Println("\n分析案例:")
	fmt.Println("-------------------")
	for i, c := range cases {
		fmt.Printf("\n案例 %d: %s\n", i+1, c.CaseName)
		fmt.Printf("  分类: %s\n", c.Category)
		if c.Description != "" {
			fmt.Printf("  描述: %s\n", c.Description)
		}
		if c.SourceFile != "" {
			fmt.Printf("  源文件: %s:%d\n", c.SourceFile, c.LineNumber)
		}
	}

	if len(issues) > 0 {
		fmt.Println("\n\n发现的问题:")
		fmt.Println("-------------------")

		severityOrder := []string{"critical", "high", "medium", "low", "info"}
		for _, sev := range severityOrder {
			sevIssues := filterIssuesBySeverity(issues, sev)
			if len(sevIssues) == 0 {
				continue
			}

			sevLabel := map[string]string{
				"critical": "【严重】",
				"high":     "【高】",
				"medium":   "【中】",
				"low":      "【低】",
				"info":     "【信息】",
			}

			fmt.Printf("\n%s 问题 (%d 个):\n", sevLabel[sev], len(sevIssues))
			for j, issue := range sevIssues {
				fmt.Printf("\n  %d. [%s] %s\n", j+1, issue.IssueType, issue.Description)
				if issue.Location != "" {
					fmt.Printf("     位置: %s\n", issue.Location)
				}
				if issue.Suggestion != "" {
					fmt.Printf("     建议: %s\n", issue.Suggestion)
				}
			}
		}
	} else {
		fmt.Println("\n\n未发现问题。")
	}

	return nil
}

func filterIssuesBySeverity(issues []*models.AnalysisIssue, severity string) []*models.AnalysisIssue {
	var filtered []*models.AnalysisIssue
	for _, issue := range issues {
		if issue.Severity == severity {
			filtered = append(filtered, issue)
		}
	}
	return filtered
}
