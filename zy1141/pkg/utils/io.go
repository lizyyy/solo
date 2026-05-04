package utils

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

func ReadYAML(filePath string, out interface{}) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("读取文件失败: %w", err)
	}

	if err := yaml.Unmarshal(data, out); err != nil {
		return fmt.Errorf("解析 YAML 失败: %w", err)
	}

	return nil
}

func WriteYAML(filePath string, in interface{}) error {
	data, err := yaml.Marshal(in)
	if err != nil {
		return fmt.Errorf("序列化 YAML 失败: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}

	return nil
}

func ReadJSON(filePath string, out interface{}) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("读取文件失败: %w", err)
	}

	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("解析 JSON 失败: %w", err)
	}

	return nil
}

func WriteJSON(filePath string, in interface{}, pretty bool) error {
	var data []byte
	var err error

	if pretty {
		data, err = json.MarshalIndent(in, "", "  ")
	} else {
		data, err = json.Marshal(in)
	}

	if err != nil {
		return fmt.Errorf("序列化 JSON 失败: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}

	return nil
}

func ReadJSONL(filePath string) ([]map[string]interface{}, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer file.Close()

	var results []map[string]interface{}
	decoder := json.NewDecoder(file)

	for {
		var item map[string]interface{}
		if err := decoder.Decode(&item); err == io.EOF {
			break
		} else if err != nil {
			return nil, fmt.Errorf("解析 JSONL 失败: %w", err)
		}
		results = append(results, item)
	}

	return results, nil
}

func ReadCSV(filePath string) ([][]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("解析 CSV 失败: %w", err)
	}

	return records, nil
}

func WriteCSV(filePath string, records [][]string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	if err := writer.WriteAll(records); err != nil {
		return fmt.Errorf("写入 CSV 失败: %w", err)
	}

	return nil
}

func FileExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

func DirExists(dirPath string) bool {
	info, err := os.Stat(dirPath)
	if err != nil {
		return false
	}
	return info.IsDir()
}

func EnsureDir(dirPath string) error {
	if DirExists(dirPath) {
		return nil
	}
	if err := os.MkdirAll(dirPath, 0755); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}
	return nil
}

func ListFiles(dirPath string, extension string) ([]string, error) {
	var files []string

	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if extension == "" || strings.HasSuffix(strings.ToLower(path), strings.ToLower(extension)) {
			files = append(files, path)
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("遍历目录失败: %w", err)
	}

	return files, nil
}

func Timestamp() string {
	return time.Now().Format("2006-01-02T15:04:05-07:00")
}

func GenerateID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func Contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func Unique(slice []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, s := range slice {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}
	return result
}

func ParseYAMLWithLineNumber(filePath string) ([]byte, error) {
	return os.ReadFile(filePath)
}

func GetYAMLLineNumber(rawData []byte, fieldPath string) int {
	lines := strings.Split(string(rawData), "\n")
	parts := strings.Split(fieldPath, ".")

	for i, line := range lines {
		for _, part := range parts {
			if strings.Contains(line, part+":") {
				if strings.HasPrefix(line, part+":") {
					return i + 1
				}
			}
		}
	}
	return 0
}

func MarshalJSONLine(v interface{}) (string, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
