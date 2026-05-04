package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"capgate/internal/config"
	"capgate/internal/models"
	"capgate/internal/reporter"
)

type APIServer struct {
	resultsDir string
	port       int
}

func NewAPIServer(resultsDir string, port int) *APIServer {
	if resultsDir == "" {
		resultsDir = "./results"
	}
	return &APIServer{
		resultsDir: resultsDir,
		port:       port,
	}
}

func (s *APIServer) Start() error {
	mux := http.NewServeMux()

	mux.HandleFunc("/", s.handleIndex)
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/results", s.handleResults)
	mux.HandleFunc("/api/results/", s.handleResultDetail)
	mux.HandleFunc("/api/comparisons", s.handleComparisons)
	mux.HandleFunc("/api/comparisons/", s.handleComparisonDetail)
	mux.HandleFunc("/api/export/", s.handleExport)

	fmt.Printf("🚀 启动 API 服务: http://localhost:%d\n", s.port)
	fmt.Printf("   结果目录: %s\n", s.resultsDir)
	fmt.Println("\n可用端点:")
	fmt.Println("  GET  /                    主页")
	fmt.Println("  GET  /api/health         健康检查")
	fmt.Println("  GET  /api/results        结果列表")
	fmt.Println("  GET  /api/results/{id}   结果详情")
	fmt.Println("  GET  /api/comparisons    对比列表")
	fmt.Println("  GET  /api/comparisons/{id} 对比详情")
	fmt.Println("  GET  /api/export/{id}?format=md|json|csv 导出报告")

	return http.ListenAndServe(fmt.Sprintf(":%d", s.port), mux)
}

func (s *APIServer) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "text/html")
	html := `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>CapGate - 容量闸门服务</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
        h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
        .endpoint { background: #f5f5f5; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
        .method { display: inline-block; background: #007acc; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; }
        .status-pass { background: #d4edda; color: #155724; }
        .status-warning { background: #fff3cd; color: #856404; }
        .status-fail { background: #f8d7da; color: #721c24; }
        ul { line-height: 1.8; }
        code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>🚪 CapGate - 容量闸门服务</h1>
    <p>上线前接口压测容量评估工具的本地 API 服务</p>
    
    <h2>📋 可用端点</h2>
    <div class="endpoint"><span class="method">GET</span><code>/api/health</code> - 健康检查</div>
    <div class="endpoint"><span class="method">GET</span><code>/api/results</code> - 结果列表</div>
    <div class="endpoint"><span class="method">GET</span><code>/api/results/{id}</code> - 结果详情</div>
    <div class="endpoint"><span class="method">GET</span><code>/api/comparisons</code> - 对比列表</div>
    <div class="endpoint"><span class="method">GET</span><code>/api/comparisons/{id}</code> - 对比详情</div>
    <div class="endpoint"><span class="method">GET</span><code>/api/export/{id}?format=md|json|csv</code> - 导出报告</div>

    <h2>💡 使用说明</h2>
    <ul>
        <li>结果目录: <code>` + s.resultsDir + `</code></li>
        <li>先运行 <code>capgate run</code> 生成压测结果</li>
        <li>再运行 <code>capgate compare</code> 生成对比分析</li>
        <li>通过 API 查看和导出报告</li>
    </ul>
</body>
</html>
`
	fmt.Fprint(w, html)
}

func (s *APIServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"status":     "healthy",
		"timestamp":  time.Now().Unix(),
		"resultsDir": s.resultsDir,
	}
	json.NewEncoder(w).Encode(response)
}

func (s *APIServer) handleResults(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	results, err := s.listResultFiles("*result.json")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":   len(results),
		"results": results,
	})
}

func (s *APIServer) handleResultDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/results/")
	if id == "" {
		http.Error(w, "Missing result ID", http.StatusBadRequest)
		return
	}

	result, err := s.loadResultByID(id, "result.json")
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "Result not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *APIServer) handleComparisons(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	results, err := s.listResultFiles("*comparison.json")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":       len(results),
		"comparisons": results,
	})
}

func (s *APIServer) handleComparisonDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/comparisons/")
	if id == "" {
		http.Error(w, "Missing comparison ID", http.StatusBadRequest)
		return
	}

	result, err := s.loadComparisonByID(id)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "Comparison not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *APIServer) handleExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/export/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "Missing export ID", http.StatusBadRequest)
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	isComparison := len(parts) > 1 && parts[1] == "comparison"

	var runResult *models.RunResult
	var compResult *models.ComparisonResult
	var err error

	if isComparison {
		compResult, err = s.loadComparisonByID(parts[0])
	} else {
		runResult, err = s.loadResultByID(parts[0], "result.json")
	}

	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "Resource not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	generator := reporter.NewGenerator(runResult, compResult)

	switch format {
	case "md":
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.md", parts[0]))
		content := generator.GenerateMarkdown()
		fmt.Fprint(w, content)

	case "csv":
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.csv", parts[0]))
		records := generator.GenerateCSV()
		for _, row := range records {
			fmt.Fprintln(w, strings.Join(row, ","))
		}

	default:
		w.Header().Set("Content-Type", "application/json")
		content, err := generator.GenerateJSON()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		fmt.Fprint(w, content)
	}
}

func (s *APIServer) listResultFiles(pattern string) ([]map[string]interface{}, error) {
	files, err := filepath.Glob(filepath.Join(s.resultsDir, pattern))
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	for _, file := range files {
		info, err := os.Stat(file)
		if err != nil {
			continue
		}

		name := filepath.Base(file)
		id := strings.TrimSuffix(name, filepath.Ext(name))
		id = strings.TrimSuffix(id, "-result")
		id = strings.TrimSuffix(id, "-comparison")

		results = append(results, map[string]interface{}{
			"id":         id,
			"name":       name,
			"path":       file,
			"size":       info.Size(),
			"modifiedAt": info.ModTime().Unix(),
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i]["modifiedAt"].(int64) > results[j]["modifiedAt"].(int64)
	})

	return results, nil
}

func (s *APIServer) loadResultByID(id, suffix string) (*models.RunResult, error) {
	path := filepath.Join(s.resultsDir, fmt.Sprintf("%s-%s", id, suffix))
	return config.LoadRunResult(path)
}

func (s *APIServer) loadComparisonByID(id string) (*models.ComparisonResult, error) {
	path := filepath.Join(s.resultsDir, fmt.Sprintf("%s-comparison.json", id))
	return config.LoadComparisonResult(path)
}
