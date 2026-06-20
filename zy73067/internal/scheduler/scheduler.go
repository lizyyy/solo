package scheduler

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"blade-schedule/internal/model"
	"blade-schedule/internal/normalizer"
)

type Scheduler struct {
	Norm *normalizer.Normalizer
}

func New() *Scheduler {
	return &Scheduler{Norm: normalizer.NewDefault()}
}

type InputSet struct {
	SparePartsPath string
	DowntimePath   string
	ArrivalPath    string
	RemarksPath    string
}

type ParseError struct {
	File string
	Line int
	Msg  string
}

func (e *ParseError) Error() string {
	return fmt.Sprintf("%s:%d %s", e.File, e.Line, e.Msg)
}

func (s *Scheduler) LoadSpareParts(path string) ([]model.SparePart, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, &ParseError{File: path, Line: 0, Msg: "备件清单文件不存在，请使用 --spare-parts 指定正确路径，或运行 blade init 生成样例"}
		}
		return nil, &ParseError{File: path, Line: 0, Msg: fmt.Sprintf("打开备件清单失败: %v", err)}
	}
	defer f.Close()
	return s.parseSparePartsCSV(path, f)
}

func (s *Scheduler) parseSparePartsCSV(filename string, r io.Reader) ([]model.SparePart, error) {
	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true
	header, err := reader.Read()
	if err != nil {
		return nil, &ParseError{File: filename, Line: 1, Msg: fmt.Sprintf("读取表头失败: %v", err)}
	}
	idx := buildHeaderIndex(header)
	nameIdx := findAny(idx, "备件名称", "名称", "物料名称", "零件名称", "spare_name")
	specIdx := findAny(idx, "规格型号", "规格", "型号", "spec", "model")
	qtyIdx := findAny(idx, "数量", "需求数量", "qty", "quantity")
	srcIdx := findAny(idx, "来源", "数据来源", "清单来源", "source")
	if nameIdx < 0 {
		return nil, &ParseError{File: filename, Line: 1, Msg: "找不到备件名称列，表头需包含 [备件名称/名称/物料名称] 之一"}
	}
	var out []model.SparePart
	lineNum := 1
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		lineNum++
		if err != nil {
			return nil, &ParseError{File: filename, Line: lineNum, Msg: err.Error()}
		}
		if len(row) == 0 || allEmpty(row) {
			continue
		}
		origName := safeGet(row, nameIdx)
		if origName == "" {
			return nil, &ParseError{File: filename, Line: lineNum, Msg: "备件名称为空"}
		}
		unified, ok := s.Norm.Normalize(origName)
		if !ok {
			return nil, &ParseError{File: filename, Line: lineNum,
				Msg: fmt.Sprintf("备件名称 [%s] 无法归并到统一编号，请在 normalizer 中补充对应模式，或核对原始写法", origName)}
		}
		qty := 1
		if qtyIdx >= 0 {
			q, err := strconv.Atoi(strings.TrimSpace(safeGet(row, qtyIdx)))
			if err == nil && q > 0 {
				qty = q
			}
		}
		raw := make(map[string]string)
		for i, h := range header {
			raw[h] = safeGet(row, i)
		}
		out = append(out, model.SparePart{
			OriginalName:  origName,
			UnifiedName:   unified,
			SpecModel:     safeGet(row, specIdx),
			Quantity:      qty,
			Source:        safeGet(row, srcIdx),
			SourceLineNum: lineNum,
			RawFields:     raw,
		})
	}
	if len(out) == 0 {
		return nil, &ParseError{File: filename, Line: 1, Msg: "备件清单没有任何有效数据行"}
	}
	return out, nil
}

