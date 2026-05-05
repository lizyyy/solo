package cmd

import (
	"fmt"
	"path/filepath"

	"gcinsight/exporter"
	"gcinsight/storage"

	"github.com/spf13/cobra"
)

var (
	sessionID int64
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出已保存的分析报告",
	Long:  `导出指定会话的分析报告，支持 Markdown 和 JSON 格式。`,
	Run:   runExport,
}

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "列出所有分析会话",
	Long:  `列出所有已保存的分析会话，包括会话 ID、名称和创建时间。`,
	Run:   runList,
}

func init() {
	exportCmd.Flags().Int64VarP(&sessionID, "session", "s", 0, "会话 ID（必填）")
	exportCmd.Flags().StringVarP(&outputFormat, "format", "f", "markdown", "输出格式: markdown 或 json")
	exportCmd.Flags().StringVarP(&outputPath, "output", "o", "", "输出文件路径（必填）")

	rootCmd.AddCommand(exportCmd)
	rootCmd.AddCommand(listCmd)
}

func runExport(cmd *cobra.Command, args []string) {
	if sessionID == 0 {
		exitWithError("必须提供会话 ID: --session", nil)
	}

	if outputPath == "" {
		exitWithError("必须提供输出文件路径: --output", nil)
	}

	dbPath := filepath.Join(".", "gcinsight.db")
	store, err := storage.NewStorage(dbPath)
	if err != nil {
		exitWithError("无法初始化数据库", err)
	}
	defer store.Close()

	result, err := store.GetAnalysisResult(sessionID)
	if err != nil {
		exitWithError(fmt.Sprintf("获取会话 %d 的分析结果失败", sessionID), err)
	}

	fmt.Printf("导出会话: %d\n", sessionID)
	fmt.Printf("输出格式: %s\n", outputFormat)
	fmt.Printf("输出路径: %s\n", outputPath)

	exp := exporter.NewExporter()
	if outputFormat == "json" {
		if err := exp.ExportJSON(result, outputPath); err != nil {
			exitWithError("导出 JSON 失败", err)
		}
	} else {
		if err := exp.ExportMarkdown(result, outputPath); err != nil {
			exitWithError("导出 Markdown 失败", err)
		}
	}

	fmt.Println("\n导出完成！")
}

func runList(cmd *cobra.Command, args []string) {
	dbPath := filepath.Join(".", "gcinsight.db")
	store, err := storage.NewStorage(dbPath)
	if err != nil {
		exitWithError("无法初始化数据库", err)
	}
	defer store.Close()

	sessions, err := store.ListSessions()
	if err != nil {
		exitWithError("获取会话列表失败", err)
	}

	if len(sessions) == 0 {
		fmt.Println("没有找到任何分析会话。")
		fmt.Println("使用 'gcinsight analyze' 命令创建新的分析会话。")
		return
	}

	fmt.Println("=" + " 分析会话列表 " + "=")
	fmt.Println()

	for i, session := range sessions {
		fmt.Printf("【会话 %d】\n", i+1)
		fmt.Printf("  ID:          %d\n", session.ID)
		fmt.Printf("  名称:        %s\n", session.Name)
		if session.Description != "" {
			fmt.Printf("  描述:        %s\n", session.Description)
		}
		fmt.Printf("  创建时间:    %s\n", session.CreatedAt.Format("2006-01-02 15:04:05"))
		if session.GCTracePath != "" {
			fmt.Printf("  GC 跟踪:     %s\n", session.GCTracePath)
		}
		if session.HeapSamplePath != "" {
			fmt.Printf("  堆采样:      %s\n", session.HeapSamplePath)
		}
		if session.AllocEventPath != "" {
			fmt.Printf("  分配事件:    %s\n", session.AllocEventPath)
		}
		fmt.Println()
	}

	fmt.Printf("共 %d 个会话\n", len(sessions))
}
