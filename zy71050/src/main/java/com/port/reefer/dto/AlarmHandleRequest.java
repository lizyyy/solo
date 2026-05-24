package com.port.reefer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class AlarmHandleRequest {
    @NotNull(message = "报警记录ID不能为空")
    private Long alarmId;

    @NotBlank(message = "巡检人工号不能为空")
    private String inspectorBadge;

    private String action;

    private String resolutionNotes;

    private String remarks;

    public Long getAlarmId() { return alarmId; }
    public void setAlarmId(Long alarmId) { this.alarmId = alarmId; }
    public String getInspectorBadge() { return inspectorBadge; }
    public void setInspectorBadge(String inspectorBadge) { this.inspectorBadge = inspectorBadge; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
