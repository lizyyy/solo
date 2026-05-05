package engine

import (
	"fmt"
	"math"

	"github.com/zy1221/slice-teacher/internal/errors"
	"github.com/zy1221/slice-teacher/internal/model"
)

type SliceEngine struct {
	arrays       map[string]*model.Array
	slices       map[string]*model.Slice
	arrayCounter int
	steps        []*model.Step
}

func NewSliceEngine() *SliceEngine {
	return &SliceEngine{
		arrays:       make(map[string]*model.Array),
		slices:       make(map[string]*model.Slice),
		arrayCounter: 0,
		steps:        []*model.Step{},
	}
}

func (e *SliceEngine) Execute(operations []*model.Operation) error {
	for i, op := range operations {
		stepNum := i + 1
		step := &model.Step{
			StepNumber:   stepNum,
			Operation:    op,
			Slices:       make(map[string]*model.Slice),
			Arrays:       make(map[string]*model.Array),
			SliceAliases: make(map[string][]string),
			Notes:        []string{},
		}

		if err := e.executeOperation(op, step); err != nil {
			return err
		}

		e.updateAliases(step)
		e.checkBigArrayHolders(step)
		e.cloneCurrentState(step)

		e.steps = append(e.steps, step)
	}

	return nil
}

func (e *SliceEngine) executeOperation(op *model.Operation, step *model.Step) error {
	switch op.Type {
	case model.OpMake:
		return e.executeMake(op, step)

	case model.OpSlice:
		return e.executeSlice(op, step)

	case model.OpFullSlice:
		return e.executeFullSlice(op, step)

	case model.OpAppend:
		return e.executeAppend(op, step)

	case model.OpCopy:
		return e.executeCopy(op, step)

	case model.OpDelete:
		return e.executeDelete(op, step)

	case model.OpFilter:
		return e.executeFilter(op, step)

	case model.OpFuncPassByValue:
		return e.executeFuncPassByValue(op, step)

	case model.OpFuncPassByRef:
		return e.executeFuncPassByRef(op, step)

	case model.OpModifyElement:
		return e.executeModifyElement(op, step)

	default:
		return errors.NewRuntimeError(
			fmt.Sprintf("未知的操作类型: %s", op.Type),
			"请检查操作类型是否正确",
		)
	}
}

func (e *SliceEngine) executeMake(op *model.Operation, step *model.Step) error {
	lenVal := 0
	capVal := 0

	if val, ok := op.Parameters["len"]; ok {
		switch v := val.(type) {
		case int:
			lenVal = v
		case float64:
			lenVal = int(v)
		}
	}

	if val, ok := op.Parameters["cap"]; ok {
		switch v := val.(type) {
		case int:
			capVal = v
		case float64:
			capVal = int(v)
		}
	} else {
		capVal = lenVal
	}

	if capVal < lenVal {
		return errors.NewValidationError(
			fmt.Sprintf("cap (%d) 不能小于 len (%d)", capVal, lenVal),
			"",
			"请确保 cap >= len",
		)
	}

	arrayID := e.newArrayID()
	array := &model.Array{
		ID:      arrayID,
		Size:    capVal,
		Values:  make([]interface{}, capVal),
		RefCount: 1,
	}

	for i := 0; i < lenVal; i++ {
		array.Values[i] = getZeroValue()
	}

	e.arrays[arrayID] = array

	slice := &model.Slice{
		Name:      op.Target,
		Len:       lenVal,
		Cap:       capVal,
		Start:     0,
		ArrayID:   arrayID,
		IsAliased: false,
	}

	e.slices[op.Target] = slice

	step.Notes = append(step.Notes,
		fmt.Sprintf("创建新数组 %s，大小: %d", arrayID, capVal),
		fmt.Sprintf("创建切片 %s，len=%d, cap=%d，指向数组 %s[0:%d]", op.Target, lenVal, capVal, arrayID, capVal),
	)

	return nil
}

