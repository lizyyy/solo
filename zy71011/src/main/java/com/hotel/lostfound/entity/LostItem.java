package com.hotel.lostfound.entity;

import com.hotel.lostfound.entity.enums.ItemCategory;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "lost_items")
public class LostItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String itemNo;

    @Column(nullable = false, length = 200)
    private String itemName;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ItemCategory category;

    @Column(precision = 10, scale = 2)
    private BigDecimal estimatedValue;

    private boolean isValuable;

    private boolean requireManagerReview;

    private String roomNumber;

    @Column(length = 100)
    private String pickUpLocation;

    @Column(nullable = false, length = 50)
    private String pickedByStaff;

    @Column(length = 100)
    private String storageLocation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LostItemStatus status;

    @Column(nullable = false)
    private LocalDateTime foundTime;

    private LocalDateTime expiredTime;

    @Column(length = 200)
    private String ownerName;

    @Column(length = 50)
    private String ownerPhone;

    private boolean verified;

    private String verifiedBy;

    private LocalDateTime verifiedAt;

    @Column(length = 500)
    private String verifyRemark;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "lostItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ClaimRecord> claimRecords = new ArrayList<>();

    @OneToMany(mappedBy = "lostItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StatusHistory> statusHistories = new ArrayList<>();

    @OneToMany(mappedBy = "lostItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MailRecord> mailRecords = new ArrayList<>();

    @OneToOne(mappedBy = "lostItem", cascade = CascadeType.ALL)
    private DisposalRecord disposalRecord;

    @Column(nullable = false)
    private String requestId;

    public void addStatusHistory(LostItemStatus fromStatus, LostItemStatus toStatus, String operator, String remark) {
        StatusHistory history = new StatusHistory();
        history.setLostItem(this);
        history.setFromStatus(fromStatus);
        history.setToStatus(toStatus);
        history.setOperator(operator);
        history.setRemark(remark);
        history.setOperateTime(LocalDateTime.now());
        this.statusHistories.add(history);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getItemNo() {
        return itemNo;
    }

    public void setItemNo(String itemNo) {
        this.itemNo = itemNo;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public ItemCategory getCategory() {
        return category;
    }

    public void setCategory(ItemCategory category) {
        this.category = category;
    }

    public BigDecimal getEstimatedValue() {
        return estimatedValue;
    }

    public void setEstimatedValue(BigDecimal estimatedValue) {
        this.estimatedValue = estimatedValue;
    }

    public boolean isValuable() {
        return isValuable;
    }

    public void setValuable(boolean valuable) {
        isValuable = valuable;
    }

    public boolean isRequireManagerReview() {
        return requireManagerReview;
    }

    public void setRequireManagerReview(boolean requireManagerReview) {
        this.requireManagerReview = requireManagerReview;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public String getPickUpLocation() {
        return pickUpLocation;
    }

    public void setPickUpLocation(String pickUpLocation) {
        this.pickUpLocation = pickUpLocation;
    }

    public String getPickedByStaff() {
        return pickedByStaff;
    }

    public void setPickedByStaff(String pickedByStaff) {
        this.pickedByStaff = pickedByStaff;
    }

    public String getStorageLocation() {
        return storageLocation;
    }

    public void setStorageLocation(String storageLocation) {
        this.storageLocation = storageLocation;
    }

    public LostItemStatus getStatus() {
        return status;
    }

    public void setStatus(LostItemStatus status) {
        this.status = status;
    }

    public LocalDateTime getFoundTime() {
        return foundTime;
    }

    public void setFoundTime(LocalDateTime foundTime) {
        this.foundTime = foundTime;
    }

    public LocalDateTime getExpiredTime() {
        return expiredTime;
    }

    public void setExpiredTime(LocalDateTime expiredTime) {
        this.expiredTime = expiredTime;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public String getOwnerPhone() {
        return ownerPhone;
    }

    public void setOwnerPhone(String ownerPhone) {
        this.ownerPhone = ownerPhone;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public String getVerifiedBy() {
        return verifiedBy;
    }

    public void setVerifiedBy(String verifiedBy) {
        this.verifiedBy = verifiedBy;
    }

    public LocalDateTime getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(LocalDateTime verifiedAt) {
        this.verifiedAt = verifiedAt;
    }

    public String getVerifyRemark() {
        return verifyRemark;
    }

    public void setVerifyRemark(String verifyRemark) {
        this.verifyRemark = verifyRemark;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<ClaimRecord> getClaimRecords() {
        return claimRecords;
    }

    public void setClaimRecords(List<ClaimRecord> claimRecords) {
        this.claimRecords = claimRecords;
    }

    public List<StatusHistory> getStatusHistories() {
        return statusHistories;
    }

    public void setStatusHistories(List<StatusHistory> statusHistories) {
        this.statusHistories = statusHistories;
    }

    public List<MailRecord> getMailRecords() {
        return mailRecords;
    }

    public void setMailRecords(List<MailRecord> mailRecords) {
        this.mailRecords = mailRecords;
    }

    public DisposalRecord getDisposalRecord() {
        return disposalRecord;
    }

    public void setDisposalRecord(DisposalRecord disposalRecord) {
        this.disposalRecord = disposalRecord;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }
}
