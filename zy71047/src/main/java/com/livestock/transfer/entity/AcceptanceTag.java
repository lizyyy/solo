package com.livestock.transfer.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "acceptance_tag")
public class AcceptanceTag {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "acceptance_id", nullable = false)
    private Long acceptanceId;

    @Column(name = "transfer_ear_tag_id")
    private Long transferEarTagId;

    @Column(name = "tag_no", nullable = false)
    private String tagNo;

    @Column(name = "is_matched")
    private Boolean isMatched = false;

    @Column(name = "is_extra")
    private Boolean isExtra = false;

    @Column(name = "is_missing")
    private Boolean isMissing = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getAcceptanceId() { return acceptanceId; }
    public void setAcceptanceId(Long acceptanceId) { this.acceptanceId = acceptanceId; }
    public Long getTransferEarTagId() { return transferEarTagId; }
    public void setTransferEarTagId(Long transferEarTagId) { this.transferEarTagId = transferEarTagId; }
    public String getTagNo() { return tagNo; }
    public void setTagNo(String tagNo) { this.tagNo = tagNo; }
    public Boolean getIsMatched() { return isMatched; }
    public void setIsMatched(Boolean isMatched) { this.isMatched = isMatched; }
    public Boolean getIsExtra() { return isExtra; }
    public void setIsExtra(Boolean isExtra) { this.isExtra = isExtra; }
    public Boolean getIsMissing() { return isMissing; }
    public void setIsMissing(Boolean isMissing) { this.isMissing = isMissing; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