func (e *SliceEngine) executeSlice(op *model.Operation, step *model.Step) error {
	sourceName := ""
	if len(op.Sources) > 0 {
		sourceName = op.Sources[0]
	} else if val, ok := op.Parameters["source"]; ok {
		sourceName = val.(string)
	}

	if sourceName == "" {
		return errors.NewValidationError(
			"切片表达式没有指定源切片",
			"",
			"请在 sources 或 parameters.source 中指定源切片",
		)
	}

	sourceSlice, ok := e.slices[sourceName]
	if !ok {
		return errors.NewValidationError(
			fmt.Sprintf("源切片 '%s' 不存在", sourceName),
			"",
			"请确保源切片已经被创建",
		)
	}

	low := 0
	high := sourceSlice.Len

	if val, ok := op.Parameters["low"]; ok {
		switch v := val.(type) {
		case int:
			low = v
		case float64:
			low = int(v)
		}
	}

	if val, ok := op.Parameters["high"]; ok {
		switch v := val.(type) {
		case int:
			high = v
		case float64:
			high = int(v)
		}
	}

	if low < 0 || high > sourceSlice.Cap || low > high {
		return errors.NewValidationError(
			fmt.Sprintf("无效的切片范围: [%d:%d]，有效范围是 [0:%d]", low, high, sourceSlice.Cap),
			"",
			"请确保 0 <= low <= high <= cap",
		)
	}

	newLen := high - low
	newCap := sourceSlice.Cap - low

	sourceArray := e.arrays[sourceSlice.ArrayID]
	sourceArray.RefCount++

	newSlice := &model.Slice{
		Name:      op.Target,
		Len:       newLen,
		Cap:       newCap,
		Start:     sourceSlice.Start + low,
		ArrayID:   sourceSlice.ArrayID,
		IsAliased: true,
	}

	e.slices[op.Target] = newSlice

	step.Notes = append(step.Notes,
		fmt.Sprintf("从 %s[%d:%d] 创建新切片 %s", sourceName, low, high, op.Target),
		fmt.Sprintf("新切片 len=%d, cap=%d，指向数组 %s[%d:%d]", newLen, newCap, sourceSlice.ArrayID, newSlice.Start, newSlice.Start+newCap),
		fmt.Sprintf("⚠️  切片 %s 和 %s 现在共享同一个底层数组", op.Target, sourceName),
	)

	return nil
}

func (e *SliceEngine) executeFullSlice(op *model.Operation, step *model.Step) error {
	sourceName := ""
	if len(op.Sources) > 0 {
		sourceName = op.Sources[0]
	} else if val, ok := op.Parameters["source"]; ok {
		sourceName = val.(string)
	}

	if sourceName == "" {
		return errors.NewValidationError(
			"full slice expression 没有指定源切片",
			"",
			"请在 sources 或 parameters.source 中指定源切片",
		)
	}

	sourceSlice, ok := e.slices[sourceName]
	if !ok {
		return errors.NewValidationError(
			fmt.Sprintf("源切片 '%s' 不存在", sourceName),
			"",
			"请确保源切片已经被创建",
		)
	}

	low := 0
	high := sourceSlice.Len
	max := sourceSlice.Cap

	if val, ok := op.Parameters["low"]; ok {
		switch v := val.(type) {
		case int:
			low = v
		case float64:
			low = int(v)
		}
	}

	if val, ok := op.Parameters["high"]; ok {
		switch v := val.(type) {
		case int:
			high = v
		case float64:
			high = int(v)
		}
	}

	if val, ok := op.Parameters["max"]; ok {
		switch v := val.(type) {
		case int:
			max = v
		case float64:
			max = int(v)
		}
	}

	if low < 0 || high > max || max > sourceSlice.Cap || low > high {
		return errors.NewValidationError(
			fmt.Sprintf("无效的 full slice 范围: [%d:%d:%d]，有效范围是 0 <= low <= high <= max <= %d", low, high, max, sourceSlice.Cap),
			"",
			"请确保范围正确",
		)
	}

	newLen := high - low
	newCap := max - low

	sourceArray := e.arrays[sourceSlice.ArrayID]
	sourceArray.RefCount++

	newSlice := &model.Slice{
		Name:      op.Target,
		Len:       newLen,
		Cap:       newCap,
		Start:     sourceSlice.Start + low,
		ArrayID:   sourceSlice.ArrayID,
		IsAliased: true,
	}

	e.slices[op.Target] = newSlice

	step.Notes = append(step.Notes,
		fmt.Sprintf("从 %s[%d:%d:%d] 创建新切片 %s (full slice expression)", sourceName, low, high, max, op.Target),
		fmt.Sprintf("新切片 len=%d, cap=%d，指向数组 %s[%d:%d]", newLen, newCap, sourceSlice.ArrayID, newSlice.Start, newSlice.Start+newCap),
		fmt.Sprintf("✅ full slice expression 限制了新切片的 cap，防止意外访问更多数据"),
	)

	return nil
}

