package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"pv-inverter-warranty/service"
)

type Handler struct {
	service *service.WarrantyService
}

func NewHandler(s *service.WarrantyService) *Handler {
	return &Handler{service: s}
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"status":  "ok",
		"service": "光伏逆变器质保 API",
		"version": "1.0.0",
	})
}

func (h *Handler) SelfCheck(w http.ResponseWriter, r *http.Request) {
	result, err := h.service.SelfCheck()
	if err != nil {
		respondJSON(w, service.JSONError("自检失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(result))
}

func (h *Handler) RegisterInverter(w http.ResponseWriter, r *http.Request) {
	var inv service.Inverter
	if err := json.NewDecoder(r.Body).Decode(&inv); err != nil {
		respondJSON(w, service.JSONError("参数错误", err))
		return
	}
	if err := h.service.RegisterInverter(&inv); err != nil {
		respondJSON(w, service.JSONError("登记逆变器失败", err))
		return
	}
	respondJSON(w, service.JSONResponseWithMessage(inv, "逆变器登记成功"))
}

func (h *Handler) GetInverter(w http.ResponseWriter, r *http.Request) {
	sn := mux.Vars(r)["sn"]
	inv, err := h.service.GetInverter(sn)
	if err != nil {
		respondJSON(w, service.JSONError("查询逆变器失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(inv))
}

func (h *Handler) ListInverters(w http.ResponseWriter, r *http.Request) {
	inverters, err := h.service.ListInverters()
	if err != nil {
		respondJSON(w, service.JSONError("查询逆变器列表失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(inverters))
}

func (h *Handler) RegisterFaultCode(w http.ResponseWriter, r *http.Request) {
	var fc service.FaultCode
	if err := json.NewDecoder(r.Body).Decode(&fc); err != nil {
		respondJSON(w, service.JSONError("参数错误", err))
		return
	}
	if err := h.service.RegisterFaultCode(&fc); err != nil {
		respondJSON(w, service.JSONError("登记故障码失败", err))
		return
	}
	respondJSON(w, service.JSONResponseWithMessage(fc, "故障码登记成功"))
}

func (h *Handler) ListFaultCodes(w http.ResponseWriter, r *http.Request) {
	codes, err := h.service.ListFaultCodes()
	if err != nil {
		respondJSON(w, service.JSONError("查询故障码列表失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(codes))
}

func (h *Handler) RegisterSparePart(w http.ResponseWriter, r *http.Request) {
	var sp service.SparePart
	if err := json.NewDecoder(r.Body).Decode(&sp); err != nil {
		respondJSON(w, service.JSONError("参数错误", err))
		return
	}
	result, err := h.service.RegisterSparePart(&sp)
	if err != nil {
		respondJSON(w, service.JSONError("登记备件失败", err))
		return
	}
	respondJSON(w, service.JSONResponseWithMessage(result, "备件登记成功，序列号去重校验通过"))
}

func (h *Handler) GetSparePart(w http.ResponseWriter, r *http.Request) {
	sn := mux.Vars(r)["sn"]
	sp, err := h.service.GetSparePart(sn)
	if err != nil {
		respondJSON(w, service.JSONError("查询备件失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(sp))
}

func (h *Handler) ListSpareParts(w http.ResponseWriter, r *http.Request) {
	parts, err := h.service.ListSpareParts()
	if err != nil {
		respondJSON(w, service.JSONError("查询备件列表失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(parts))
}

func (h *Handler) RegisterFactoryOrder(w http.ResponseWriter, r *http.Request) {
	var fo service.FactoryOrder
	if err := json.NewDecoder(r.Body).Decode(&fo); err != nil {
		respondJSON(w, service.JSONError("参数错误", err))
		return
	}
	if err := h.service.RegisterFactoryOrder(&fo); err != nil {
		respondJSON(w, service.JSONError("登记厂家工单失败", err))
		return
	}
	respondJSON(w, service.JSONResponseWithMessage(fo, "厂家工单登记成功"))
}

func (h *Handler) GetFactoryOrder(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	fo, err := h.service.GetFactoryOrder(id)
	if err != nil {
		respondJSON(w, service.JSONError("查询厂家工单失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(fo))
}

func (h *Handler) ListFactoryOrders(w http.ResponseWriter, r *http.Request) {
	orders, err := h.service.ListFactoryOrders()
	if err != nil {
		respondJSON(w, service.JSONError("查询厂家工单列表失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(orders))
}

func (h *Handler) CreateReplacement(w http.ResponseWriter, r *http.Request) {
	var rep service.Replacement
	if err := json.NewDecoder(r.Body).Decode(&rep); err != nil {
		respondJSON(w, service.JSONError("参数错误", err))
		return
	}
	result, err := h.service.CreateReplacement(&rep)
	if err != nil {
		respondJSON(w, service.JSONError("创建更换记录失败", err))
		return
	}
	respondJSON(w, service.JSONResponseWithMessage(result, "更换记录创建成功，已初始化证据链"))
}

func (h *Handler) GetReplacement(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	rep, err := h.service.GetReplacement(id)
	if err != nil {
		respondJSON(w, service.JSONError("查询更换记录失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(rep))
}

func (h *Handler) ListReplacements(w http.ResponseWriter, r *http.Request) {
	reps, err := h.service.ListReplacements()
	if err != nil {
		respondJSON(w, service.JSONError("查询更换记录列表失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(reps))
}

func (h *Handler) VerifyReplacement(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var req service.VerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, service.JSONError("参数错误", err))
		return
	}
	result, err := h.service.VerifyReplacement(id, &req)
	if err != nil {
		respondJSON(w, service.JSONError("明细核对失败", err))
		return
	}
	respondJSON(w, service.JSONResponseWithMessage(map[string]string{
		"verification_notes": result,
		"status":             "verified",
	}, "明细核对完成，质保规则校验通过"))
}

func (h *Handler) ReviewReplacement(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var req service.ReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, service.JSONError("参数错误", err))
		return
	}
	if err := h.service.ReviewReplacement(id, &req); err != nil {
		respondJSON(w, service.JSONError("人工复核失败", err))
		return
	}
	status := "reviewed"
	if !req.Approved {
		status = "rejected"
	}
	respondJSON(w, service.JSONResponseWithMessage(map[string]string{
		"status": status,
	}, "人工复核完成，状态已流转"))
}

func (h *Handler) AcceptReplacement(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var req service.AcceptanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, service.JSONError("参数错误", err))
		return
	}
	if err := h.service.AcceptReplacement(id, &req); err != nil {
		respondJSON(w, service.JSONError("验收失败", err))
		return
	}
	status := "accepted"
	if !req.Approved {
		status = "rejected"
	}
	respondJSON(w, service.JSONResponseWithMessage(map[string]string{
		"status": status,
	}, "验收完成，已留痕记录，质保报告已生成"))
}

func (h *Handler) RejectReplacement(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var req service.AcceptanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, service.JSONError("参数错误", err))
		return
	}
	if err := h.service.RejectReplacement(id, &req); err != nil {
		respondJSON(w, service.JSONError("驳回失败", err))
		return
	}
	respondJSON(w, service.JSONResponseWithMessage(map[string]string{
		"status": "rejected",
	}, "已驳回，状态流转记录已保存"))
}

func (h *Handler) UpdateEvidence(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var req service.EvidenceUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, service.JSONError("参数错误", err))
		return
	}
	if err := h.service.UpdateEvidence(id, &req); err != nil {
		respondJSON(w, service.JSONError("更新证据失败", err))
		return
	}
	respondJSON(w, service.JSONResponseWithMessage(map[string]string{
		"evidence_type": req.EvidenceType,
	}, "证据链已更新，仅更新证据不产生新业务记录"))
}

func (h *Handler) GetWarrantyReport(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	rpt, err := h.service.GetWarrantyReport(id)
	if err != nil {
		respondJSON(w, service.JSONError("查询质保报告失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(rpt))
}

func (h *Handler) ExportWarrantyReport(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	rpt, err := h.service.GetWarrantyReport(id)
	if err != nil {
		respondJSON(w, service.JSONError("导出质保报告失败", err))
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename="+rpt.ReportNumber+".txt")
	w.Write([]byte(rpt.Content))
}

func (h *Handler) ListWarrantyReports(w http.ResponseWriter, r *http.Request) {
	reports, err := h.service.ListWarrantyReports()
	if err != nil {
		respondJSON(w, service.JSONError("查询质保报告列表失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(reports))
}

func (h *Handler) GetSummaryReport(w http.ResponseWriter, r *http.Request) {
	summary, err := h.service.GetSummaryReport()
	if err != nil {
		respondJSON(w, service.JSONError("生成汇总报告失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(summary))
}

func (h *Handler) TraceRecord(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	result, err := h.service.TraceRecord(id)
	if err != nil {
		respondJSON(w, service.JSONError("追溯失败", err))
		return
	}
	respondJSON(w, service.JSONResponse(result))
}
