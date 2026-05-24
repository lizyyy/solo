package com.ski.rental.dto;

import com.ski.rental.enums.DamageLevel;
import com.ski.rental.model.InspectionItem;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.util.List;

public class ReturnInspectionRequest {
    @NotBlank(message = "订单号不能为空")
    private String orderNo;

    private DamageLevel overallDamageLevel;
    private List<InspectionItem> inspectionItems;
    private BigDecimal estimatedDamageFee;
    private String inspectorNote;
    private String inspector;

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public DamageLevel getOverallDamageLevel() {
        return overallDamageLevel;
    }

    public void setOverallDamageLevel(DamageLevel overallDamageLevel) {
        this.overallDamageLevel = overallDamageLevel;
    }

    public List<InspectionItem> getInspectionItems() {
        return inspectionItems;
    }

    public void setInspectionItems(List<InspectionItem> inspectionItems) {
        this.inspectionItems = inspectionItems;
    }

    public BigDecimal getEstimatedDamageFee() {
        return estimatedDamageFee;
    }

    public void setEstimatedDamageFee(BigDecimal estimatedDamageFee) {
        this.estimatedDamageFee = estimatedDamageFee;
    }

    public String getInspectorNote() {
        return inspectorNote;
    }

    public void setInspectorNote(String inspectorNote) {
        this.inspectorNote = inspectorNote;
    }

    public String getInspector() {
        return inspector;
    }

    public void setInspector(String inspector) {
        this.inspector = inspector;
    }
}
