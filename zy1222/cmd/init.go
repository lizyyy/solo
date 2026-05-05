package cmd

import (
	"encoding/json"
	"fmt"
	"mapdebug/pkg/types"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var initCmd = &cobra.Command{
	Use:   "init [name]",
	Short: "初始化一个新的复盘会话",
	Long: `init 命令创建一个新的复盘会话，并生成必要的配置文件。

示例:
  mapdebug init session_001
  mapdebug init collision_case --seed 42 --case-id hash-collision`,
	Args: cobra.MaximumNArgs(1),
	RunE: runInit,
}

func init() {
	rootCmd.AddCommand(initCmd)
	initCmd.Flags().String("case-id", "", "关联的测试用例 ID")
	initCmd.Flags().Int("initial-b", 0, "初始 B 值 (桶数量 = 2^B)")
	initCmd.Flags().Bool("with-examples", true, "生成示例配置文件")
}

func runInit(cmd *cobra.Command, args []string) error {
	workdir, _ := cmd.Flags().GetString("workdir")
	seed, _ := cmd.Flags().GetInt64("seed")
	initialB, _ := cmd.Flags().GetInt("initial-b")
	withExamples, _ := cmd.Flags().GetBool("with-examples")

	if err := checkWorkDir(workdir); err != nil {
		return err
	}

	var name string
	if len(args) > 0 {
		name = args[0]
	} else {
		name = fmt.Sprintf("session_%s", uuid.New().String()[:8])
	}

	fmt.Printf("初始化会话: %s\n", name)
	fmt.Printf("工作目录: %s\n", workdir)
	fmt.Printf("种子: %d\n", seed)
	fmt.Printf("初始 B: %d (桶数 = 2^%d = %d)\n", initialB, initialB, 1<<initialB)

	if withExamples {
		if err := generateExampleFiles(workdir); err != nil {
			return fmt.Errorf("生成示例文件失败: %w", err)
		}
	}

	fmt.Println("\n✅ 初始化完成!")
	fmt.Println("\n下一步:")
	fmt.Println("  1. 编辑 map-cases.yaml 配置测试用例")
	fmt.Println("  2. 编辑 ops.jsonl 添加操作序列")
	fmt.Println("  3. 运行 'mapdebug replay' 开始复盘")

	return nil
}

func generateExampleFiles(workdir string) error {
	caseConfig := types.CaseConfig{
		ID:          "hash-collision-demo",
		Name:        "哈希冲突演示",
		Description: "演示哈希冲突如何导致性能下降",
		Seed:        42,
		MapType:     "map[string]string",
		InitialSize: 0,
		Settings:    map[string]string{"hash_function": "fnv64a"},
		Tags:        []string{"collision", "performance"},
	}

	caseFile := filepath.Join(workdir, "map-cases.yaml")
	if err := writeYAML(caseFile, []types.CaseConfig{caseConfig}); err != nil {
		return err
	}
	fmt.Printf("  已创建: %s\n", caseFile)

	opsFile := filepath.Join(workdir, "ops.jsonl")
	exampleOps := generateExampleOps()
	if err := writeJSONL(opsFile, exampleOps); err != nil {
		return err
	}
	fmt.Printf("  已创建: %s\n", opsFile)

	snippetsDir := filepath.Join(workdir, "snippets")
	if err := os.MkdirAll(snippetsDir, 0755); err != nil {
		return err
	}
	
	snippetFile := filepath.Join(snippetsDir, "example.go")
	if err := writeExampleSnippet(snippetFile); err != nil {
		return err
	}
	fmt.Printf("  已创建: %s\n", snippetFile)

	return nil
}

func generateExampleOps() []types.Operation {
	return []types.Operation{
		{Type: types.OpPut, Key: "user_1", Value: "Alice"},
		{Type: types.OpPut, Key: "user_2", Value: "Bob"},
		{Type: types.OpPut, Key: "user_3", Value: "Charlie"},
		{Type: types.OpGet, Key: "user_1"},
		{Type: types.OpPut, Key: "user_4", Value: "David"},
		{Type: types.OpPut, Key: "user_5", Value: "Eve"},
		{Type: types.OpPut, Key: "user_6", Value: "Frank"},
		{Type: types.OpPut, Key: "user_7", Value: "Grace"},
		{Type: types.OpPut, Key: "user_8", Value: "Henry"},
		{Type: types.OpPut, Key: "user_9", Value: "Ivy"},
		{Type: types.OpRange},
		{Type: types.OpDelete, Key: "user_5"},
		{Type: types.OpLen},
		{Type: types.OpGet, Key: "user_5"},
	}
}

func writeYAML(filename string, data interface{}) error {
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := yaml.NewEncoder(file)
	encoder.SetIndent(2)
	defer encoder.Close()

	return encoder.Encode(data)
}

func writeJSONL(filename string, ops []types.Operation) error {
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	for _, op := range ops {
		if err := encoder.Encode(op); err != nil {
			return err
		}
	}
	return nil
}

func writeExampleSnippet(filename string) error {
	code := `package main

import "fmt"

// 这段代码展示了 Go map 的常见用法
// 但没有处理并发安全和哈希冲突问题

func main() {
	// 未指定初始容量的 map
	m := make(map[string]int)

	// 插入数据
	for i := 0; i < 1000; i++ {
		key := fmt.Sprintf("key_%d", i)
		m[key] = i
	}

	// 问题1: 遍历顺序不稳定
	for k, v := range m {
		fmt.Printf("%s: %d\n", k, v)
		break
	}

	// 问题2: 并发不安全
	go func() {
		for {
			m["test"] = 1
		}
	}()
	go func() {
		for {
			_ = m["test"]
		}
	}()

	select {}
}
`
	return os.WriteFile(filename, []byte(code), 0644)
}
