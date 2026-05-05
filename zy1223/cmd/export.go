package cmd

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"go-iface-analyzer/internal/database"
	"go-iface-analyzer/internal/exporter"
)

var (
	exportSessionID int64
	exportFormat    string
	exportOutput    string
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出分析报告为 Markdown 或 JSON 格式",
	Long: `将指定会话的分析结果导出为 Markdown 或 JSON 格式的报告。
如果不指定 --session，则使用最近的分析会话。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runExport()
	},
}

func init() {
	exportCmd.Flags().Int64Var(&exportSessionID, "session", 0, "指定要导出的会话 ID（默认使用最近的会话）")
	exportCmd.Flags().StringVarP(&exportFormat, "format", "f", "markdown", "输出格式：markdown 或 json")
	exportCmd.Flags().StringVarP(&exportOutput, "output", "o", "", "输出文件路径（必填）")

	rootCmd.AddCommand(exportCmd)
}

func runExport() error {
	if exportOutput == "" {
		return fmt.Errorf("必须指定输出文件路径 -o/--output")
	}

	format := exporter.ExportFormat(strings.ToLower(exportFormat))
	if format != exporter.FormatMarkdown && format != exporter.FormatJSON {
		return fmt.Errorf("无效的格式: %s，支持 markdown 和 json", exportFormat)
	}

	db, err := database.New()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer db.Close()

	if !db.DBExists() {
		return fmt.Errorf("暂无分析记录。请先运行 'go-iface-analyzer analyze' 进行分析")
	}

	var sessionID int64
	if exportSessionID > 0 {
		sessionID = exportSessionID
	} else {
		sessions, err := db.GetRecentSessions(1)
		if err != nil {
			return fmt.Errorf("获取最近会话失败: %w", err)
		}
		if len(sessions) == 0 {
			return fmt.Errorf("暂无分析记录")
		}
		sessionID = sessions[0].ID
	}

	fmt.Printf("正在导出会话 %d 的分析报告...\n", sessionID)

	session, cases, issues, err := db.GetSessionWithDetails(sessionID)
	if err != nil {
		return fmt.Errorf("获取会话详情失败: %w", err)
	}

	report := &exporter.Report{
		Session:   session,
		Cases:     cases,
		Issues:    issues,
		Generated: time.Now(),
	}

	absOutput, err := filepath.Abs(exportOutput)
	if err != nil {
		absOutput = exportOutput
	}

	if format == exporter.FormatMarkdown {
		if err := exporter.ExportToMarkdown(report, absOutput); err != nil {
			return fmt.Errorf("导出 Markdown 失败: %w", err)
		}
	} else {
		if err := exporter.ExportToJSON(report, absOutput); err != nil {
			return fmt.Errorf("导出 JSON 失败: %w", err)
		}
	}

	fmt.Printf("报告已导出到: %s\n", absOutput)
	fmt.Printf("格式: %s\n", format)

	return nil
}
