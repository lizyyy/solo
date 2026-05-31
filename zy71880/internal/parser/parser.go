package parser

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"freefall-grading/internal/model"
)

type ParsedData struct {
	StudentID    string
	StudentName  string
	ExperimentNo string
	GroupNo      string
	SamplingRate float64
	SensorID     string
	RawData      []*model.RawSensorData
}

type CalibrationData struct {
	SensorID     string
	CalibratedAt time.Time
	ZeroPoint    float64
	Sensitivity  float64
	Temperature  float64
	Operator     string
}

func ParseSensorLog(filename string) (*ParsedData, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(filename))
	if ext == ".csv" {
		return parseCSV(filename)
	}
	return parseTextLog(file, filename)
}

func parseCSV(filename string) (*ParsedData, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1

	var records [][]string
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}
		records = append(records, row)
	}

	result := &ParsedData{
		ExperimentNo: "EXP-001",
		SamplingRate: 100.0,
	}

	dataStartRow := 0
	for i, row := range records {
		if len(row) < 2 {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(row[0]))
		if strings.Contains(key, "student") || strings.Contains(key, "学号") {
			if len(row) > 1 {
				result.StudentID = strings.TrimSpace(row[1])
			}
		} else if strings.Contains(key, "name") || strings.Contains(key, "姓名") {
			if len(row) > 1 {
				result.StudentName = strings.TrimSpace(row[1])
			}
		} else if strings.Contains(key, "group") || strings.Contains(key, "组号") {
			if len(row) > 1 {
				result.GroupNo = strings.TrimSpace(row[1])
			}
		} else if strings.Contains(key, "experiment") || strings.Contains(key, "实验") {
			if len(row) > 1 {
				result.ExperimentNo = strings.TrimSpace(row[1])
			}
		} else if strings.Contains(key, "rate") || strings.Contains(key, "采样率") {
			if len(row) > 1 {
				if rate, err := strconv.ParseFloat(strings.TrimSpace(row[1]), 64); err == nil {
					result.SamplingRate = rate
				}
			}
		} else if strings.Contains(key, "sensor") || strings.Contains(key, "传感器") {
			if len(row) > 1 {
				result.SensorID = strings.TrimSpace(row[1])
			}
		} else if strings.Contains(key, "time") || strings.Contains(key, "timestamp") || key == "t" || strings.Contains(key, "时间") {
			dataStartRow = i + 1
			break
		}
	}

	for i := dataStartRow; i < len(records); i++ {
		row := records[i]
		if len(row) < 4 {
			continue
		}

		timestamp, err := strconv.ParseFloat(strings.TrimSpace(row[0]), 64)
		if err != nil {
			continue
		}

		ax, err1 := strconv.ParseFloat(strings.TrimSpace(row[1]), 64)
		ay, err2 := strconv.ParseFloat(strings.TrimSpace(row[2]), 64)
		az, err3 := strconv.ParseFloat(strings.TrimSpace(row[3]), 64)
		if err1 != nil || err2 != nil || err3 != nil {
			continue
		}

		result.RawData = append(result.RawData, &model.RawSensorData{
			Timestamp: timestamp,
			AccelX:    ax,
			AccelY:    ay,
			AccelZ:    az,
		})
	}

	if result.StudentID == "" {
		base := filepath.Base(filename)
		result.StudentID = strings.TrimSuffix(base, filepath.Ext(base))
	}

	return result, nil
}

func parseTextLog(file *os.File, filename string) (*ParsedData, error) {
	scanner := bufio.NewScanner(file)
	result := &ParsedData{
		ExperimentNo: "EXP-001",
		SamplingRate: 100.0,
	}

	inDataSection := false
	lineNum := 0

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		lineNum++

		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "//") {
			continue
		}

		if !inDataSection {
			if strings.Contains(strings.ToLower(line), "time") ||
				strings.Contains(strings.ToLower(line), "timestamp") ||
				strings.Contains(line, "时间") {
				inDataSection = true
				continue
			}

			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				key := strings.ToLower(strings.TrimSpace(parts[0]))
				value := strings.TrimSpace(parts[1])

				switch key {
				case "student_id", "sid", "学号", "学生id":
					result.StudentID = value
				case "name", "student_name", "姓名":
					result.StudentName = value
				case "group", "group_no", "组号", "小组":
					result.GroupNo = value
				case "experiment", "exp_no", "实验编号":
					result.ExperimentNo = value
				case "rate", "sampling_rate", "采样率":
					if rate, err := strconv.ParseFloat(value, 64); err == nil {
						result.SamplingRate = rate
					}
				case "sensor_id", "sensor", "传感器":
					result.SensorID = value
				}
			}
		} else {
			fields := strings.Fields(line)
			if len(fields) < 4 {
				continue
			}

			timestamp, err := strconv.ParseFloat(fields[0], 64)
			if err != nil {
				continue
			}

			ax, err1 := strconv.ParseFloat(fields[1], 64)
			ay, err2 := strconv.ParseFloat(fields[2], 64)
			az, err3 := strconv.ParseFloat(fields[3], 64)
			if err1 != nil || err2 != nil || err3 != nil {
				continue
			}

			result.RawData = append(result.RawData, &model.RawSensorData{
				Timestamp: timestamp,
				AccelX:    ax,
				AccelY:    ay,
				AccelZ:    az,
			})
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	if result.StudentID == "" {
		base := filepath.Base(filename)
		result.StudentID = strings.TrimSuffix(base, filepath.Ext(base))
	}

	return result, nil
}