func (s *Scheduler) LoadDowntime(path string) ([]model.DowntimeWindow, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, &ParseError{File: path, Line: 0, Msg: "停机窗口文件不存在，请使用 --downtime 指定，或运行 blade init 生成样例"}
		}
		return nil, &ParseError{File: path, Line: 0, Msg: err.Error()}
	}
	defer f.Close()
	reader := csv.NewReader(f)
	reader.TrimLeadingSpace = true
	header, err := reader.Read()
	if err != nil {
		return nil, &ParseError{File: path, Line: 1, Msg: fmt.Sprintf("读取停机窗口表头失败: %v", err)}
	}
	idx := buildHeaderIndex(header)
	farmIdx := findAny(idx, "风场", "风电场", "wind_farm")
	turIdx := findAny(idx, "风机编号", "机组编号", "风机", "turbine_id")
	startIdx := findAny(idx, "开始日期", "停机开始", "start", "start_date")
	endIdx := findAny(idx, "结束日期", "停机结束", "end", "end_date")
	reasonIdx := findAny(idx, "停机原因", "原因", "reason")
	if startIdx < 0 || endIdx < 0 {
		return nil, &ParseError{File: path, Line: 1, Msg: "找不到停机开始/结束日期列，表头需包含 [开始日期/结束日期]"}
	}
	var out []model.DowntimeWindow
	lineNum := 1
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		lineNum++
		if err != nil || allEmpty(row) {
			continue
		}
		start, err := parseDate(safeGet(row, startIdx))
		if err != nil {
			return nil, &ParseError{File: path, Line: lineNum,
				Msg: fmt.Sprintf("开始日期格式错误 [%s]，支持 YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD", safeGet(row, startIdx))}
		}
		end, err := parseDate(safeGet(row, endIdx))
		if err != nil {
			return nil, &ParseError{File: path, Line: lineNum,
				Msg: fmt.Sprintf("结束日期格式错误 [%s]，支持 YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD", safeGet(row, endIdx))}
		}
		if end.Before(start) {
			return nil, &ParseError{File: path, Line: lineNum, Msg: "结束日期早于开始日期"}
		}
		turbine := safeGet(row, turIdx)
		if turbine == "" {
			return nil, &ParseError{File: path, Line: lineNum, Msg: "风机编号为空，无法对应备件"}
		}
		out = append(out, model.DowntimeWindow{
			WindFarm:      safeGet(row, farmIdx),
			TurbineID:     turbine,
			StartDate:     start,
			EndDate:       end,
			Reason:        safeGet(row, reasonIdx),
			SourceLineNum: lineNum,
		})
	}
	if len(out) == 0 {
		return nil, &ParseError{File: path, Line: 0, Msg: "找不到任何停机窗口记录，排程无法判断备件是否延误"}
	}
	return out, nil
}

func (s *Scheduler) LoadArrivals(path string) ([]model.ArrivalPlan, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, &ParseError{File: path, Line: 0, Msg: "到货计划文件不存在，请使用 --arrivals 指定"}
		}
		return nil, &ParseError{File: path, Line: 0, Msg: err.Error()}
	}
	defer f.Close()
	reader := csv.NewReader(f)
	reader.TrimLeadingSpace = true
	header, err := reader.Read()
	if err != nil {
		return nil, &ParseError{File: path, Line: 1, Msg: err.Error()}
	}
	idx := buildHeaderIndex(header)
	nameIdx := findAny(idx, "备件名称", "名称", "物料名称")
	specIdx := findAny(idx, "规格型号", "规格", "型号")
	qtyIdx := findAny(idx, "到货数量", "数量", "qty")
	supIdx := findAny(idx, "供应商", "供货方", "supplier")
	etaIdx := findAny(idx, "预计到货", "到货日期", "ETA", "eta")
	ordIdx := findAny(idx, "订单号", "采购单号", "order_no")
	if nameIdx < 0 || etaIdx < 0 {
		return nil, &ParseError{File: path, Line: 1, Msg: "表头需包含 [备件名称/名称] 和 [预计到货/到货日期/ETA]"}
	}
	var out []model.ArrivalPlan
	lineNum := 1
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		lineNum++
		if err != nil || allEmpty(row) {
			continue
		}
		origName := safeGet(row, nameIdx)
		unified, _ := s.Norm.Normalize(origName)
		eta, err := parseDate(safeGet(row, etaIdx))
		if err != nil {
			return nil, &ParseError{File: path, Line: lineNum,
				Msg: fmt.Sprintf("到货日期格式错误 [%s]，支持 YYYY-MM-DD / YYYY/MM/DD", safeGet(row, etaIdx))}
		}
		qty := 0
		if qtyIdx >= 0 {
			q, _ := strconv.Atoi(strings.TrimSpace(safeGet(row, qtyIdx)))
			qty = q
		}
		out = append(out, model.ArrivalPlan{
			OriginalName:  origName,
			UnifiedName:   unified,
			SpecModel:     safeGet(row, specIdx),
			Quantity:      qty,
			Supplier:      safeGet(row, supIdx),
			ETA:           eta,
			OrderNo:       safeGet(row, ordIdx),
			SourceLineNum: lineNum,
		})
	}
	return out, nil
}

