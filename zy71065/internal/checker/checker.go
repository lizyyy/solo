package checker

import (
	"fmt"

	"proto-enum-lint/pkg/types"
)

type Checker struct {
	files []types.ProtoFile
}

func NewChecker(files []types.ProtoFile) *Checker {
	return &Checker{files: files}
}

func (c *Checker) Check() []types.Issue {
	var issues []types.Issue

	for _, pf := range c.files {
		for _, enum := range pf.Enums {
			issues = append(issues, c.checkEnum(enum)...)
		}
	}

	return issues
}

func (c *Checker) checkEnum(enum types.Enum) []types.Issue {
	var issues []types.Issue

	issues = append(issues, c.checkDuplicateNumbers(enum)...)
	issues = append(issues, c.checkReservedViolations(enum)...)
	issues = append(issues, c.checkAliasMisuse(enum)...)

	return issues
}

func (c *Checker) checkDuplicateNumbers(enum types.Enum) []types.Issue {
	var issues []types.Issue
	numberMap := make(map[int32][]string)

	for _, ev := range enum.Values {
		numberMap[ev.Number] = append(numberMap[ev.Number], ev.Name)
	}

	for num, names := range numberMap {
		if len(names) > 1 {
			hasAllowAlias := false
			for _, ev := range enum.Values {
				if ev.Number == num && ev.IsAlias {
					hasAllowAlias = true
					break
				}
			}

			if !hasAllowAlias {
				issues = append(issues, types.Issue{
					Type:     types.IssueDuplicateNumber,
					Severity: types.SeverityError,
					Message: fmt.Sprintf("枚举值编号 %d 被重复使用: %v (未启用 allow_alias)",
						num, names),
					FilePath: enum.FilePath,
					EnumName: enum.FullName,
					Number:   num,
					Details: fmt.Sprintf("同一编号被多个枚举值使用: %v。"+
						"如果这是故意的别名，请在枚举中添加 'option allow_alias = true;'；"+
						"否则请修改编号以保持唯一性。", names),
					ExitCode: types.ExitCodeBreakingChange,
				})
			}
		}
	}

	return issues
}

func (c *Checker) checkReservedViolations(enum types.Enum) []types.Issue {
	var issues []types.Issue

	for _, ev := range enum.Values {
		if isNumberReserved(ev.Number, enum.Reserved) {
			issues = append(issues, types.Issue{
				Type:     types.IssueReservedViolation,
				Severity: types.SeverityError,
				Message: fmt.Sprintf("枚举值 '%s' 使用了保留编号 %d",
					ev.Name, ev.Number),
				FilePath: enum.FilePath,
				EnumName: enum.FullName,
				ValueName: ev.Name,
				Number:    ev.Number,
				Details: fmt.Sprintf("编号 %d 已被声明为 reserved，不能被枚举值 '%s' 使用。"+
					"reserved 编号用于防止未来复用已删除的枚举值编号。",
					ev.Number, ev.Name),
				ExitCode: types.ExitCodeBreakingChange,
			})
		}

		if isNameReserved(ev.Name, enum.Reserved) {
			issues = append(issues, types.Issue{
				Type:     types.IssueReservedViolation,
				Severity: types.SeverityError,
				Message: fmt.Sprintf("枚举值名称 '%s' 已被保留", ev.Name),
				FilePath: enum.FilePath,
				EnumName: enum.FullName,
				ValueName: ev.Name,
				Details: fmt.Sprintf("名称 '%s' 已被声明为 reserved，不能被使用。"+
					"reserved 名称用于防止未来复用已删除的枚举值名称。",
					ev.Name),
				ExitCode: types.ExitCodeBreakingChange,
			})
		}
	}

	return issues
}

func isNumberReserved(num int32, reserved []types.Reserved) bool {
	for _, r := range reserved {
		if r.IsByName {
			continue
		}
		if r.IsRange {
			if num >= r.Start && num <= r.End {
				return true
			}
		} else {
			if num == r.Value {
				return true
			}
		}
	}
	return false
}

