package parser

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"

	"github.com/zy1221/slice-teacher/internal/errors"
	"github.com/zy1221/slice-teacher/internal/model"
)

func ParseOpsJSONL(filename string) ([]*model.Operation, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, errors.NewIOError("无法打开文件", filename, err)
	}
	defer file.Close()

	var operations []*model.Operation
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		if line == "" {
			continue
		}

		var op model.Operation
		err := json.Unmarshal([]byte(line), &op)
		if err != nil {
			return nil, errors.NewParseError(
				fmt.Sprintf("JSON 解析失败: %v", err),
				filename,
				lineNum,
				"请检查 JSON 格式是否正确，每行应该是一个独立的 JSON 对象",
				err,
			)
		}

		if op.Type == "" {
			return nil, errors.NewValidationError(
				fmt.Sprintf("第 %d 行的操作没有定义 type 字段", lineNum),
				filename,
				"每个 JSON 对象必须包含 type 字段",
			)
		}

		if op.ID == "" {
			op.ID = fmt.Sprintf("op_%02d", lineNum)
		}

		operations = append(operations, &op)
	}

	if err := scanner.Err(); err != nil {
		return nil, errors.NewIOError("读取文件失败", filename, err)
	}

	if len(operations) == 0 {
		return nil, errors.NewValidationError(
			"JSONL 文件中没有任何操作",
			filename,
			"请添加至少一行有效的操作定义",
		)
	}

	return operations, nil
}
