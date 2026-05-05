package cmd

import (
	"encoding/json"
	"fmt"
	"mapdebug/pkg/storage"
	"mapdebug/pkg/types"
	"os"
	"sort"
	"text/template"
	"time"

	"github.com/spf13/cobra"
)

var exportCmd = &cobra.Command{
	Use:   "export <session-id> [output-file]",
	Short: "导出复盘报告为 Markdown 或 JSON",
	Long: `export 命令将复盘会话导出为可读的 Markdown 报告或机器可读的 JSON 格式。

示例:
  mapdebug export <session-id> report.md
  mapdebug export <session-id> report.json --format json
  mapdebug export <session-id> --include-steps`,
	Args: cobra.MinimumNArgs(1),
	RunE: runExport,
}

func init() {
	rootCmd.AddCommand(exportCmd)
	exportCmd.Flags().StringP("format", "f", "markdown", "输出格式: markdown 或 json")
	exportCmd.Flags().Bool("include-steps", false, "包含详细步骤数据")
	exportCmd.Flags().Bool("stdout", false, "输出到标准输出")
}

func runExport(cmd *cobra.Command, args []string) error {
	dbPath, _ := cmd.Flags().GetString("db")
	format, _ := cmd.Flags().GetString("format")
	includeSteps, _ := cmd.Flags().GetBool("include-steps")
	toStdout, _ := cmd.Flags().GetBool("stdout")

	sessionID := args[0]
	var outputPath string
	if len(args) > 1 {
		outputPath = args[1]
	} else {
		if format == "json" {
			outputPath = fmt.Sprintf("report_%s.json", sessionID[:8])
		} else {
			outputPath = fmt.Sprintf("report_%s.md", sessionID[:8])
		}
	}

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}
	defer store.Close()

	session, err := store.GetSession(sessionID)
	if err != nil {
		return fmt.Errorf("获取会话失败: %w", err)
	}

	stats, err := store.GetAggregatedStats(sessionID)
	if err != nil {
		return fmt.Errorf("获取统计数据失败: %w", err)
	}

	risks, err := store.GetRisks(sessionID)
	if err != nil {
		return fmt.Errorf("获取风险数据失败: %w", err)
	}

	expandEvents, err := store.GetExpandEvents(sessionID)
	if err != nil {
		return fmt.Errorf("获取扩容事件失败: %w", err)
	}

	var steps []types.StepResult
	if includeSteps {
		steps, err = store.GetSteps(sessionID)
		if err != nil {
			return fmt.Errorf("获取步骤数据失败: %w", err)
		}
	}

	report := &ReportData{
		Session:      session,
		Stats:        stats,
		Risks:        risks,
		ExpandEvents: expandEvents,
		Steps:        steps,
		GeneratedAt:  time.Now(),
	}

	if format == "json" {
		return exportJSON(report, outputPath, toStdout)
	}
	return exportMarkdown(report, outputPath, toStdout)
}

type ReportData struct {
	Session      *types.Session
	Stats        *storage.SessionStats
	Risks        []types.RiskAlert
	ExpandEvents []storage.ExpandEvent
	Steps        []types.StepResult
	GeneratedAt  time.Time
}

func (r *ReportData) RiskByCategory() map[types.RiskCategory][]types.RiskAlert {
	result := make(map[types.RiskCategory][]types.RiskAlert)
	for _, risk := range r.Risks {
		result[risk.Category] = append(result[risk.Category], risk)
	}
	return result
}

func (r *ReportData) HighestLevelRisk() types.RiskLevel {
	level := types.RiskInfo
	for _, risk := range r.Risks {
		if risk.Level == types.RiskError {
			return types.RiskError
		} else if risk.Level == types.RiskWarning && level != types.RiskError {
			level = types.RiskWarning
		}
	}
	return level
}

func (r *ReportData) TopCostSteps(n int) []types.StepResult {
	if len(r.Steps) == 0 {
		return nil
	}
	sorted := make([]types.StepResult, len(r.Steps))
	copy(sorted, r.Steps)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].LookupCost.CostScore > sorted[j].LookupCost.CostScore
	})
	if n > len(sorted) {
		n = len(sorted)
	}
	return sorted[:n]
}

func exportJSON(report *ReportData, outputPath string, toStdout bool) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化 JSON 失败: %w", err)
	}

	if toStdout {
		fmt.Println(string(data))
		return nil
	}

	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}

	fmt.Printf("✅ 报告已导出: %s\n", outputPath)
	return nil
}

func exportMarkdown(report *ReportData, outputPath string, toStdout bool) error {
	mdTemplate := buildMarkdownTemplate()

	funcMap := template.FuncMap{
		"pow2": func(n int) int {
			return 1 << n
		},
		"add": func(a, b int) int {
			return a + b
		},
	}

	tmpl, err := template.New("report").Funcs(funcMap).Parse(mdTemplate)
	if err != nil {
		return fmt.Errorf("解析模板失败: %w", err)
	}

	var output *os.File
	if toStdout {
		output = os.Stdout
	} else {
		output, err = os.Create(outputPath)
		if err != nil {
			return fmt.Errorf("创建文件失败: %w", err)
		}
		defer output.Close()
	}

	if err := tmpl.Execute(output, report); err != nil {
		return fmt.Errorf("生成报告失败: %w", err)
	}

	if !toStdout {
		fmt.Printf("✅ 报告已导出: %s\n", outputPath)
	}

	return nil
}

