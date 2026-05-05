package parser

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"

	"github.com/zy1221/slice-teacher/internal/errors"
	"github.com/zy1221/slice-teacher/internal/model"
)

func ParseSliceCases(filename string) (*model.CaseFile, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, errors.NewIOError("无法读取文件", filename, err)
	}

	var caseFile model.CaseFile
	err = yaml.Unmarshal(data, &caseFile)
	if err != nil {
		return nil, errors.NewParseError(
			"YAML 解析失败",
			filename,
			0,
			"请检查 YAML 格式是否正确，特别是缩进和冒号后面的空格",
			err,
		)
	}

	if err := validateCaseFile(&caseFile, filename); err != nil {
		return nil, err
	}

	assignDefaultIDs(&caseFile)

	return &caseFile, nil
}

func validateCaseFile(caseFile *model.CaseFile, filename string) error {
	if len(caseFile.Cases) == 0 {
		return errors.NewValidationError(
			"配置文件中没有定义任何 case",
			filename,
			"请在 cases 数组中添加至少一个测试用例",
		)
	}

	for i, c := range caseFile.Cases {
		if c.Name == "" {
			return errors.NewValidationError(
				fmt.Sprintf("第 %d 个 case 没有定义 name", i+1),
				filename,
				"请为每个 case 添加 name 字段",
			)
		}

		if len(c.Operations) == 0 {
			return errors.NewValidationError(
				fmt.Sprintf("case '%s' 没有定义任何操作", c.Name),
				filename,
				"请在 operations 数组中添加至少一个操作",
			)
		}

		for j, op := range c.Operations {
			if op.Type == "" {
				return errors.NewValidationError(
					fmt.Sprintf("case '%s' 中第 %d 个操作没有定义 type", c.Name, j+1),
					filename,
					"支持的操作类型: make, slice, full_slice, append, copy, delete, filter, func_pass_by_value, func_pass_by_ref, modify_element",
				)
			}

			if !isValidOpType(op.Type) {
				return errors.NewValidationError(
					fmt.Sprintf("case '%s' 中第 %d 个操作的 type '%s' 不合法", c.Name, j+1, op.Type),
					filename,
					"支持的操作类型: make, slice, full_slice, append, copy, delete, filter, func_pass_by_value, func_pass_by_ref, modify_element",
				)
			}
		}
	}

	return nil
}

func isValidOpType(opType model.OpType) bool {
	validTypes := []model.OpType{
		model.OpMake,
		model.OpSlice,
		model.OpFullSlice,
		model.OpAppend,
		model.OpCopy,
		model.OpDelete,
		model.OpFilter,
		model.OpFuncPassByValue,
		model.OpFuncPassByRef,
		model.OpModifyElement,
	}

	for _, t := range validTypes {
		if t == opType {
			return true
		}
	}
	return false
}

func assignDefaultIDs(caseFile *model.CaseFile) {
	for i, c := range caseFile.Cases {
		if c.ID == "" {
			c.ID = fmt.Sprintf("case_%02d", i+1)
		}

		for j, op := range c.Operations {
			if op.ID == "" {
				op.ID = fmt.Sprintf("%s_op_%02d", c.ID, j+1)
			}
		}
	}
}
