#!/usr/bin/env python3
# -*- coding: utf-8 -*-

go_code = '''package main

import (
	"crypto/md5"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SkillLevel string

const (
	SkillLevelBasic        SkillLevel = "basic"
	SkillLevelIntermediate SkillLevel = "intermediate"
	SkillLevelAdvanced     SkillLevel = "advanced"
)

type ServiceOrder struct {
	ID, ElderID, NurseID, ServiceType, RequiredSkill string
	SkillLevel, ServiceDate, StartTime, EndTime       string
	ServiceAddress, District, CancelReason, Remark    string
	IsCancelled                                        bool
}

type NurseCalendar struct {
	NurseID, NurseName, WorkDistrict string
	Skills                           []SkillItem
	Calendar                         []DaySchedule
}

type SkillItem struct {
	SkillName string
	Level     SkillLevel
}

type DaySchedule struct {
	Date        string
	IsAvailable bool
	TimeSlots   []TimeSlot
}

type TimeSlot struct {
	StartTime, EndTime, Status string
}

type ElderProfile struct {
	ElderID, Name, Gender, Address, District, HealthLevel string
	Age                                                  int
	RequiredCare                                         []string
}

type Batch struct {
	BatchID, Checksum, Status string
	SubmittedAt               time.Time
}

type ProcessResult struct {
	BatchID                  string
	ProcessedAt              time.Time
	Normal, Pending          []ResultItem
	Failed                   []FailedItem
	Summary                  ResultSummary
}

type ResultItem struct {
	OriginalID, Type string
	Data             map[string]interface{}
}

type FailedItem struct {
	OriginalID, Type  string
	OriginalData      map[string]interface{}
	FailureReasons    []FailureReason
	Suggestions       []string
}

type FailureReason struct {
	RuleCode, RuleName, Description, Detail string
}

type ResultSummary struct {
	TotalCount, NormalCount, PendingCount, FailedCount int
}

type UploadRequest struct {
	BatchID, ServiceOrders, NurseCalendar, ElderProfiles string
}

const (
	RuleCodeSkillMismatch         = "SKILL_MISMATCH"
	RuleCodeSkillLevelInsufficient = "SKILL_LEVEL_INSUFFICIENT"
	RuleCodeCrossDistrict         = "CROSS_DISTRICT"
	RuleCodeTimeConflict          = "TIME_CONFLICT"
	RuleCodeNurseUnavailable      = "NURSE_UNAVAILABLE"
	RuleCodeCancellationNoBackup  = "CANCELLATION_NO_BACKUP"
)

type RuleEngine struct {
	nurses           map[string]NurseCalendar
	elders           map[string]ElderProfile
	districtDistance map[string]int
}

func NewRuleEngine() *RuleEngine {
	return &RuleEngine{
		nurses: make(map[string]NurseCalendar),
		elders: make(map[string]ElderProfile),
		districtDistance: map[string]int{
			"东城区-西城区": 30, "东城区-朝阳区": 25,
			"西城区-海淀区": 20, "朝阳区-海淀区": 35,
		},
	}
}

func (e *RuleEngine) LoadNurses(calendars []NurseCalendar) {
	for _, n := range calendars { e.nurses[n.NurseID] = n }
}

func (e *RuleEngine) LoadElders(profiles []ElderProfile) {
	for _, p := range profiles { e.elders[p.ElderID] = p }
}

func (e *RuleEngine) ValidateServiceOrder(order ServiceOrder) ([]FailureReason, []string) {
	var reasons []FailureReason
	var suggestions []string
	nurse, nurseExists := e.nurses[order.NurseID]
	elder, elderExists := e.elders[order.ElderID]

	if !order.IsCancelled {
		if !nurseExists {
			reasons = append(reasons, FailureReason{"NURSE_NOT_FOUND", "护士不存在",
				"系统中未找到该护士的日历信息", fmt.Sprintf("护士编号 %s 不存在", order.NurseID)})
			suggestions = append(suggestions, "请检查护士编号是否正确")
		} else {
			sr, ss := e.checkSkillMatch(order, nurse)
			reasons = append(reasons, sr...)
			suggestions = append(suggestions, ss...)
			dr, ds := e.checkDistrict(order, nurse, elder, elderExists)
			reasons = append(reasons, dr...)
			suggestions = append(suggestions, ds...)
			tr, ts := e.checkTimeAvailability(order, nurse)
			reasons = append(reasons, tr...)
			suggestions = append(suggestions, ts...)
		}
		if !elderExists {
			reasons = append(reasons, FailureReason{"ELDER_NOT_FOUND", "老人档案不存在",
				"系统中未找到该老人档案", fmt.Sprintf("老人编号 %s 不存在", order.ElderID)})
			suggestions = append(suggestions, "请检查老人编号")
		}
	} else {
		cr, cs := e.checkCancellationBackup(order, nurse, nurseExists)
		reasons = append(reasons, cr...)
		suggestions = append(suggestions, cs...)
	}
	return reasons, suggestions
}

func (e *RuleEngine) checkSkillMatch(order ServiceOrder, nurse NurseCalendar) ([]FailureReason, []string) {
	if order.RequiredSkill == "" { return nil, nil }
	required := strings.TrimSpace(order.RequiredSkill)
	reqLevel := SkillLevel(strings.ToLower(order.SkillLevel))

	var matched *SkillItem
	for i := range nurse.Skills {
		if strings.Contains(nurse.Skills[i].SkillName, required) ||
			strings.Contains(required, nurse.Skills[i].SkillName) {
			matched = &nurse.Skills[i]
			break
		}
	}
	if matched == nil {
		names := make([]string, len(nurse.Skills))
		for i, s := range nurse.Skills { names[i] = fmt.Sprintf("%s(%s)", s.SkillName, s.Level) }
		return []FailureReason{{RuleCodeSkillMismatch, "技能不匹配",
			"护士技能与服务所需技能不匹配",
			fmt.Sprintf("服务需要「%s」，但护士%s仅具备: %s", required, nurse.NurseName, strings.Join(names, "、")),
		}}, []string{fmt.Sprintf("建议更换具备「%s」技能的护士", required)}
	}
	if reqLevel != "" {
		lo := map[SkillLevel]int{SkillLevelBasic:1, SkillLevelIntermediate:2, SkillLevelAdvanced:3}
		if lo[matched.Level] < lo[reqLevel] {
			return []FailureReason{{RuleCodeSkillLevelInsufficient, "技能等级不足",
				"护士技能等级低于服务要求",
				fmt.Sprintf("服务要求「%s」，但护士%s的「%s」仅为「%s」",
					reqLevel, nurse.NurseName, matched.SkillName, matched.Level),
			}}, []string{fmt.Sprintf("建议更换高级别护士或安排%s升级培训", nurse.NurseName)}
		}
	}
	return nil, nil
}

func (e *RuleEngine) checkDistrict(order ServiceOrder, nurse NurseCalendar, elder ElderProfile, exists bool) ([]FailureReason, []string) {
	dist := order.District
	if dist == "" && exists { dist = elder.District }
	if dist != "" && nurse.WorkDistrict != "" && dist != nurse.WorkDistrict {
		key := fmt.Sprintf("%s-%s", nurse.WorkDistrict, dist)
		rev := fmt.Sprintf("%s-%s", dist, nurse.WorkDistrict)
		t := 45
		if v, ok := e.districtDistance[key]; ok { t = v } else if v, ok := e.districtDistance[rev]; ok { t = v }
		sug := fmt.Sprintf("可安排跨区，预留%d分钟路程", t)
		if t > 30 { sug = fmt.Sprintf("路程较长(%d分钟)，优先安排本区域护士", t) }
		return []FailureReason{{RuleCodeCrossDistrict, "跨区域服务",
			"护士工作区域与服务区域不一致",
			fmt.Sprintf("护士%s负责「%s」，服务在「%s」，路程约%d分钟",
				nurse.NurseName, nurse.WorkDistrict, dist, t),
		}}, []string{sug}
	}
	return nil, nil
}

func (e *RuleEngine) checkTimeAvailability(order ServiceOrder, nurse NurseCalendar) ([]FailureReason, []string) {
	var day *DaySchedule
	for i := range nurse.Calendar {
		if nurse.Calendar[i].Date == order.ServiceDate { day = &nurse.Calendar[i]; break }
	}
	if day == nil || !day.IsAvailable {
		return []FailureReason{{RuleCodeNurseUnavailable, "护士当日不可用",
			"护士当天不上班", fmt.Sprintf("护士%s在%s无排班", nurse.NurseName, order.ServiceDate),
		}}, []string{fmt.Sprintf("建议更换日期或其他护士")}
	}
	oStart, _ := time.Parse("15:04", order.StartTime)
	oEnd, _ := time.Parse("15:04", order.EndTime)
	for _, s := range day.TimeSlots {
		sStart, _ := time.Parse("15:04", s.StartTime)
		sEnd, _ := time.Parse("15:04", s.EndTime)
		if !(oEnd.Before(sStart) || oStart.After(sEnd)) {
			if s.Status == "occupied" || s.Status == "busy" {
				return []FailureReason{{RuleCodeTimeConflict, "时间冲突",
					"服务时间与已有排班冲突",
					fmt.Sprintf("护士%s在%s %s-%s已有安排", nurse.NurseName, order.ServiceDate, s.StartTime, s.EndTime),
				}}, []string{"建议调整时间或更换护士"}
			}
		}
	}
	return nil, nil
}

func (e *RuleEngine) checkCancellationBackup(order ServiceOrder, nurse NurseCalendar, exists bool) ([]FailureReason, []string) {
	var backup *NurseCalendar
	for _, n := range e.nurses {
		if n.NurseID == order.NurseID { continue }
		has := false
		for _, s := range n.Skills {
			if strings.Contains(s.SkillName, order.RequiredSkill) ||
				strings.Contains(order.RequiredSkill, s.SkillName) {
				has = true; break
			}
		}
		if has && n.WorkDistrict == order.District { backup = &n; break }
	}
	if backup == nil {
		return []FailureReason{{RuleCodeCancellationNoBackup, "取消后无补位护士",
			"服务取消后无备用护士",
			fmt.Sprintf("服务单%s已取消，未找到「%s」+「%s」的备用护士",
				order.ID, order.RequiredSkill, order.District),
		}}, []string{"紧急:联系其他站支援/调整时间/站长顶班"}
	}
	return nil, nil
}

func ParseServiceOrdersCSV(c string) ([]ServiceOrder, error) {
	r := csv.NewReader(strings.NewReader(c))
	rec, err := r.ReadAll()
	if err != nil { return nil, fmt.Errorf("CSV失败: %w", err) }
	if len(rec) < 2 { return nil, fmt.Errorf("CSV为空") }
	hm := make(map[string]int)
	for i, h := range rec[0] { hm[strings.TrimSpace(h)] = i }
	var res []ServiceOrder
	for _, row := range rec[1:] {
		getf := func(n string) string {
			if i, ok := hm[n]; ok && i < len(row) { return strings.TrimSpace(row[i]) }
			return ""
		}
		cancelled := false
		if v := getf("是否取消"); v != "" { cancelled = strings.ToLower(v) == "是" || v == "1" }
		res = append(res, ServiceOrder{
			ID: getf("服务单编号"), ElderID: getf("老人编号"), NurseID: getf("护士编号"),
			ServiceType: getf("服务类型"), RequiredSkill: getf("所需技能"), SkillLevel: getf("技能等级"),
			ServiceDate: getf("服务日期"), StartTime: getf("开始时间"), EndTime: getf("结束时间"),
			ServiceAddress: getf("服务地址"), District: getf("所在区域"), IsCancelled: cancelled,
			CancelReason: getf("取消原因"), Remark: getf("备注"),
		})
	}
	return res, nil
}

func ParseNurseCalendarJSON(c string) ([]NurseCalendar, error) {
	var list []NurseCalendar
	if err := json.Unmarshal([]byte(c), &list); err != nil {
		var single NurseCalendar
		if err2 := json.Unmarshal([]byte(c), &single); err2 != nil { return nil, err }
		list = []NurseCalendar{single}
	}
	return list, nil
}

func ParseElderProfilesCSV(c string) ([]ElderProfile, error) {
	r := csv.NewReader(strings.NewReader(c))
	rec, err := r.ReadAll()
	if err != nil { return nil, err }
	if len(rec) < 2 { return nil, nil }
	hm := make(map[string]int)
	for i, h := range rec[0] { hm[strings.TrimSpace(h)] = i }
	var res []ElderProfile
	for _, row := range rec[1:] {
		getf := func(n string) string {
			if i, ok := hm[n]; ok && i < len(row) { return strings.TrimSpace(row[i]) }
			return ""
		}
		age, _ := strconv.Atoi(getf("年龄"))
		care := []string{}
		if s := getf("所需护理项目"); s != "" {
			for _, item := range strings.Split(s, "、") {
				if item = strings.TrimSpace(item); item != "" { care = append(care, item) }
			}
		}
		res = append(res, ElderProfile{
			ElderID: getf("老人编号"), Name: getf("姓名"), Age: age, Gender: getf("性别"),
			Address: getf("地址"), District: getf("所在区域"), HealthLevel: getf("健康等级"),
			RequiredCare: care,
		})
	}
	return res, nil
}

func ServiceOrderToMap(o ServiceOrder) map[string]interface{} {
	return map[string]interface{}{
		"服务单编号": o.ID, "老人编号": o.ElderID, "护士编号": o.NurseID, "服务类型": o.ServiceType,
		"所需技能": o.RequiredSkill, "技能等级": o.SkillLevel, "服务日期": o.ServiceDate,
		"开始时间": o.StartTime, "结束时间": o.EndTime, "服务地址": o.ServiceAddress,
		"所在区域": o.District, "是否取消": o.IsCancelled, "取消原因": o.CancelReason, "备注": o.Remark,
	}
}

type BatchStorage struct {
	mu      sync.RWMutex
	batches map[string]Batch
	results map[string]ProcessResult
}

func NewBatchStorage() *BatchStorage {
	return &BatchStorage{batches: make(map[string]Batch), results: make(map[string]ProcessResult)}
}

func (s *BatchStorage) Checksum(a, b, c string) string {
	h := md5.Sum([]byte(a + "|" + b + "|" + c))
	return hex.EncodeToString(h[:])
}

func (s *BatchStorage) Dup(cs string) (bool, string) {
	s.mu.RLock(); defer s.mu.RUnlock()
	for id, b := range s.batches { if b.Checksum == cs { return true, id } }
	return false, ""
}

func (s *BatchStorage) SaveBatch(b Batch) { s.mu.Lock(); defer s.mu.Unlock(); s.batches[b.BatchID] = b }
func (s *BatchStorage) SaveResult(r ProcessResult) { s.mu.Lock(); defer s.mu.Unlock(); s.results[r.BatchID] = r }
func (s *BatchStorage) Result(id string) (ProcessResult, bool) { s.mu.RLock(); defer s.mu.RUnlock(); r, ok := s.results[id]; return r, ok }
func (s *BatchStorage) Batches() []Batch {
	s.mu.RLock(); defer s.mu.RUnlock()
	res := make([]Batch, 0, len(s.batches))
	for _, b := range s.batches { res = append(res, b) }
	return res
}

type Handler struct{ st *BatchStorage }

func NewHandler() *Handler { return &Handler{st: NewBatchStorage()} }

func (h *Handler) Upload(c *gin.Context) {
	var req UploadRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(400, gin.H{"error": "参数错误: " + err.Error()}); return
	}
	if req.ServiceOrders == "" && req.NurseCalendar == "" && req.ElderProfiles == "" {
		c.JSON(400, gin.H{"error": "至少上传一种文件"}); return
	}
	cs := h.st.Checksum(req.ServiceOrders, req.NurseCalendar, req.ElderProfiles)
	if dup, id := h.st.Dup(cs); dup {
		r, _ := h.st.Result(id)
		c.JSON(200, gin.H{"message": "已处理，返回历史结果", "batch_id": id, "is_duplicate": true, "result": r})
		return
	}
	bid := req.BatchID
	if bid == "" { bid = "BATCH-" + uuid.New().String()[:8] }
	h.st.SaveBatch(Batch{BatchID: bid, SubmittedAt: time.Now(), Checksum: cs, Status: "processing"})
	re := ProcessResult{}
	eng := NewRuleEngine()
	if req.NurseCalendar != "" {
		if ns, err := ParseNurseCalendarJSON(req.NurseCalendar); err == nil { eng.LoadNurses(ns) }
	}
	if req.ElderProfiles != "" {
		if es, err := ParseElderProfilesCSV(req.ElderProfiles); err == nil { eng.LoadElders(es) }
	}
	if req.ServiceOrders != "" {
		ords, err := ParseServiceOrdersCSV(req.ServiceOrders)
		if err != nil { c.JSON(500, gin.H{"error": err.Error(), "batch_id": bid}); return }
		for _, o := range ords {
			fr, sg := eng.ValidateServiceOrder(o)
			om := ServiceOrderToMap(o)
			if len(fr) == 0 {
				re.Normal = append(re.Normal, ResultItem{OriginalID: o.ID, Type: "service_order", Data: om})
			} else {
				crit := false
				for _, r := range fr {
					if r.RuleCode == RuleCodeSkillMismatch || r.RuleCode == RuleCodeNurseUnavailable { crit = true; break }
				}
				if crit {
					re.Failed = append(re.Failed, FailedItem{
						OriginalID: o.ID, Type: "service_order", OriginalData: om, FailureReasons: fr, Suggestions: sg,
					})
				} else {
					re.Pending = append(re.Pending, ResultItem{
						OriginalID: o.ID, Type: "service_order",
						Data: map[string]interface{}{"order": om, "warnings": fr, "suggestions": sg},
					})
				}
			}
		}
	}
	re.Summary = ResultSummary{
		TotalCount:   len(re.Normal) + len(re.Pending) + len(re.Failed),
		NormalCount:  len(re.Normal), PendingCount: len(re.Pending), FailedCount: len(re.Failed),
	}
	re.BatchID = bid
	re.ProcessedAt = time.Now()
	h.st.SaveResult(re)
	h.st.SaveBatch(Batch{BatchID: bid, SubmittedAt: time.Now(), Checksum: cs, Status: "completed"})
	c.JSON(200, gin.H{"batch_id": bid, "processed_at": re.ProcessedAt, "is_duplicate": false, "result": re})
}

func (h *Handler) GetResult(c *gin.Context) {
	if r, ok := h.st.Result(c.Param("batch_id")); ok { c.JSON(200, r)
	} else { c.JSON(404, gin.H{"error": "不存在"}) }
}

func (h *Handler) ListBatches(c *gin.Context) {
	bs := h.st.Batches()
	c.JSON(200, gin.H{"batches": bs, "count": len(bs)})
}

func main() {
	r := gin.Default()
	h := NewHandler()
	r.POST("/api/upload", h.Upload)
	r.GET("/api/result/:batch_id", h.GetResult)
	r.GET("/api/batches", h.ListBatches)
	log.Println("护理站排班API启动 :8080")
	log.Println("POST /api/upload - 上传数据")
	log.Println("GET  /api/result/:id - 查询结果")
	log.Fatal(r.Run(":8080"))
}
'''

with open('app/main.go', 'w', encoding='utf-8') as f:
    f.write(go_code)
print(f"Successfully wrote {len(go_code)} bytes to app/main.go")