func buildMarkdownTemplate() string {
	return `# Go Map 底层行为复盘报告

## 会话信息

| 字段 | 值 |
|------|-----|
| **会话 ID** | {{.Session.ID}} |
| **会话名称** | {{.Session.Name}} |
| **种子** | {{.Session.Seed}} |
| **总操作数** | {{.Session.OpCount}} |
| **执行步数** | {{.Stats.TotalSteps}} |
| **创建时间** | {{.Session.CreatedAt.Format "2006-01-02 15:04:05"}} |
| **报告生成时间** | {{.GeneratedAt.Format "2006-01-02 15:04:05"}} |

---

## 性能统计

| 指标 | 值 |
|------|-----|
| **平均查找成本** | {{printf "%.2f" .Stats.AvgCost}} |
| **最高查找成本** | {{printf "%.2f" .Stats.MaxCost}} |
| **平均溢出遍历** | {{printf "%.2f" .Stats.AvgOverflow}} |
| **最大溢出链长** | {{.Stats.MaxOverflow}} |
| **扩容事件数** | {{.Stats.ExpandCount}} |
| **风险数** | {{len .Risks}} |

---

{{if .ExpandEvents}}
## 扩容事件

{{range .ExpandEvents}}
- **步骤 {{.StepIndex}}**: {{.Phase}} (桶数: 2^{{.OldB}} = {{printf "%d" (pow2 .OldB)}} → 2^{{.NewB}} = {{printf "%d" (pow2 .NewB)}})
{{end}}

> **说明**: Go map 采用增量扩容策略，每次操作只迁移部分 bucket。当 loadFactor > 6.5 或溢出桶过多时触发扩容。
{{end}}

---

## 风险分析

{{if .Risks}}
**总体风险等级: {{.HighestLevelRisk}}**

{{range $cat, $risks := .RiskByCategory}}
### {{$cat}}

> 共 {{len $risks}} 次检测

{{range $risks}}
- **[{{.Level}}]** {{.Message}}
  {{if .AffectedKey}}- 影响: {{.AffectedKey}}{{end}}
  - 建议: {{.Suggestion}}

{{end}}
{{end}}

{{else}}
**未检测到风险**
{{end}}

---

{{if .Steps}}
## 高成本操作 TOP 5

{{range $i, $step := .TopCostSteps 5}}
### #{{add $i 1}} (步骤 {{$step.StepIndex}})

- **操作**: {{$step.Op.Type}} {{if $step.Op.Key}}{{$step.Op.Key}}{{end}}
- **查找成本**: {{printf "%.2f" $step.LookupCost.CostScore}}
- **溢出遍历**: {{$step.LookupCost.OverflowWalk}}
- **状态**: count={{$step.MapState.Count}}, B={{$step.MapState.B}}, load={{printf "%.2f" $step.MapState.LoadFactor}}
{{if $step.RiskAlerts}}- **风险**:
{{range $step.RiskAlerts}}  - [{{.Level}}] {{.Message}}
{{end}}{{end}}

{{end}}
{{end}}

---

## 附录: Go Map 底层机制速查

### 核心数据结构

type hmap struct {
    count      int        // 元素数量
    flags      uint8      // 状态标志
    B          uint8      // 桶数 = 2^B
    noverflow  uint16     // 溢出桶数量
    hash0      uint32     // 哈希种子
    buckets    unsafe.Pointer // 桶数组
    oldbuckets unsafe.Pointer // 扩容时的旧桶
    nevacuate  uintptr    // 已迁移桶数
}

type bmap struct {
    tophash  [8]uint8      // 每个槽位的 tophash
    keys     [8]keytype    // 键数组
    values   [8]valuetype  // 值数组
    overflow *bmap         // 溢出桶指针
}

### Tophash 含义

| 值 | 含义 |
|----|------|
| 0 | 空槽位，后面也是空 |
| 1 | 空槽位 (已删除，tombstone) |
| 2-254 | 有效 tophash 值 |
| 255 | 已迁移标记 (扩容期间) |

### 扩容触发条件

当以下任一条件满足时触发扩容：

1. **装载因子 > 6.5** (count / (2^B) > 6.5)
2. **溢出桶过多** (overflow count >= 2^B 且 count > 4*2^B)

### 增量扩容过程

1. 创建新桶数组 (大小翻倍)
2. oldbuckets 指向旧桶数组
3. 每次 put/get/delete 操作最多迁移 2 个 bucket
4. 查找时同时检查新旧 bucket
5. 所有 bucket 迁移完成后释放旧桶

### 性能优化建议

| 场景 | 建议 |
|------|------|
| 预知元素数量 | 使用 make(map[K]V, size) 预分配 |
| 键值对较大 | 考虑使用指针类型减少拷贝 |
| 高并发场景 | 使用 sync.Map 或 sync.RWMutex |
| 频繁删除 | 定期重建 map 清理 tombstone |
| 哈希冲突多 | 更换键类型或自定义哈希 |

---

*报告由 mapdebug 工具生成*
`
}
