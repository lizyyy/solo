package com.hotel.lostfound.dto.response;

import com.hotel.lostfound.entity.enums.IdType;

import java.time.LocalDateTime;

public class ClaimRecordVO {

    private Long id;

    private String claimantName;

    private String claimantPhone;

    private IdType idType;

    private String idNumber;

    private String relation;

    private boolean identificationVerified;

    private boolean itemDescriptionMatched;

    private boolean approved;

    private String approvedBy;

    private LocalDateTime approvedAt;

    private String approveRemark;

    private String handledBy;

    private LocalDateTime claimTime;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public String getRelation() {
        return relation;
    }

    public void setRelation(String relation) {
        this.relation = relation;
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

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
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