func (e *SliceEngine) executeAppend(op *model.Operation, step *model.Step) error {
	sourceName := ""
	if val, ok := op.Parameters["source"]; ok {
		sourceName = val.(string)
	} else if len(op.Sources) > 0 {
		sourceName = op.Sources[0]
	}

	if sourceName == "" {
		sourceName = op.Target
	}

	targetSlice, ok := e.slices[sourceName]
	if !ok {
		return errors.NewValidationError(
			fmt.Sprintf("源切片 '%s' 不存在", sourceName),
			"",
			"请确保源切片已经被创建",
		)
	}

	numElements := 1
	if val, ok := op.Parameters["num_elements"]; ok {
		switch v := val.(type) {
		case int:
			numElements = v
		case float64:
			numElements = int(v)
		}
	}

	newLen := targetSlice.Len + numElements
	didGrow := false
	oldCap := targetSlice.Cap
	newCap := oldCap

	if newLen > targetSlice.Cap {
		didGrow = true
		step.DidGrow = true
		step.GrowFrom = oldCap

		newCap = e.calculateNewCap(targetSlice.Cap, newLen)
		step.GrowTo = newCap

		oldArrayID := targetSlice.ArrayID
		oldArray := e.arrays[oldArrayID]
		oldArray.RefCount--

		newArrayID := e.newArrayID()
		newArray := &model.Array{
			ID:      newArrayID,
			Size:    newCap,
			Values:  make([]interface{}, newCap),
			RefCount: 1,
		}

		for i := 0; i < targetSlice.Len; i++ {
			newArray.Values[i] = oldArray.Values[targetSlice.Start+i]
		}

		e.arrays[newArrayID] = newArray

		targetSlice.ArrayID = newArrayID
		targetSlice.Cap = newCap
		targetSlice.Start = 0

		if oldArray.RefCount > 0 {
			step.Notes = append(step.Notes,
				fmt.Sprintf("⚠️  原数组 %s 还有 %d 个引用，不会被释放", oldArrayID, oldArray.RefCount),
			)
		} else {
			delete(e.arrays, oldArrayID)
			step.Notes = append(step.Notes,
				fmt.Sprintf("原数组 %s 已无引用，被释放", oldArrayID),
			)
		}
	}

	for i := targetSlice.Len; i < newLen; i++ {
		array := e.arrays[targetSlice.ArrayID]
		array.Values[targetSlice.Start+i] = getAppendValue()
	}

	targetSlice.Len = newLen

	if op.Target != sourceName {
		e.slices[op.Target] = &model.Slice{
			Name:      op.Target,
			Len:       targetSlice.Len,
			Cap:       targetSlice.Cap,
			Start:     targetSlice.Start,
			ArrayID:   targetSlice.ArrayID,
			IsAliased: false,
		}

		e.arrays[targetSlice.ArrayID].RefCount++
	}

	if didGrow {
		step.Notes = append(step.Notes,
			fmt.Sprintf("append 导致扩容: cap 从 %d 增长到 %d", oldCap, newCap),
			fmt.Sprintf("创建新数组 %s，大小: %d", targetSlice.ArrayID, newCap),
			fmt.Sprintf("切片 %s 现在指向新数组", op.Target),
		)
	} else {
		step.Notes = append(step.Notes,
			fmt.Sprintf("append 成功，len 从 %d 增长到 %d，cap 保持 %d 不变", targetSlice.Len-numElements, targetSlice.Len, targetSlice.Cap),
		)
	}

	return nil
}

