package importer

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"queue-analyzer/pkg/models"

	"gopkg.in/yaml.v3"
)

type Importer struct {
}

func NewImporter() *Importer {
	return &Importer{}
}

func (i *Importer) ImportAll(jobsPath, workersPath, eventsPath, configPath string) (*models.ImportedData, error) {
	data := &models.ImportedData{
		Jobs:       make([]*models.Job, 0),
		Workers:    make([]*models.Worker, 0),
		Events:     make([]*models.QueueEvent, 0),
		QueueNames: make([]string, 0),
		JobTypes:   make([]string, 0),
	}

	queueSet := make(map[string]struct{})
	jobTypeSet := make(map[string]struct{})

	if jobsPath != "" {
		jobs, err := i.ImportJobs(jobsPath)
		if err != nil {
			return nil, fmt.Errorf("failed to import jobs: %w", err)
		}
		data.Jobs = jobs
		for _, job := range jobs {
			jobTypeSet[job.Type] = struct{}{}
		}
	}

	if workersPath != "" {
		workers, err := i.ImportWorkers(workersPath)
		if err != nil {
			return nil, fmt.Errorf("failed to import workers: %w", err)
		}
		data.Workers = workers
	}

	if eventsPath != "" {
		events, err := i.ImportEvents(eventsPath)
		if err != nil {
			return nil, fmt.Errorf("failed to import events: %w", err)
		}
		data.Events = events
		for _, event := range events {
			queueSet[event.QueueName] = struct{}{}
			jobTypeSet[event.JobType] = struct{}{}
		}
	}

	if configPath != "" {
		config, err := i.ImportConfig(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to import config: %w", err)
		}
		data.Config = config
		for _, q := range config.Queues {
			queueSet[q.Name] = struct{}{}
		}
	}

	for q := range queueSet {
		data.QueueNames = append(data.QueueNames, q)
	}
	for jt := range jobTypeSet {
		data.JobTypes = append(data.JobTypes, jt)
	}

	return data, nil
}

func (i *Importer) ImportJobs(path string) ([]*models.Job, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	jobs := make([]*models.Job, 0)
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var job models.Job
		if err := json.Unmarshal([]byte(line), &job); err != nil {
			return nil, fmt.Errorf("line %d: %w", lineNum, err)
		}

		if job.ID == "" {
			job.ID = fmt.Sprintf("job-auto-%d", lineNum)
		}

		if job.Status == "" {
			job.Status = models.JobStatusPending
		}

		if job.MaxRetries <= 0 {
			job.MaxRetries = 3
		}

		if job.TimeoutMs <= 0 {
			job.TimeoutMs = 30000
		}

		if job.StartTime != nil && job.EndTime != nil {
			job.ExecutionTimeMs = job.EndTime.Sub(*job.StartTime).Milliseconds()
		}

		if job.StartTime != nil {
			job.WaitTimeMs = job.StartTime.Sub(job.EnqueueTime).Milliseconds()
		}

		jobs = append(jobs, &job)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return jobs, nil
}

func (i *Importer) ImportWorkers(path string) ([]*models.Worker, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	if len(records) < 2 {
		return nil, fmt.Errorf("CSV file must have at least header and one data row")
	}

	header := records[0]
	headerMap := make(map[string]int)
	for idx, h := range header {
		headerMap[strings.ToLower(strings.TrimSpace(h))] = idx
	}

	workers := make([]*models.Worker, 0)

	for rowNum, record := range records[1:] {
		worker := &models.Worker{
			Status: models.WorkerStatusIdle,
		}

		if idx, ok := headerMap["id"]; ok && idx < len(record) {
			worker.ID = strings.TrimSpace(record[idx])
		}
		if worker.ID == "" {
			worker.ID = fmt.Sprintf("worker-auto-%d", rowNum+1)
		}

		if idx, ok := headerMap["name"]; ok && idx < len(record) {
			worker.Name = strings.TrimSpace(record[idx])
		}
		if worker.Name == "" {
			worker.Name = worker.ID
		}

		if idx, ok := headerMap["queue_types"]; ok && idx < len(record) {
			queueTypes := strings.TrimSpace(record[idx])
			if queueTypes != "" {
				worker.QueueTypes = strings.Split(queueTypes, ",")
				for i, qt := range worker.QueueTypes {
					worker.QueueTypes[i] = strings.TrimSpace(qt)
				}
			}
		}

		if idx, ok := headerMap["concurrency"]; ok && idx < len(record) {
			if val, err := strconv.Atoi(strings.TrimSpace(record[idx])); err == nil {
				worker.Concurrency = val
			}
		}
		if worker.Concurrency <= 0 {
			worker.Concurrency = 1
		}

		if idx, ok := headerMap["batch_size"]; ok && idx < len(record) {
			if val, err := strconv.Atoi(strings.TrimSpace(record[idx])); err == nil {
				worker.BatchSize = val
			}
		}
		if worker.BatchSize <= 0 {
			worker.BatchSize = 1
		}

		if idx, ok := headerMap["poll_interval"]; ok && idx < len(record) {
			if val, err := time.ParseDuration(strings.TrimSpace(record[idx])); err == nil {
				worker.PollInterval = val
			}
		}
		if worker.PollInterval <= 0 {
			worker.PollInterval = 1 * time.Second
		}

		if idx, ok := headerMap["status"]; ok && idx < len(record) {
			status := strings.ToLower(strings.TrimSpace(record[idx]))
			switch status {
			case "idle":
				worker.Status = models.WorkerStatusIdle
			case "busy":
				worker.Status = models.WorkerStatusBusy
			case "blocked":
				worker.Status = models.WorkerStatusBlocked
			case "error":
				worker.Status = models.WorkerStatusError
			}
		}

		if idx, ok := headerMap["created_at"]; ok && idx < len(record) {
			if t, err := parseTime(strings.TrimSpace(record[idx])); err == nil {
				worker.CreatedAt = t
			}
		}

		if idx, ok := headerMap["updated_at"]; ok && idx < len(record) {
			if t, err := parseTime(strings.TrimSpace(record[idx])); err == nil {
				worker.UpdatedAt = t
			}
		}

		workers = append(workers, worker)
	}

	return workers, nil
}

func (i *Importer) ImportEvents(path string) ([]*models.QueueEvent, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	events := make([]*models.QueueEvent, 0)
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var event models.QueueEvent
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			return nil, fmt.Errorf("line %d: %w", lineNum, err)
		}

		if event.ID == "" {
			event.ID = fmt.Sprintf("event-auto-%d", lineNum)
		}

		if event.Timestamp.IsZero() {
			event.Timestamp = time.Now()
		}

		events = append(events, &event)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return events, nil
}

func (i *Importer) ImportConfig(path string) (*models.FullConfig, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var config models.FullConfig
	decoder := yaml.NewDecoder(file)
	if err := decoder.Decode(&config); err != nil {
		return nil, err
	}

	if config.Version == "" {
		config.Version = "1.0"
	}

	if config.Name == "" {
		config.Name = "default-config"
	}

	return &config, nil
}

func parseTime(s string) (time.Time, error) {
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
		"2006/01/02 15:04:05",
		"2006/01/02T15:04:05",
		"2006/01/02",
		"02-01-2006 15:04:05",
		"02/01/2006 15:04:05",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, s); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse time: %s", s)
}
