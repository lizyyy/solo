package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"concurrency-inspector/internal/models"
	"concurrency-inspector/internal/storage"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

func InitCommand(s *storage.SQLiteStorage) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "init [project-name]",
		Short: "初始化一个新的并发设计项目",
		Long: `init 命令用于初始化一个新的并发设计项目。
它会创建项目目录结构、默认的 design.yaml 配置文件，
以及空的 snippets 目录和 events.jsonl 文件。`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			projectName := args[0]
			return runInit(cmd, projectName, s)
		},
	}

	cmd.Flags().StringP("dir", "d", ".", "项目目录路径")
	cmd.Flags().StringP("description", "D", "", "项目描述")

	return cmd
}

func runInit(cmd *cobra.Command, projectName string, s *storage.SQLiteStorage) error {
	dir, _ := cmd.Flags().GetString("dir")
	description, _ := cmd.Flags().GetString("description")

	projectDir := filepath.Join(dir, projectName)
	snippetsDir := filepath.Join(projectDir, "snippets")

	fmt.Printf("初始化项目: %s\n", projectName)
	fmt.Printf("目录: %s\n", projectDir)

	if err := os.MkdirAll(snippetsDir, 0755); err != nil {
		return fmt.Errorf("failed to create project directory: %w", err)
	}

	defaultConfig := models.DesignConfig{
		Name:        projectName,
		Description: description,
		Version:     "1.0.0",
		Concurrency: models.ConcurrencySpec{
			Patterns:   []string{"worker-pool"},
			MaxWorkers: 10,
		},
		Queues: []models.QueueSpec{
			{
				Name:        "task-queue",
				Type:        "channel",
				Capacity:    100,
				Priority:    false,
				Description: "主任务队列",
			},
			{
				Name:        "result-queue",
				Type:        "channel",
				Capacity:    100,
				Priority:    false,
				Description: "结果队列",
			},
		},
		Goroutines: []models.GoroutineSpec{
			{
				Name:         "dispatcher",
				Type:         "dispatcher",
				OutputQueues: []string{"task-queue"},
				Workers:      1,
			},
			{
				Name:         "worker",
				Type:         "worker",
				InputQueues:  []string{"task-queue"},
				OutputQueues: []string{"result-queue"},
				Workers:      4,
			},
			{
				Name:        "collector",
				Type:        "collector",
				InputQueues: []string{"result-queue"},
				Workers:     1,
			},
		},
		Timeout: models.TimeoutSpec{
			Default:       "30s",
			Startup:       "10s",
			Shutdown:      "15s",
			Operation:     "30s",
			CancelPropagate: true,
		},
		Error: models.ErrorSpec{
			Strategy:     "fail-fast",
			MaxRetries:   3,
			RetryBackoff: "1s",
			PanicHandler: true,
		},
		Shutdown: models.ShutdownSpec{
			Graceful:    true,
			Order:       []string{"dispatcher", "worker", "collector"},
			WaitTimeout: "10s",
			ForceKill:   true,
		},
	}

	yamlData, err := yaml.Marshal(&defaultConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal default config: %w", err)
	}

	configPath := filepath.Join(projectDir, "design.yaml")
	if err := os.WriteFile(configPath, yamlData, 0644); err != nil {
		return fmt.Errorf("failed to write design.yaml: %w", err)
	}

	eventsPath := filepath.Join(projectDir, "events.jsonl")
	if err := os.WriteFile(eventsPath, []byte(""), 0644); err != nil {
		return fmt.Errorf("failed to create events.jsonl: %w", err)
	}

	exampleSnippet := `package main

import (
	"context"
	"fmt"
	"sync"
)

type Task struct {
	ID   int
	Data string
}

type Result struct {
	TaskID int
	Output string
	Err    error
}

func WorkerPoolExample(ctx context.Context, tasks <-chan Task, results chan<- Result, workerCount int) {
	var wg sync.WaitGroup
	
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			
			for {
				select {
				case <-ctx.Done():
					fmt.Printf("Worker %d shutting down\n", workerID)
					return
				case task, ok := <-tasks:
					if !ok {
						return
					}
					result := processTask(task)
					select {
					case results <- result:
					case <-ctx.Done():
						return
					}
				}
			}
		}(i)
	}
	
	go func() {
		wg.Wait()
		close(results)
	}()
}

func processTask(task Task) Result {
	return Result{
		TaskID: task.ID,
		Output: fmt.Sprintf("processed: %s", task.Data),
	}
}
`

	snippetPath := filepath.Join(snippetsDir, "worker_pool_example.go")
	if err := os.WriteFile(snippetPath, []byte(exampleSnippet), 0644); err != nil {
		return fmt.Errorf("failed to create example snippet: %w", err)
	}

	db := s.DB()
	result, err := db.Exec(
		"INSERT INTO projects (name, description) VALUES (?, ?)",
		projectName, description,
	)
	if err != nil {
		return fmt.Errorf("failed to save project to database: %w", err)
	}

	projectID, _ := result.LastInsertId()

	yamlContent, _ := json.Marshal(defaultConfig)
	_, err = db.Exec(
		"INSERT INTO designs (project_id, name, yaml_content) VALUES (?, ?, ?)",
		projectID, projectName, string(yamlContent),
	)
	if err != nil {
		return fmt.Errorf("failed to save design to database: %w", err)
	}

	fmt.Println("\n✓ 项目初始化完成!")
	fmt.Println("\n创建的文件:")
	fmt.Printf("  - %s/design.yaml\n", projectName)
	fmt.Printf("  - %s/events.jsonl\n", projectName)
	fmt.Printf("  - %s/snippets/worker_pool_example.go\n", projectName)
	fmt.Println("\n下一步:")
	fmt.Println("  1. 编辑 design.yaml 定义你的并发模型")
	fmt.Println("  2. 在 snippets 目录中添加相关代码片段")
	fmt.Println("  3. 运行 'concurrency-inspector analyze <project-name>' 进行分析")

	return nil
}