func (e *SliceEngine) calculateNewCap(oldCap, needed int) int {
	if oldCap == 0 {
		return max(needed, 4)
	}

	newCap := oldCap
	doubleCap := oldCap * 2

	if needed > doubleCap {
		newCap = needed
	} else {
		if oldCap < 256 {
			newCap = doubleCap
		} else {
			newCap = oldCap + oldCap/4
			for newCap < needed {
				newCap += newCap / 4
			}
		}
	}

	return int(math.Ceil(float64(newCap)/8) * 8)
}

func (e *SliceEngine) executeCopy(op *model.Operation, step *model.Step) error {
	dstName := op.Target
	srcName := ""

	if len(op.Sources) > 0 {
		srcName = op.Sources[0]
	} else if val, ok := op.Parameters["source"]; ok {
		srcName = val.(string)
	}

	if srcName == "" {
		return errors.NewValidationError(
			"copy 操作没有指定源切片",
			"",
			"请在 sources 或 parameters.source 中指定源切片",
		)
	}

	dstSlice, ok := e.slices[dstName]
	if !ok {
		return errors.NewValidationError(
			fmt.Sprintf("目标切片 '%s' 不存在", dstName),
			"",
			"请确保目标切片已经被创建",
		)
	}

	srcSlice, ok := e.slices[srcName]
	if !ok {
		return errors.NewValidationError(
			fmt.Sprintf("源切片 '%s' 不存在", srcName),
			"",
			"请确保源切片已经被创建",
		)
	}

	copyCount := min(dstSlice.Len, srcSlice.Len)

	dstArray := e.arrays[dstSlice.ArrayID]
	srcArray := e.arrays[srcSlice.ArrayID]

	for i := 0; i < copyCount; i++ {
		dstArray.Values[dstSlice.Start+i] = srcArray.Values[srcSlice.Start+i]
	}

	step.Notes = append(step.Notes,
		fmt.Sprintf("copy: 从 %s 复制 %d 个元素到 %s", srcName, copyCount, dstName),
		fmt.Sprintf("✅ copy 操作创建了独立的副本，不会共享底层数组"),
	)

	return nil
}

func (e *SliceEngine) executeDelete(op *model.Operation, step *model.Step) error {
	targetSlice, ok := e.slices[op.Target]
	if !ok {
		return errors.NewValidationError(
			fmt.Sprintf("目标切片 '%s' 不存在", op.Target),
			"",
			"请确保目标切片已经被创建",
		)
	}

	index := 0
	if val, ok := op.Parameters["index"]; ok {
		switch v := val.(type) {
		case int:
			index = v
		case float64:
			index = int(v)
		}
	}

	if index < 0 || index >= targetSlice.Len {
		return errors.NewValidationError(
			fmt.Sprintf("删除索引 %d 超出范围 [0:%d]", index, targetSlice.Len-1),
			"",
			"请确保索引在有效范围内",
		)
	}

	array := e.arrays[targetSlice.ArrayID]

	for i := index; i < targetSlice.Len-1; i++ {
		array.Values[targetSlice.Start+i] = array.Values[targetSlice.Start+i+1]
	}

	array.Values[targetSlice.Start+targetSlice.Len-1] = getZeroValue()
	targetSlice.Len--

	step.Notes = append(step.Notes,
		fmt.Sprintf("删除 %s[%d]，len 从 %d 减少到 %d", op.Target, index, targetSlice.Len+1, targetSlice.Len),
		fmt.Sprintf("⚠️  删除操作修改了原数组，所有别名切片都会看到变化"),
	)

	return nil
}

