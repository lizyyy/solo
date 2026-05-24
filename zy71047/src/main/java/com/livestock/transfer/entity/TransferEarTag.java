package com.livestock.transfer.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "transfer_ear_tag", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"transfer_id", "ear_tag_id"})
})
public class TransferEarTag {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transfer_id", nullable = false)
    private Long transferId;

    @Column(name = "ear_tag_id", nullable = false)
    private Long earTagId;

    @Column(name = "tag_no", nullable = false)
    private String tagNo;

    @Column(name = "is_duplicate")
    private Boolean isDuplicate = false;

    @Column(name = "duplicate_within_order")
    private Boolean duplicateWithinOrder = false;

    @Column(name = "duplicate_across_order")
    private Boolean duplicateAcrossOrder = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTransferId() { return transferId; }
    public void setTransferId(Long transferId) { this.transferId = transferId; }
    public Long getEarTagId() { return earTagId; }
    public void setEarTagId(Long earTagId) { this.earTagId = earTagId; }
    public String getTagNo() { return tagNo; }
    public void setTagNo(String tagNo) { this.tagNo = tagNo; }
    public Boolean getIsDuplicate() { return isDuplicate; }
    public void setIsDuplicate(Boolean isDuplicate) { this.isDuplicate = isDuplicate; }
    public Boolean getDuplicateWithinOrder() { return duplicateWithinOrder; }
    public void setDuplicateWithinOrder(Boolean duplicateWithinOrder) { this.duplicateWithinOrder = duplicateWithinOrder; }
    public Boolean getDuplicateAcrossOrder() { return duplicateAcrossOrder; }
    public void setDuplicateAcrossOrder(Boolean duplicateAcrossOrder) { this.duplicateAcrossOrder = duplicateAcrossOrder; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