func ParseCalibration(filename string) (*CalibrationData, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data := &CalibrationData{}

	ext := strings.ToLower(filepath.Ext(filename))
	if ext == ".csv" {
		reader := csv.NewReader(file)
		reader.FieldsPerRecord = -1

		var records [][]string
		for {
			row, err := reader.Read()
			if err == io.EOF {
				break
			}
			if err != nil {
				continue
			}
			records = append(records, row)
		}

		for i, row := range records {
			if i == 0 {
				continue
			}
			if len(row) >= 4 {
				data.SensorID = strings.TrimSpace(row[0])
				if t, err := time.Parse("2006-01-02 15:04:05", strings.TrimSpace(row[1])); err == nil {
					data.CalibratedAt = t
				} else {
					data.CalibratedAt = time.Now()
				}
				if zp, err := strconv.ParseFloat(strings.TrimSpace(row[2]), 64); err == nil {
					data.ZeroPoint = zp
				}
				if sens, err := strconv.ParseFloat(strings.TrimSpace(row[3]), 64); err == nil {
					data.Sensitivity = sens
				}
				if len(row) >= 5 {
					if temp, err := strconv.ParseFloat(strings.TrimSpace(row[4]), 64); err == nil {
						data.Temperature = temp
					}
				}
				if len(row) >= 6 {
					data.Operator = strings.TrimSpace(row[5])
				}
				break
			}
		}
	} else {
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}

			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				key := strings.ToLower(strings.TrimSpace(parts[0]))
				value := strings.TrimSpace(parts[1])

				switch key {
				case "sensor_id", "sensor":
					data.SensorID = value
				case "date", "calibrated_at", "标定日期":
					if t, err := time.Parse("2006-01-02 15:04:05", value); err == nil {
						data.CalibratedAt = t
					} else if t, err := time.Parse("2006-01-02", value); err == nil {
						data.CalibratedAt = t
					} else {
						data.CalibratedAt = time.Now()
					}
				case "zero_point", "zero", "零点":
					if zp, err := strconv.ParseFloat(value, 64); err == nil {
						data.ZeroPoint = zp
					}
				case "sensitivity", "灵敏度":
					if sens, err := strconv.ParseFloat(value, 64); err == nil {
						data.Sensitivity = sens
					}
				case "temperature", "temp", "温度":
					if temp, err := strconv.ParseFloat(value, 64); err == nil {
						data.Temperature = temp
					}
				case "operator", "标定人":
					data.Operator = value
				}
			}
		}
	}

	if data.SensorID == "" {
		return nil, fmt.Errorf("未找到传感器ID")
	}
	if data.CalibratedAt.IsZero() {
		data.CalibratedAt = time.Now()
	}

	return data, nil
}

func BatchParseSensorLogs(directory string) ([]*ParsedData, []string, error) {
	files, err := os.ReadDir(directory)
	if err != nil {
		return nil, nil, err
	}

	var results []*ParsedData
	var errors []string

	for _, f := range files {
		if f.IsDir() {
			continue
		}

		ext := strings.ToLower(filepath.Ext(f.Name()))
		if ext != ".csv" && ext != ".txt" && ext != ".log" {
			continue
		}

		fullPath := filepath.Join(directory, f.Name())
		data, err := ParseSensorLog(fullPath)
		if err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", f.Name(), err))
			continue
		}
		results = append(results, data)
	}

	return results, errors, nil
}

func GetFilenames(directory string) ([]string, error) {
	var filenames []string
	err := filepath.Walk(directory, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			ext := strings.ToLower(filepath.Ext(info.Name()))
			if ext == ".csv" || ext == ".txt" || ext == ".log" {
				filenames = append(filenames, path)
			}
		}
		return nil
	})
	return filenames, err
}

func ParseSensorLogWithFilename(filename string) (*ParsedData, string, error) {
	data, err := ParseSensorLog(filename)
	if err != nil {
		return nil, "", err
	}
	return data, filename, nil
}