func (e *SliceEngine) executeFilter(op *model.Operation, step *model.Step) error {
	sourceName := ""
	if len(op.Sources) > 0 {
		sourceName = op.Sources[0]
	} else if val, ok := op.Parameters["source"]; ok {
		sourceName = val.(string)
	}

	if sourceName == "" {
		sourceName = op.Target
	}

	sourceSlice, ok := e.slices[sourceName]
	if !ok {
		return errors.NewValidationError(
			fmt.Sprintf("源切片 '%s' 不存在", sourceName),
			"",
			"请确保源切片已经被创建",
		)
	}

	filterRatio := 0.5
	if val, ok := op.Parameters["ratio"]; ok {
		switch v := val.(type) {
		case float64:
			filterRatio = v
		}
	}

	oldArrayID := sourceSlice.ArrayID
	oldArray := e.arrays[oldArrayID]

	newLen := int(float64(sourceSlice.Len) * filterRatio)
	if newLen < 1 {
		newLen = 1
	}

	newCap := newLen

	newArrayID := e.newArrayID()
	newArray := &model.Array{
		ID:      newArrayID,
		Size:    newCap,
		Values:  make([]interface{}, newCap),
		RefCount: 1,
	}

	for i := 0; i < newLen; i++ {
		newArray.Values[i] = oldArray.Values[sourceSlice.Start+i*2]
	}

	e.arrays[newArrayID] = newArray

	oldArray.RefCount--
	if oldArray.RefCount > 0 {
		step.HoldsBigArray = true
		step.BigArrayHolder = op.Target
		step.Notes = append(step.Notes,
			fmt.Sprintf("⚠️  原数组 %s 还有 %d 个引用，存在内存浪费风险", oldArrayID, oldArray.RefCount),
		)
	} else {
		delete(e.arrays, oldArrayID)
	}

	sourceSlice.ArrayID = newArrayID
	sourceSlice.Len = newLen
	sourceSlice.Cap = newCap
	sourceSlice.Start = 0

	step.Notes = append(step.Notes,
		fmt.Sprintf("filter 操作: 创建新数组 %s，len=%d, cap=%d", newArrayID, newLen, newCap),
		fmt.Sprintf("原数组 %s 大小: %d，新数组大小: %d", oldArrayID, oldArray.Size, newCap),
	)

	return nil
}

func (e *SliceEngine) executeFuncPassByValue(op *model.Operation, step *model.Step) error {
	sourceName := op.Target

	sourceSlice, ok := e.slices[sourceName]
	if !ok {
		return errors.NewValidationError(
			fmt.Sprintf("切片 '%s' 不存在", sourceName),
			"",
			"请确保切片已经被创建",
		)
	}

	funcParamName := fmt.Sprintf("%s_param", sourceName)
	funcSlice := &model.Slice{
		Name:      funcParamName,
		Len:       sourceSlice.Len,
		Cap:       sourceSlice.Cap,
		Start:     sourceSlice.Start,
		ArrayID:   sourceSlice.ArrayID,
		IsAliased: true,
	}

	e.slices[funcParamName] = funcSlice
	e.arrays[sourceSlice.ArrayID].RefCount++

	step.Notes = append(step.Notes,
		fmt.Sprintf("函数传值: 切片 %s 被传递给函数", sourceName),
		fmt.Sprintf("⚠️  切片是值传递，但底层数组共享（指针拷贝）"),
		fmt.Sprintf("函数内通过 %s 修改元素会影响原切片 %s", funcParamName, sourceName),
		fmt.Sprintf("⚠️  函数内 append 可能导致扩容，此时函数内外指向不同数组"),
	)

	return nil
}

func (e *SliceEngine) executeFuncPassByRef(op *model.Operation, step *model.Step) error {
	sourceName := op.Target

	sourceSlice, ok := e.slices[sourceName]
	if !ok {
		return errors.NewValidationError(
			fmt.Sprintf("切片 '%s' 不存在", sourceName),
			"",
			"请确保切片已经被创建",
		)
	}

	step.Notes = append(step.Notes,
		fmt.Sprintf("函数传引用（指针）: 切片 %s 的指针被传递给函数", sourceName),
		fmt.Sprintf("✅ 函数内可以修改切片本身（len/cap/指针）"),
		fmt.Sprintf("⚠️  依然共享底层数组，修改元素会影响原切片"),
	)

	return nil
}