func isNameReserved(name string, reserved []types.Reserved) bool {
	for _, r := range reserved {
		if r.IsByName && r.Name == name {
			return true
		}
	}
	return false
}

func (c *Checker) checkAliasMisuse(enum types.Enum) []types.Issue {
	var issues []types.Issue

	numberMap := make(map[int32][]types.EnumValue)
	for _, ev := range enum.Values {
		numberMap[ev.Number] = append(numberMap[ev.Number], ev)
	}

	for num, values := range numberMap {
		if len(values) <= 1 {
			continue
		}

		allHaveAlias := true
		for _, ev := range values {
			if !ev.IsAlias {
				allHaveAlias = false
				break
			}
		}

		if len(values) > 1 && !allHaveAlias {
			issues = append(issues, types.Issue{
				Type:     types.IssueAliasMisuse,
				Severity: types.SeverityWarning,
				Message: fmt.Sprintf("枚举编号 %d 有多个值，但部分未正确标记为别名", num),
				FilePath: enum.FilePath,
				EnumName: enum.FullName,
				Number:   num,
				Details: fmt.Sprintf("编号 %d 有多个枚举值: %v。"+
					"使用别名时，应在枚举级别添加 'option allow_alias = true;'，"+
					"并且第一个值（非别名）应作为主要值，后续值作为别名。",
					num, getValueNames(values)),
				ExitCode: types.ExitCodeSuccess,
			})
		}
	}

	return issues
}

func getValueNames(values []types.EnumValue) []string {
	names := make([]string, len(values))
	for i, v := range values {
		names[i] = v.Name
	}
	return names
}

func FindRemovedEnums(oldFiles, newFiles []types.ProtoFile) []types.Issue {
	var issues []types.Issue

	oldEnumMap := make(map[string]types.Enum)
	for _, pf := range oldFiles {
		for _, e := range pf.Enums {
			oldEnumMap[e.FullName] = e
		}
	}

	newEnumMap := make(map[string]types.Enum)
	for _, pf := range newFiles {
		for _, e := range pf.Enums {
			newEnumMap[e.FullName] = e
		}
	}

	for name, oldEnum := range oldEnumMap {
		if _, exists := newEnumMap[name]; !exists {
			issues = append(issues, types.Issue{
				Type:     types.IssueEnumRemoved,
				Severity: types.SeverityError,
				Message:  fmt.Sprintf("枚举 '%s' 已被删除", name),
				FilePath: oldEnum.FilePath,
				EnumName: name,
				Details: fmt.Sprintf("枚举 '%s' 在历史版本中存在，但在当前版本中被删除。"+
					"删除枚举是破坏性变更，可能导致兼容性问题。"+
					"建议将整个枚举标记为 deprecated 而不是直接删除。", name),
				ExitCode: types.ExitCodeBreakingChange,
			})
		}
	}

	return issues
}

func FindRemovedEnumValues(oldFiles, newFiles []types.ProtoFile) []types.Issue {
	var issues []types.Issue

	oldEnumMap := make(map[string]types.Enum)
	for _, pf := range oldFiles {
		for _, e := range pf.Enums {
			oldEnumMap[e.FullName] = e
		}
	}

	newEnumMap := make(map[string]types.Enum)
	for _, pf := range newFiles {
		for _, e := range pf.Enums {
			newEnumMap[e.FullName] = e
		}
	}

	for name, oldEnum := range oldEnumMap {
		newEnum, exists := newEnumMap[name]
		if !exists {
			continue
		}

		newValueMap := make(map[string]types.EnumValue)
		for _, ev := range newEnum.Values {
			newValueMap[ev.Name] = ev
		}

		for _, oldEv := range oldEnum.Values {
			if _, exists := newValueMap[oldEv.Name]; !exists {
				if !isNumberInReserved(oldEv.Number, newEnum.Reserved) {
					issues = append(issues, types.Issue{
						Type:     types.IssueValueRemoved,
						Severity: types.SeverityWarning,
						Message: fmt.Sprintf("枚举值 '%s' (编号 %d) 已被删除，但编号未加入 reserved",
							oldEv.Name, oldEv.Number),
						FilePath: newEnum.FilePath,
						EnumName: name,
						ValueName: oldEv.Name,
						Number:    oldEv.Number,
						Details: fmt.Sprintf("枚举值 '%s' (编号 %d) 已被删除。"+
							"为防止未来复用该编号导致兼容性问题，"+
							"建议在枚举中添加 'reserved %d;'",
							oldEv.Name, oldEv.Number, oldEv.Number),
						ExitCode: types.ExitCodeBreakingChange,
					})
				}
			}
		}
	}

	return issues
}

