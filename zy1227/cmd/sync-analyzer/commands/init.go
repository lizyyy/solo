package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/yourteam/sync-analyzer/internal/storage"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize the sync-analyzer workspace and database",
	Long: `Initialize the sync-analyzer workspace by creating the necessary directories
and initializing the SQLite database. This command should be run once before
using any other commands.`,
	Run: func(cmd *cobra.Command, args []string) {
		workspace, _ := cmd.Flags().GetString("workspace")
		dbPath, _ := cmd.Flags().GetString("db")

		// 如果没有指定数据库路径，使用默认路径
		if dbPath == "" {
			if workspace == "" {
				workspace = "."
			}
			dbPath = filepath.Join(workspace, "sync-analyzer.db")
		}

		// 创建工作空间目录
		if workspace != "" {
			if err := os.MkdirAll(workspace, 0755); err != nil {
				fmt.Printf("Error creating workspace directory: %v\n", err)
				os.Exit(1)
			}
		}

		// 创建 snippets 目录
		snippetsDir := filepath.Join(workspace, "snippets")
		if err := os.MkdirAll(snippetsDir, 0755); err != nil {
			fmt.Printf("Error creating snippets directory: %v\n", err)
			os.Exit(1)
		}

		// 初始化数据库
		fmt.Printf("Initializing database at %s...\n", dbPath)
		store, err := storage.NewSQLiteStore(dbPath)
		if err != nil {
			fmt.Printf("Error creating database: %v\n", err)
			os.Exit(1)
		}
		defer store.Close()

		if err := store.Init(); err != nil {
			fmt.Printf("Error initializing database schema: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("✓ Database initialized successfully")
		fmt.Println("✓ Workspace structure created")
		fmt.Println()
		fmt.Println("Next steps:")
		fmt.Printf("  1. Add your cases to %s/sync-cases.yaml\n", workspace)
		fmt.Printf("  2. Add event logs to %s/events.jsonl\n", workspace)
		fmt.Printf("  3. Add Go code snippets to %s/snippets/\n", snippetsDir)
		fmt.Printf("  4. Run 'sync-analyzer analyze' to perform analysis\n")
	},
}

func init() {
	initCmd.Flags().StringP("workspace", "w", ".", "Path to the workspace directory")
	initCmd.Flags().StringP("db", "d", "", "Path to the SQLite database file (default: workspace/sync-analyzer.db)")
}