func (e *SliceEngine) executeModifyElement(op *model.Operation, step *model.Step) error {
	targetSlice, ok := e.slices[op.Target]
	if !ok {
		return errors.NewValidationError(
			fmt.Sprintf("目标切片 '%s' 不存在", op.Target),
			"",
			"请确保目标切片已经被创建",
		)
	}

	index := 0
	if val, ok := op.Parameters["index"]; ok {
		switch v := val.(type) {
		case int:
			index = v
		case float64:
			index = int(v)
		}
	}

	if index < 0 || index >= targetSlice.Len {
		return errors.NewValidationError(
			fmt.Sprintf("修改索引 %d 超出范围 [0:%d]", index, targetSlice.Len-1),
			"",
			"请确保索引在有效范围内",
		)
	}

	array := e.arrays[targetSlice.ArrayID]
	array.Values[targetSlice.Start+index] = getModifiedValue()

	aliasedSlices := e.findAliasedSlices(targetSlice.ArrayID)

	step.Notes = append(step.Notes,
		fmt.Sprintf("修改 %s[%d] = %v", op.Target, index, getModifiedValue()),
		fmt.Sprintf("⚠️  以下别名切片也会看到这个变化: %v", aliasedSlices),
	)

	return nil
}

func (e *SliceEngine) findAliasedSlices(arrayID string) []string {
	var aliases []string
	for name, slice := range e.slices {
		if slice.ArrayID == arrayID {
			aliases = append(aliases, name)
		}
	}
	return aliases
}

func (e *SliceEngine) updateAliases(step *model.Step) {
	for name, slice := range e.slices {
		array := e.arrays[slice.ArrayID]
		slice.IsAliased = array.RefCount > 1

		aliases := []string{}
		for otherName, otherSlice := range e.slices {
			if otherName != name && otherSlice.ArrayID == slice.ArrayID {
				aliases = append(aliases, otherName)
			}
		}
		if len(aliases) > 0 {
			step.SliceAliases[name] = aliases
		}
	}
}

func (e *SliceEngine) checkBigArrayHolders(step *model.Step) {
	for arrayID, array := range e.arrays {
		if array.RefCount > 0 {
			for sliceName, slice := range e.slices {
				if slice.ArrayID == arrayID {
					arrayUtilization := float64(slice.Len) / float64(array.Size)
					if arrayUtilization < 0.5 && array.Size > 10 {
						step.HoldsBigArray = true
						step.BigArrayHolder = sliceName
						step.Notes = append(step.Notes,
							fmt.Sprintf("⚠️  内存浪费警告: 切片 %s 只使用了数组 %s 的 %.1f%% (len=%d, 数组大小=%d)",
								sliceName, arrayID, arrayUtilization*100, slice.Len, array.Size),
						)
					}
				}
			}
		}
	}
}

func (e *SliceEngine) cloneCurrentState(step *model.Step) {
	for name, slice := range e.slices {
		step.Slices[name] = &model.Slice{
			Name:      slice.Name,
			Len:       slice.Len,
			Cap:       slice.Cap,
			Start:     slice.Start,
			ArrayID:   slice.ArrayID,
			IsAliased: slice.IsAliased,
		}
	}

	for id, array := range e.arrays {
		step.Arrays[id] = &model.Array{
			ID:       array.ID,
			Size:     array.Size,
			Values:   append([]interface{}{}, array.Values...),
			RefCount: array.RefCount,
		}
	}
}

func (e *SliceEngine) GetSteps() []*model.Step {
	return e.steps
}

func (e *SliceEngine) newArrayID() string {
	e.arrayCounter++
	return fmt.Sprintf("arr_%03d", e.arrayCounter)
}

func getZeroValue() interface{} {
	return 0
}

func getAppendValue() interface{} {
	return 42
}

func getModifiedValue() interface{} {
	return 99
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
