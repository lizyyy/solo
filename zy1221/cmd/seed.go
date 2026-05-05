package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/zy1221/slice-teacher/internal/errors"
)

var seedCmd = &cobra.Command{
	Use:   "seed",
	Short: "生成样例数据文件",
	Long: `生成 slice-cases.yaml、ops.jsonl 和 snippets/*.go 的样例文件，
帮助团队快速理解如何定义 slice 操作场景。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return generateSeed()
	},
}

var (
	seedOutputDir string
	forceOverwrite bool
)

func init() {
	rootCmd.AddCommand(seedCmd)

	seedCmd.Flags().StringVarP(&seedOutputDir, "output", "O", ".", "输出目录")
	seedCmd.Flags().BoolVarP(&forceOverwrite, "force", "f", false, "强制覆盖已存在的文件")
}

func generateSeed() error {
	if err := os.MkdirAll(seedOutputDir, 0755); err != nil {
		return errors.NewIOError("无法创建输出目录", seedOutputDir, err)
	}

	snippetsDir := filepath.Join(seedOutputDir, "snippets")
	if err := os.MkdirAll(snippetsDir, 0755); err != nil {
		return errors.NewIOError("无法创建 snippets 目录", snippetsDir, err)
	}

	sliceCasesPath := filepath.Join(seedOutputDir, "slice-cases.yaml")
	if err := writeFileIfNotExists(sliceCasesPath, seedSliceCasesYAML, forceOverwrite); err != nil {
		return err
	}
	fmt.Printf("✅ 已生成: %s\n", sliceCasesPath)

	opsJSONLPath := filepath.Join(seedOutputDir, "ops.jsonl")
	if err := writeFileIfNotExists(opsJSONLPath, seedOpsJSONL, forceOverwrite); err != nil {
		return err
	}
	fmt.Printf("✅ 已生成: %s\n", opsJSONLPath)

	basicSnippetPath := filepath.Join(snippetsDir, "basic.go")
	if err := writeFileIfNotExists(basicSnippetPath, seedBasicGo, forceOverwrite); err != nil {
		return err
	}
	fmt.Printf("✅ 已生成: %s\n", basicSnippetPath)

	advancedSnippetPath := filepath.Join(snippetsDir, "advanced.go")
	if err := writeFileIfNotExists(advancedSnippetPath, seedAdvancedGo, forceOverwrite); err != nil {
		return err
	}
	fmt.Printf("✅ 已生成: %s\n", advancedSnippetPath)

	fmt.Println()
	fmt.Println("========================================")
	fmt.Println("样例数据已生成完成!")
	fmt.Println("========================================")
	fmt.Println()
	fmt.Println("可用的测试场景:")
	fmt.Println("  1. basic_append - 基础 append 扩容演示")
	fmt.Println("  2. slice_alias - 切片别名问题演示")
	fmt.Println("  3. full_slice_expr - Full Slice Expression 演示")
	fmt.Println("  4. func_param - 函数传参问题演示")
	fmt.Println("  5. big_array_hold - 大数组持有问题演示")
	fmt.Println()
	fmt.Println("运行命令:")
	fmt.Println("  slice-teacher run -c slice-cases.yaml")
	fmt.Println("  slice-teacher run -o ops.jsonl")
	fmt.Println("  slice-teacher run -s snippets/")
	fmt.Println()

	return nil
}

func writeFileIfNotExists(path string, content string, force bool) error {
	if !force {
		if _, err := os.Stat(path); err == nil {
			return errors.NewConfigError(
				fmt.Sprintf("文件已存在: %s", path),
				path,
				"使用 --force 选项强制覆盖",
			)
		}
	}

	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return errors.NewIOError("无法写入文件", path, err)
	}

	return nil
}

const seedSliceCasesYAML = `# Slice Teacher - 测试用例配置文件
# 此文件定义了多个 slice 操作场景，用于演示底层数组共享问题

cases:
  - id: "basic_append"
    name: "基础 append 扩容演示"
    description: "演示 append 操作如何触发扩容，以及扩容后的数组变化"
    category: "基础"
    seed: 42
    operations:
      - type: "make"
        target: "a"
        parameters:
          len: 3
          cap: 5
        description: "创建切片 a，len=3, cap=5"
      
      - type: "append"
        target: "a"
        parameters:
          num_elements: 2
        description: "追加 2 个元素，不会触发扩容"
      
      - type: "append"
        target: "a"
        parameters:
          num_elements: 3
        description: "追加 3 个元素，触发扩容"

  - id: "slice_alias"
    name: "切片别名问题演示"
    description: "演示切片表达式如何创建别名，以及修改一个会影响另一个"
    category: "别名"
    seed: 100
    operations:
      - type: "make"
        target: "original"
        parameters:
          len: 5
          cap: 10
        description: "创建原始切片"
      
      - type: "slice"
        target: "alias1"
        sources: ["original"]
        parameters:
          low: 1
          high: 4
        description: "从 original[1:4] 创建 alias1"
      
      - type: "modify_element"
        target: "alias1"
        parameters:
          index: 1
        description: "修改 alias1[1]"
      
      - type: "slice"
        target: "alias2"
        sources: ["original"]
        parameters:
          low: 0
          high: 5
        description: "创建另一个别名 alias2"

  - id: "full_slice_expr"
    name: "Full Slice Expression 演示"
    description: "演示 full slice expression (s[low:high:max]) 如何限制 cap，防止意外共享"
    category: "最佳实践"
    seed: 200
    operations:
      - type: "make"
        target: "source"
        parameters:
          len: 5
          cap: 10
        description: "创建源切片"
      
      - type: "slice"
        target: "normal_slice"
        sources: ["source"]
        parameters:
          low: 1
          high: 3
        description: "普通切片表达式 s[1:3]，cap 继承原数组"
      
      - type: "full_slice"
        target: "limited_slice"
        sources: ["source"]
        parameters:
          low: 1
          high: 3
          max: 3
        description: "Full slice expression s[1:3:3]，cap 被限制为 2"
      
      - type: "append"
        target: "normal_slice"
        parameters:
          num_elements: 5
        description: "normal_slice append 可能不会立即扩容，会修改原数组"
      
      - type: "append"
        target: "limited_slice"
        parameters:
          num_elements: 5
        description: "limited_slice append 会立即扩容，不会影响原数组"

  - id: "func_param"
    name: "函数传参问题演示"
    description: "演示切片作为函数参数时的行为：值传递但共享底层数组"
    category: "函数"
    seed: 300
    operations:
      - type: "make"
        target: "data"
        parameters:
          len: 3
          cap: 5
        description: "创建原始数据切片"
      
      - type: "func_pass_by_value"
        target: "data"
        description: "模拟将 data 传递给函数（值传递）"
      
      - type: "modify_element"
        target: "data_param"
        parameters:
          index: 0
        description: "函数内修改 data_param[0]"
      
      - type: "append"
        target: "data_param"
        parameters:
          num_elements: 3
        description: "函数内 append，可能触发扩容"

  - id: "big_array_hold"
    name: "大数组持有问题演示"
    description: "演示 reslice 如何持有大数组，导致内存浪费"
    category: "内存泄漏"
    seed: 400
    operations:
      - type: "make"
        target: "big_slice"
        parameters:
          len: 100
          cap: 100
        description: "创建一个大切片 (len=100)"
      
      - type: "slice"
        target: "small_view"
        sources: ["big_slice"]
        parameters:
          low: 0
          high: 5
        description: "从大切片取前 5 个元素作为视图"
      
      - type: "filter"
        target: "filtered"
        sources: ["big_slice"]
        parameters:
          ratio: 0.1
        description: "filter 操作创建新数组，但原数组可能被其他切片持有"
`

const seedOpsJSONL = `{"type": "make", "target": "a", "parameters": {"len": 3, "cap": 5}, "description": "创建切片 a"}
{"type": "slice", "target": "b", "sources": ["a"], "parameters": {"low": 1, "high": 3}, "description": "创建切片 b = a[1:3]"}
{"type": "append", "target": "a", "parameters": {"num_elements": 3}, "description": "追加 3 个元素到 a"}
{"type": "modify_element", "target": "b", "parameters": {"index": 0}, "description": "修改 b[0]"}
{"type": "copy", "target": "a_copy", "sources": ["a"], "description": "copy a 到 a_copy"}
`

const seedBasicGo = `package main

import "fmt"

// 此文件演示了基本的 slice 操作
// Slice Teacher 会自动解析这些操作

func main() {
	// make 创建切片
	a := make([]int, 3, 5)
	fmt.Println("a:", a, "len:", len(a), "cap:", cap(a))

	// 切片表达式创建别名
	b := a[1:3]
	fmt.Println("b:", b, "len:", len(b), "cap:", cap(b))

	// append 操作
	a = append(a, 1, 2, 3)
	fmt.Println("after append a:", a, "len:", len(a), "cap:", cap(a))

	// 修改元素
	b[0] = 100
	fmt.Println("after modify b[0]:")
	fmt.Println("a:", a)
	fmt.Println("b:", b)
}
`

const seedAdvancedGo = `package main

import "fmt"

// 此文件演示了高级 slice 操作
// 使用 @slice-op 标注可以更精确地控制模拟行为

func processSlice(s []int) {
	// @slice-op: func_pass_by_value(target=s)
	s[0] = 999
	// @slice-op: append(target=s, num_elements=5)
	s = append(s, 1, 2, 3, 4, 5)
	fmt.Println("inside function:", s)
}

func main() {
	// 创建大数组
	// @slice-op: make(target=big, len=50, cap=50)
	big := make([]int, 50, 50)
	for i := range big {
		big[i] = i
	}

	// Full slice expression - 限制 cap
	// @slice-op: full_slice(target=safe, source=big, low=0, high=10, max=10)
	safe := big[0:10:10]

	// 普通切片 - 不限制 cap
	// @slice-op: slice(target=dangerous, source=big, low=0, high=10)
	dangerous := big[:10]

	// 传递给函数
	data := make([]int, 3, 5)
	// @slice-op: func_pass_by_value(target=data)
	processSlice(data)
	fmt.Println("outside function:", data)

	// copy 创建独立副本
	// @slice-op: make(target=copyDest, len=len(dangerous), cap=len(dangerous))
	copyDest := make([]int, len(dangerous))
	// @slice-op: copy(target=copyDest, source=dangerous)
	copy(copyDest, dangerous)

	// filter 操作
	// @slice-op: filter(target=filtered, source=big, ratio=0.2)
	filtered := filterEven(big)
	fmt.Println("filtered:", filtered)
}

func filterEven(s []int) []int {
	var result []int
	for _, v := range s {
		if v%2 == 0 {
			result = append(result, v)
		}
	}
	return result
}
`
