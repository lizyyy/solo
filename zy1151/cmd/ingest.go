package cmd

import (
	"fmt"
	"memreplay/internal/models"
	"memreplay/internal/parser"
	"memreplay/internal/storage"
	"os"
	"time"

	"github.com/spf13/cobra"
)

var ingestCmd = &cobra.Command{
	Use:   "ingest",
	Short: "导入数据文件到批次",
	Long: `导入各种数据文件到指定的批次中。支持的文件类型：
- memstats.csv: runtime.MemStats 采样数据
- goroutines.txt: goroutine 堆栈信息
- traffic.csv: 流量日志数据
- alloc-sites.csv: 分配点统计
- config.yaml: 配置文件
- heap-profile.json: 简化版 heap profile

示例:
  memreplay ingest --batch v1.0.0 --memstats ./memstats.csv
  memreplay ingest --batch v1.0.0 --memstats ./memstats.csv --goroutines ./goroutines.txt --traffic ./traffic.csv
  memreplay ingest --batch v1.0.0 --config ./config.yaml --alloc-sites ./alloc.csv`,
	Run: func(cmd *cobra.Command, args []string) {
		batchName, _ := cmd.Flags().GetString("batch")
		memstatsPath, _ := cmd.Flags().GetString("memstats")
		goroutinesPath, _ := cmd.Flags().GetString("goroutines")
		trafficPath, _ := cmd.Flags().GetString("traffic")
		allocSitesPath, _ := cmd.Flags().GetString("alloc-sites")
		configPath, _ := cmd.Flags().GetString("config")
		heapProfilePath, _ := cmd.Flags().GetString("heap-profile")
		description, _ := cmd.Flags().GetString("description")

		if batchName == "" {
			errorExit("必须指定 --batch 参数", nil)
			return
		}

		hasAnyFile := memstatsPath != "" || goroutinesPath != "" || trafficPath != "" ||
			allocSitesPath != "" || configPath != "" || heapProfilePath != ""

		if !hasAnyFile {
			errorExit("至少需要指定一个数据文件 (--memstats, --goroutines, --traffic, --alloc-sites, --config, 或 --heap-profile)", nil)
			return
		}

		batch, err := storage.GetBatchByName(batchName)
		if err != nil {
			errorExit(fmt.Sprintf("找不到批次: %s", batchName), err)
			return
		}

		samplePoint := &models.SamplePoint{
			BatchID:     batch.ID,
			Timestamp:   time.Now(),
			Description: description,
			SourceType:  "manual_ingest",
		}

		if err := storage.CreateSamplePoint(samplePoint); err != nil {
			errorExit("创建采样点失败", err)
			return
		}

		importedCount := 0

		if memstatsPath != "" {
			if _, err := os.Stat(memstatsPath); os.IsNotExist(err) {
				errorExit(fmt.Sprintf("文件不存在: %s", memstatsPath), err)
				return
			}

			records, err := parser.ParseMemStatsCSV(memstatsPath)
			if err != nil {
				errorExit("解析 memstats.csv 失败", err)
				return
			}

			for i := range records {
				records[i].SamplePointID = samplePoint.ID
				if err := storage.CreateMemStatsRecord(&records[i]); err != nil {
					errorExit("保存 MemStats 记录失败", err)
					return
				}
			}
			fmt.Printf("✓ 已导入 %d 条 MemStats 记录\n", len(records))
			importedCount++
		}

		if goroutinesPath != "" {
			if _, err := os.Stat(goroutinesPath); os.IsNotExist(err) {
				errorExit(fmt.Sprintf("文件不存在: %s", goroutinesPath), err)
				return
			}

			records, err := parser.ParseGoroutinesFile(goroutinesPath)
			if err != nil {
				errorExit("解析 goroutines.txt 失败", err)
				return
			}

			for i := range records {
				records[i].SamplePointID = samplePoint.ID
				if err := storage.CreateGoroutineRecord(&records[i]); err != nil {
					errorExit("保存 Goroutine 记录失败", err)
					return
				}
			}
			fmt.Printf("✓ 已导入 %d 条 Goroutine 记录\n", len(records))
			importedCount++
		}

		if trafficPath != "" {
			if _, err := os.Stat(trafficPath); os.IsNotExist(err) {
				errorExit(fmt.Sprintf("文件不存在: %s", trafficPath), err)
				return
			}

			records, err := parser.ParseTrafficCSV(trafficPath)
			if err != nil {
				errorExit("解析 traffic.csv 失败", err)
				return
			}

			for i := range records {
				records[i].SamplePointID = samplePoint.ID
				if err := storage.CreateTrafficRecord(&records[i]); err != nil {
					errorExit("保存 Traffic 记录失败", err)
					return
				}
			}
			fmt.Printf("✓ 已导入 %d 条 Traffic 记录\n", len(records))
			importedCount++
		}

		if allocSitesPath != "" {
			if _, err := os.Stat(allocSitesPath); os.IsNotExist(err) {
				errorExit(fmt.Sprintf("文件不存在: %s", allocSitesPath), err)
				return
			}

			sites, err := parser.ParseAllocSitesCSV(allocSitesPath)
			if err != nil {
				errorExit("解析 alloc-sites.csv 失败", err)
				return
			}

			for i := range sites {
				sites[i].SamplePointID = samplePoint.ID
				if err := storage.CreateAllocSite(&sites[i]); err != nil {
					errorExit("保存 AllocSite 记录失败", err)
					return
				}
			}
			fmt.Printf("✓ 已导入 %d 条 AllocSite 记录\n", len(sites))
			importedCount++
		}

		if configPath != "" {
			if _, err := os.Stat(configPath); os.IsNotExist(err) {
				errorExit(fmt.Sprintf("文件不存在: %s", configPath), err)
				return
			}

			records, err := parser.ParseConfigYAML(configPath)
			if err != nil {
				errorExit("解析 config.yaml 失败", err)
				return
			}

			for i := range records {
				records[i].SamplePointID = samplePoint.ID
				if err := storage.CreateConfigRecord(&records[i]); err != nil {
					errorExit("保存 Config 记录失败", err)
					return
				}
			}
			fmt.Printf("✓ 已导入 %d 条 Config 记录\n", len(records))
			importedCount++
		}

		if heapProfilePath != "" {
			if _, err := os.Stat(heapProfilePath); os.IsNotExist(err) {
				errorExit(fmt.Sprintf("文件不存在: %s", heapProfilePath), err)
				return
			}

			records, err := parser.ParseHeapProfileJSON(heapProfilePath)
			if err != nil {
				errorExit("解析 heap-profile.json 失败", err)
				return
			}

			for i := range records {
				records[i].SamplePointID = samplePoint.ID
				if err := storage.CreateHeapProfileRecord(&records[i]); err != nil {
					errorExit("保存 HeapProfile 记录失败", err)
					return
				}
			}
			fmt.Printf("✓ 已导入 %d 条 HeapProfile 记录\n", len(records))
			importedCount++
		}

		fmt.Println()
		fmt.Println("下一步:")
		fmt.Printf("  memreplay analyze --batch %s\n", batchName)
	},
}

func init() {
	rootCmd.AddCommand(ingestCmd)

	ingestCmd.Flags().StringP("batch", "b", "", "目标批次名称 (必填)")
	ingestCmd.Flags().String("memstats", "", "runtime.MemStats CSV 文件路径")
	ingestCmd.Flags().String("goroutines", "", "Goroutine 堆栈文件路径")
	ingestCmd.Flags().String("traffic", "", "流量 CSV 文件路径")
	ingestCmd.Flags().String("alloc-sites", "", "分配点 CSV 文件路径")
	ingestCmd.Flags().String("config", "", "配置 YAML 文件路径")
	ingestCmd.Flags().String("heap-profile", "", "Heap Profile JSON 文件路径")
	ingestCmd.Flags().StringP("description", "d", "", "采样点描述")

	_ = ingestCmd.MarkFlagRequired("batch")
}
