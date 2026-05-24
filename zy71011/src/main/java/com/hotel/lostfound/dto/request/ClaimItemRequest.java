package com.hotel.lostfound.dto.request;

import com.hotel.lostfound.entity.enums.IdType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public class ClaimItemRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotNull(message = "物品ID不能为空")
    private Long itemId;

    @NotBlank(message = "认领人姓名不能为空")
    private String claimantName;

    @NotBlank(message = "认领人电话不能为空")
    private String claimantPhone;

    @NotNull(message = "证件类型不能为空")
    private IdType idType;

    @NotBlank(message = "证件号码不能为空")
    private String idNumber;

    private String idImageUrl;

    private String relation;

    private String itemDescription;

    private boolean identificationVerified;

    private boolean itemDescriptionMatched;

    private boolean approved;

    private String approveRemark;

    @NotBlank(message = "处理人不能为空")
    private String handledBy;

    @NotNull(message = "认领时间不能为空")
    private LocalDateTime claimTime;

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public Long getItemId() {
        return itemId;
    }

    public void setItemId(Long itemId) {
        this.itemId = itemId;
    }

    public String getClaimantName() {
        return claimantName;
    }

    public void setClaimantName(String claimantName) {
        this.claimantName = claimantName;
    }

    public String getClaimantPhone() {
        return claimantPhone;
    }

    public void setClaimantPhone(String claimantPhone) {
        this.claimantPhone = claimantPhone;
    }

    public IdType getIdType() {
        return idType;
    }

    public void setIdType(IdType idType) {
        this.idType = idType;
    }

    public String getIdNumber() {
        return idNumber;
    }

    public void setIdNumber(String idNumber) {
        this.idNumber = idNumber;
    }

    public String getIdImageUrl() {
        return idImageUrl;
    }

    public void setIdImageUrl(String idImageUrl) {
        this.idImageUrl = idImageUrl;
    }

    public String getRelation() {
        return relation;
    }

    public void setRelation(String relation) {
        this.relation = relation;
    }

    public String getItemDescription() {
        return itemDescription;
    }

    public void setItemDescription(String itemDescription) {
        this.itemDescription = itemDescription;
    }

    public boolean isIdentificationVerified() {
        return identificationVerified;
    }

    public void setIdentificationVerified(boolean identificationVerified) {
        this.identificationVerified = identificationVerified;
    }

    public boolean isItemDescriptionMatched() {
        return itemDescriptionMatched;
    }

    public void setItemDescriptionMatched(boolean itemDescriptionMatched) {
        this.itemDescriptionMatched = itemDescriptionMatched;
    }

    public boolean isApproved() {
        return approved;
    }

    public void setApproved(boolean approved) {
        this.approved = approved;
    }

    public String getApproveRemark() {
        return approveRemark;
    }

    public void setApproveRemark(String approveRemark) {
        this.approveRemark = approveRemark;
    }

    public String getHandledBy() {
        return handledBy;
    }

    public void setHandledBy(String handledBy) {
        this.handledBy = handledBy;
    }

    public LocalDateTime getClaimTime() {
        return claimTime;
    }

    public void setClaimTime(LocalDateTime claimTime) {
        this.claimTime = claimTime;
    }
}