func (s *Scheduler) LoadRemarks(path string) ([]model.RemarkStatus, error) {
	if path == "" {
		return nil, nil
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, nil
	}
	defer f.Close()
	reader := csv.NewReader(f)
	reader.TrimLeadingSpace = true
	header, err := reader.Read()
	if err != nil {
		return nil, nil
	}
	idx := buildHeaderIndex(header)
	nameIdx := findAny(idx, "统一备件名称", "备件名称", "名称")
	specIdx := findAny(idx, "规格型号", "规格")
	stIdx := findAny(idx, "状态", "处理状态")
	rmIdx := findAny(idx, "备注", "复核备注")
	scIdx := findAny(idx, "截图引用", "截图")
	thIdx := findAny(idx, "阈值说明", "阈值调整说明")
	upIdx := findAny(idx, "更新时间")
	if nameIdx < 0 {
		return nil, nil
	}
	var out []model.RemarkStatus
	lineNum := 1
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		lineNum++
		if err != nil || allEmpty(row) {
			continue
		}
		name := safeGet(row, nameIdx)
		unified, _ := s.Norm.Normalize(name)
		if unified == "" {
			unified = name
		}
		t := time.Time{}
		if upIdx >= 0 {
			if pt, err := parseDateOrTime(safeGet(row, upIdx)); err == nil {
				t = pt
			}
		}
		out = append(out, model.RemarkStatus{
			UnifiedName:   unified,
			SpecModel:     safeGet(row, specIdx),
			Status:        safeGet(row, stIdx),
			Remark:        safeGet(row, rmIdx),
			ScreenshotRef: safeGet(row, scIdx),
			ThresholdNote: safeGet(row, thIdx),
			UpdatedAt:     t,
		})
	}
	return out, nil
}

type RunResult struct {
	Records      []model.ScheduleResult
	SummaryStats struct {
		Total         int
		OnTime        int
		Late          int
		Anomaly       int
		NoWindowMatch int
	}
	UnmatchedDowntime []string
}

