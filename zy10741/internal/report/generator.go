package report

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync-failure-replay/internal/replay"
	"text/tabwriter"
	"time"
)

type ReportGenerator struct {
	outputDir string
}

func NewReportGenerator(outputDir string) *ReportGenerator {
	os.MkdirAll(outputDir, 0755)
	return &ReportGenerator{outputDir: outputDir}
}

func (rg *ReportGenerator) GenerateReport(plan *replay.BatchPlan) (string, error) {
	reportID := fmt.Sprintf("report-%s", plan.BatchID)
	basePath := filepath.Join(rg.outputDir, reportID)

	jsonPath := basePath + ".json"
	txtPath := basePath + ".txt"

	if err := rg.generateJSONReport(plan, jsonPath); err != nil {
		return "", err
	}

	if err := rg.generateTextReport(plan, txtPath); err != nil {
		return "", err
	}

	return txtPath, nil
}

func (rg *ReportGenerator) generateJSONReport(plan *replay.BatchPlan, path string) error {
	data, err := json.MarshalIndent(plan, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (rg *ReportGenerator) generateTextReport(plan *replay.BatchPlan, path string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	w := tabwriter.NewWriter(file, 0, 0, 2, ' ', 0)
	defer w.Flush()

	fmt.Fprintf(file, "═══════════════════════════════════════════════════════════════\n")
	fmt.Fprintf(file, "       同步失败日志批次重放计划报告\n")
	fmt.Fprintf(file, "═══════════════════════════════════════════════════════════════\n\n")

	fmt.Fprintf(file, "【批次信息】\n")
	fmt.Fprintf(w, "  批次编号:\t%s\n", plan.BatchID)
	fmt.Fprintf(w, "  输入哈希:\t%s\n", plan.InputHash[:16]+"...")
	fmt.Fprintf(w, "  创建时间:\t%s\n", plan.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Fprintf(w, "  批次状态:\t%s\n", plan.Status)
	w.Flush()

	fmt.Fprintf(file, "\n【统计汇总】\n")
	fmt.Fprintf(w, "  总条目数:\t%d\n", plan.TotalEntries)
	fmt.Fprintf(w, "  已处理:\t%d\n", plan.Processed)
	fmt.Fprintf(w, "  成功数:\t%d\n", plan.SuccessCount)
	fmt.Fprintf(w, "  失败数:\t%d\n", plan.FailedCount)
	fmt.Fprintf(w, "  成功率:\t%.2f%%\n", float64(plan.SuccessCount)/float64(max(1, plan.TotalEntries))*100)
	w.Flush()

	fmt.Fprintf(file, "\n【错误类型分布】\n")
	fmt.Fprintf(w, "  半批成功 (partial_success):\t%d 条\n", len(plan.PartialSuccess))
	fmt.Fprintf(w, "  主键冲突 (primary_key_conflict):\t%d 条\n", len(plan.PrimaryKeyConflict))
	fmt.Fprintf(w, "  顺序依赖 (order_dependency):\t%d 条\n", len(plan.OrderDependency))
	w.Flush()

	if len(plan.PartialSuccess) > 0 {
		fmt.Fprintf(file, "\n【半批成功 - 详细记录】\n")
		fmt.Fprintf(file, "─────────────────────────────────────────────────────────────\n")
		for _, entry := range plan.PartialSuccess {
			fmt.Fprintf(w, "  文件: %s:%d\n", filepath.Base(entry.FileName), entry.LineNumber)
			fmt.Fprintf(w, "  主键: %s\n", entry.PrimaryKey)
			fmt.Fprintf(w, "  内容: %s\n", truncate(entry.Content, 100))
			fmt.Fprintf(w, "  ─────────────────────────────────────────────────────────\n")
		}
		w.Flush()
	}

	if len(plan.PrimaryKeyConflict) > 0 {
		fmt.Fprintf(file, "\n【主键冲突 - 详细记录】\n")
		fmt.Fprintf(file, "─────────────────────────────────────────────────────────────\n")
		for _, entry := range plan.PrimaryKeyConflict {
			fmt.Fprintf(w, "  文件: %s:%d\n", filepath.Base(entry.FileName), entry.LineNumber)
			fmt.Fprintf(w, "  主键: %s\n", entry.PrimaryKey)
			fmt.Fprintf(w, "  内容: %s\n", truncate(entry.Content, 100))
			fmt.Fprintf(w, "  ─────────────────────────────────────────────────────────\n")
		}
		w.Flush()
	}

	if len(plan.OrderDependency) > 0 {
		fmt.Fprintf(file, "\n【顺序依赖 - 详细记录】\n")
		fmt.Fprintf(file, "─────────────────────────────────────────────────────────────\n")
		for _, entry := range plan.OrderDependency {
			fmt.Fprintf(w, "  文件: %s:%d\n", filepath.Base(entry.FileName), entry.LineNumber)
			fmt.Fprintf(w, "  主键: %s\n", entry.PrimaryKey)
			fmt.Fprintf(w, "  内容: %s\n", truncate(entry.Content, 100))
			fmt.Fprintf(w, "  ─────────────────────────────────────────────────────────\n")
		}
		w.Flush()
	}

	if len(plan.ReplayOrder) > 0 {
		fmt.Fprintf(file, "\n【重放执行顺序】\n")
		for i, id := range plan.ReplayOrder {
			fmt.Fprintf(file, "  %3d. %s\n", i+1, id)
		}
	}

	fmt.Fprintf(file, "\n═══════════════════════════════════════════════════════════════\n")
	fmt.Fprintf(file, "  报告生成时间: %s\n", time.Now().Format("2006-01-02 15:04:05"))
	fmt.Fprintf(file, "═══════════════════════════════════════════════════════════════\n")

	return nil
}

func (rg *ReportGenerator) PrintConsoleSummary(plan *replay.BatchPlan) {
	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Println("              同步失败日志批次重放计划")
	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Printf("批次编号: %s\n", plan.BatchID)
	fmt.Printf("状态: %s\n", plan.Status)
	fmt.Println()
	fmt.Printf("总条目: %d | 半批成功: %d | 主键冲突: %d | 顺序依赖: %d\n",
		plan.TotalEntries,
		len(plan.PartialSuccess),
		len(plan.PrimaryKeyConflict),
		len(plan.OrderDependency))
	fmt.Println()
	fmt.Println("重放计划已生成。详细报告请查看输出目录。")
	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Println()
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