func isNumberInReserved(num int32, reserved []types.Reserved) bool {
	for _, r := range reserved {
		if r.IsByName {
			continue
		}
		if r.IsRange {
			if num >= r.Start && num <= r.End {
				return true
			}
		} else {
			if num == r.Value {
				return true
			}
		}
	}
	return false
}

func FindNumberReuse(oldFiles, newFiles []types.ProtoFile) []types.Issue {
	var issues []types.Issue

	oldEnumMap := make(map[string]types.Enum)
	for _, pf := range oldFiles {
		for _, e := range pf.Enums {
			oldEnumMap[e.FullName] = e
		}
	}

	newEnumMap := make(map[string]types.Enum)
	for _, pf := range newFiles {
		for _, e := range pf.Enums {
			newEnumMap[e.FullName] = e
		}
	}

	for name, oldEnum := range oldEnumMap {
		newEnum, exists := newEnumMap[name]
		if !exists {
			continue
		}

		oldNumberMap := make(map[int32]string)
		for _, ev := range oldEnum.Values {
			oldNumberMap[ev.Number] = ev.Name
		}

		newValueMap := make(map[string]int32)
		for _, ev := range newEnum.Values {
			newValueMap[ev.Name] = ev.Number
		}

		for _, newEv := range newEnum.Values {
			if oldName, existed := oldNumberMap[newEv.Number]; existed {
				if oldName != newEv.Name {
					issues = append(issues, types.Issue{
						Type:     types.IssueNumberReuse,
						Severity: types.SeverityError,
						Message: fmt.Sprintf("编号 %d 被复用: 原先是 '%s', 现在是 '%s'",
							newEv.Number, oldName, newEv.Name),
						FilePath: newEnum.FilePath,
						EnumName: name,
						ValueName: newEv.Name,
						Number:    newEv.Number,
						Details: fmt.Sprintf("编号 %d 在历史版本中用于枚举值 '%s'，"+
							"现在被重新用于 '%s'。这是严重的破坏性变更，"+
							"会导致使用旧 SDK 的系统收到错误的枚举值。"+
							"请使用新的编号，或将旧编号加入 reserved。",
							newEv.Number, oldName, newEv.Name),
						ExitCode: types.ExitCodeBreakingChange,
					})
				}
			}
		}

		oldNameMap := make(map[string]int32)
		for _, ev := range oldEnum.Values {
			oldNameMap[ev.Name] = ev.Number
		}

		for oldName, oldNum := range oldNameMap {
			if newNum, exists := newValueMap[oldName]; exists && newNum != oldNum {
				issues = append(issues, types.Issue{
					Type:     types.IssueValueNumberChanged,
					Severity: types.SeverityError,
					Message: fmt.Sprintf("枚举值 '%s' 的编号从 %d 变为 %d",
						oldName, oldNum, newNum),
					FilePath: newEnum.FilePath,
					EnumName: name,
					ValueName: oldName,
					Number:    newNum,
					Details: fmt.Sprintf("枚举值 '%s' 的编号已更改。"+
						"更改枚举值编号是破坏性变更，会破坏线上兼容性。"+
						"请保留原有编号，或创建新的枚举值。",
						oldName),
					ExitCode: types.ExitCodeBreakingChange,
				})
			}
		}
	}

	return issues
}
