package service

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type ExportService struct {
	taskService *TaskService
}

func NewExportService() *ExportService {
	return &ExportService{
		taskService: NewTaskService(),
	}
}

type EvidencePackage struct {
	TaskID     string      `json:"task_id"`
	ExportedAt time.Time   `json:"exported_at"`
	Version    string      `json:"version"`
	Data       interface{} `json:"data"`
}

func (s *ExportService) ExportTaskEvidence(taskID string) ([]byte, string, error) {
	data, err := s.taskService.GetTaskFullData(taskID)
	if err != nil {
		return nil, "", err
	}

	pkg := EvidencePackage{
		TaskID:     taskID,
		ExportedAt: time.Now(),
		Version:    "1.0",
		Data:       data,
	}

	jsonData, err := json.MarshalIndent(pkg, "", "  ")
	if err != nil {
		return nil, "", err
	}

	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	taskInfo := data["task"]
	taskJSON, _ := json.MarshalIndent(taskInfo, "", "  ")
	s.addFileToZip(zipWriter, "task.json", taskJSON)

	networkResults := data["network_results"]
	networkJSON, _ := json.MarshalIndent(networkResults, "", "  ")
	s.addFileToZip(zipWriter, "network_results.json", networkJSON)

	dnsRecords := data["dns_records"]
	dnsJSON, _ := json.MarshalIndent(dnsRecords, "", "  ")
	s.addFileToZip(zipWriter, "dns_records.json", dnsJSON)

	conclusion := data["conclusion"]
	conclusionJSON, _ := json.MarshalIndent(conclusion, "", "  ")
	s.addFileToZip(zipWriter, "conclusion.json", conclusionJSON)

	s.addFileToZip(zipWriter, "evidence_package.json", jsonData)

	s.addFileToZip(zipWriter, "README.txt", []byte(`
客户探针证据包
==============

包含文件：
- task.json: 任务基本信息
- network_results.json: 网络探测结果
- dns_records.json: DNS解析记录
- conclusion.json: 诊断结论
- evidence_package.json: 完整数据包

导出时间: `+time.Now().Format(time.RFC3339)+`
版本: 1.0
`))

	err = zipWriter.Close()
	if err != nil {
		return nil, "", err
	}

	filename := fmt.Sprintf("probe_evidence_%s_%s.zip", taskID, time.Now().Format("20060102_150405"))
	return buf.Bytes(), filename, nil
}

func (s *ExportService) addFileToZip(zipWriter *zip.Writer, filename string, content []byte) error {
	fileWriter, err := zipWriter.Create(filename)
	if err != nil {
		return err
	}
	_, err = fileWriter.Write(content)
	return err
}

func (s *ExportService) SaveToFile(taskID, outputDir string) (string, error) {
	data, filename, err := s.ExportTaskEvidence(taskID)
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", err
	}

	filepath := filepath.Join(outputDir, filename)
	err = os.WriteFile(filepath, data, 0644)
	if err != nil {
		return "", err
	}

	return filepath, nil
}

func (s *ExportService) ExportHistory(envID string, startTime, endTime time.Time) ([]byte, string, error) {
	tasks, err := s.taskService.GetTaskHistory(envID, startTime, endTime)
	if err != nil {
		return nil, "", err
	}

	fullData := make([]map[string]interface{}, 0, len(tasks))
	for _, task := range tasks {
		data, _ := s.taskService.GetTaskFullData(task.ID)
		fullData = append(fullData, data)
	}

	historyPkg := map[string]interface{}{
		"env_id":      envID,
		"start_time":  startTime,
		"end_time":    endTime,
		"exported_at": time.Now(),
		"tasks":       fullData,
		"count":       len(tasks),
	}

	jsonData, err := json.MarshalIndent(historyPkg, "", "  ")
	if err != nil {
		return nil, "", err
	}

	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	s.addFileToZip(zipWriter, "history.json", jsonData)

	for i, data := range fullData {
		task := tasks[i]
		prefix := fmt.Sprintf("task_%s/", task.ID)

		taskJSON, _ := json.MarshalIndent(data["task"], "", "  ")
		s.addFileToZip(zipWriter, prefix+"task.json", taskJSON)

		networkJSON, _ := json.MarshalIndent(data["network_results"], "", "  ")
		s.addFileToZip(zipWriter, prefix+"network_results.json", networkJSON)

		dnsJSON, _ := json.MarshalIndent(data["dns_records"], "", "  ")
		s.addFileToZip(zipWriter, prefix+"dns_records.json", dnsJSON)

		conclusionJSON, _ := json.MarshalIndent(data["conclusion"], "", "  ")
		s.addFileToZip(zipWriter, prefix+"conclusion.json", conclusionJSON)
	}

	s.addFileToZip(zipWriter, "README.txt", []byte(`
客户探针历史证据包
==================

环境ID: `+envID+`
时间范围: `+startTime.Format(time.RFC3339)+` 至 `+endTime.Format(time.RFC3339)+`
任务数量: `+fmt.Sprintf("%d", len(tasks))+`

导出时间: `+time.Now().Format(time.RFC3339)+`
版本: 1.0
`))

	err = zipWriter.Close()
	if err != nil {
		return nil, "", err
	}

	filename := fmt.Sprintf("probe_history_%s_%s.zip", envID, time.Now().Format("20060102_150405"))
	return buf.Bytes(), filename, nil
}