func (s *Scheduler) Compute(in InputSet) (*RunResult, error) {
	spares, err := s.LoadSpareParts(in.SparePartsPath)
	if err != nil {
		return nil, err
	}
	downtimes, err := s.LoadDowntime(in.DowntimePath)
	if err != nil {
		return nil, err
	}
	arrivals, err := s.LoadArrivals(in.ArrivalPath)
	if err != nil {
		return nil, err
	}
	remarks, err := s.LoadRemarks(in.RemarksPath)
	if err != nil {
		return nil, err
	}
	_ = remarks

	byUnified := make(map[string][]model.SparePart)
	for _, sp := range spares {
		byUnified[sp.UnifiedName] = append(byUnified[sp.UnifiedName], sp)
	}
	arrivalByUnified := make(map[string][]model.ArrivalPlan)
	for _, a := range arrivals {
		if a.UnifiedName != "" {
			arrivalByUnified[a.UnifiedName] = append(arrivalByUnified[a.UnifiedName], a)
		}
	}
	downtimeStart, downtimeEnd := earliestDowntime(downtimes)

	result := &RunResult{}
	for unified, parts := range byUnified {
		origNames := dedupeOrigNames(parts)
		reqQty := 0
		spec := ""
		sourceQuote := ""
		thrText := ""
		for _, p := range parts {
			reqQty += p.Quantity
			if spec == "" {
				spec = p.SpecModel
			}
			if p.Source != "" && sourceQuote == "" {
				sourceQuote = fmt.Sprintf("来源=%s 第%d行 名称=[%s]", p.Source, p.SourceLineNum, p.OriginalName)
			}
			for k, v := range p.RawFields {
				if strings.Contains(k, "阈值") || strings.Contains(k, "threshold") {
					thrText = fmt.Sprintf("清单字段[%s]=%s", k, v)
				}
			}
		}
		var arrQty int
		var latestETA time.Time
		for _, a := range arrivalByUnified[unified] {
			arrQty += a.Quantity
			if latestETA.IsZero() || a.ETA.After(latestETA) {
				latestETA = a.ETA
			}
		}

		rec := model.ScheduleResult{
			UnifiedName:    unified,
			OriginalNames:  origNames,
			SpecModel:      spec,
			RequiredQty:    reqQty,
			ArrivedQty:     arrQty,
			ETA:            latestETA,
			DowntimeStart:  downtimeStart,
			DowntimeEnd:    downtimeEnd,
			RawSourceQuote: sourceQuote,
			ThresholdText:  thrText,
		}
		var reasons []string
		if downtimeStart.IsZero() {
			reasons = append(reasons, "找不到匹配的停机窗口")
			result.SummaryStats.NoWindowMatch++
		} else if latestETA.IsZero() {
			reasons = append(reasons, "缺货到货计划")
			rec.IsAnomaly = true
		} else {
			willMake := arrQty >= reqQty && !latestETA.After(downtimeStart)
			rec.WillMakeWindow = willMake
			if !willMake {
				rec.IsAnomaly = true
				if arrQty < reqQty {
					reasons = append(reasons, fmt.Sprintf("到货数量不足: %d/%d", arrQty, reqQty))
				}
				if latestETA.After(downtimeStart) {
					days := int(latestETA.Sub(downtimeStart).Hours()/24) + 1
					rec.DaysLate = days
					reasons = append(reasons, fmt.Sprintf("到货晚于停机窗口%d天 (到货 %s, 停机开始 %s)", days,
						latestETA.Format("2006-01-02"), downtimeStart.Format("2006-01-02")))
				}
			}
		}
		if thrText != "" {
			reasons = append(reasons, "阈值字段需追溯: "+thrText)
			rec.IsAnomaly = true
		}
		if len(origNames) > 1 {
			reasons = append(reasons, fmt.Sprintf("同一备件多种写法(%d种): %v", len(origNames), origNames))
		}
		rec.AnomalyReasons = reasons
		result.Records = append(result.Records, rec)
		result.SummaryStats.Total++
		if rec.WillMakeWindow {
			result.SummaryStats.OnTime++
		} else if !downtimeStart.IsZero() {
			result.SummaryStats.Late++
		}
		if rec.IsAnomaly {
			result.SummaryStats.Anomaly++
		}
	}
	for _, d := range downtimes {
		result.UnmatchedDowntime = append(result.UnmatchedDowntime,
			fmt.Sprintf("%s %s~%s %s", d.TurbineID,
				d.StartDate.Format("2006-01-02"), d.EndDate.Format("2006-01-02"), d.Reason))
	}
	return result, nil
}

func buildHeaderIndex(h []string) map[string]int {
	m := make(map[string]int, len(h))
	for i, s := range h {
		m[strings.TrimSpace(s)] = i
	}
	return m
}

func findAny(idx map[string]int, keys ...string) int {
	for _, k := range keys {
		if v, ok := idx[k]; ok {
			return v
		}
	}
	return -1
}

func safeGet(row []string, i int) string {
	if i < 0 || i >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[i])
}

func allEmpty(r []string) bool {
	for _, s := range r {
		if strings.TrimSpace(s) != "" {
			return false
		}
	}
	return true
}

func parseDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	layouts := []string{"2006-01-02", "2006/01/02", "2006.01.02", "20060102", "2006-1-2", "2006/1/2"}
	for _, l := range layouts {
		if t, err := time.ParseInLocation(l, s, time.Local); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized date %s", s)
}

func parseDateOrTime(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	layouts := []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02", "2006/01/02"}
	for _, l := range layouts {
		if t, err := time.ParseInLocation(l, s, time.Local); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized datetime %s", s)
}

func earliestDowntime(ds []model.DowntimeWindow) (time.Time, time.Time) {
	var s, e time.Time
	for _, d := range ds {
		if s.IsZero() || d.StartDate.Before(s) {
			s = d.StartDate
			e = d.EndDate
		}
	}
	return s, e
}

func dedupeOrigNames(parts []model.SparePart) []string {
	m := make(map[string]struct{})
	for _, p := range parts {
		m[p.OriginalName] = struct{}{}
	}
	var out []string
	for k := range m {
		out = append(out, k)
	}
	return out
}
