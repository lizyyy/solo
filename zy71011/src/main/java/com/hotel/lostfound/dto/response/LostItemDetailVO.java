package com.hotel.lostfound.dto.response;

import com.hotel.lostfound.entity.enums.ItemCategory;
import com.hotel.lostfound.entity.enums.LostItemStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class LostItemDetailVO {

    private Long id;

    private String itemNo;

    private String itemName;

    private String description;

    private ItemCategory category;

    private BigDecimal estimatedValue;

    private boolean isValuable;

    private boolean requireManagerReview;

    private String roomNumber;

    private String pickUpLocation;

    private String pickedByStaff;

    private String storageLocation;

    private LostItemStatus status;

    private LocalDateTime foundTime;

    private LocalDateTime expiredTime;

    private String ownerName;

    private String ownerPhone;

    private boolean verified;

    private String verifiedBy;

    private LocalDateTime verifiedAt;

    private String verifyRemark;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private List<ClaimRecordVO> claimRecords;

    private List<StatusHistoryVO> statusHistories;

    private List<MailRecordVO> mailRecords;

    private DisposalRecordVO disposalRecord;

    private List<SupplementRecordVO> supplementRecords;

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

    public List<ClaimRecordVO> getClaimRecords() {
        return claimRecords;
    }

    public void setClaimRecords(List<ClaimRecordVO> claimRecords) {
        this.claimRecords = claimRecords;
    }

    public List<StatusHistoryVO> getStatusHistories() {
        return statusHistories;
    }

    public void setStatusHistories(List<StatusHistoryVO> statusHistories) {
        this.statusHistories = statusHistories;
    }

    public List<MailRecordVO> getMailRecords() {
        return mailRecords;
    }

    public void setMailRecords(List<MailRecordVO> mailRecords) {
        this.mailRecords = mailRecords;
    }

    public DisposalRecordVO getDisposalRecord() {
        return disposalRecord;
    }

    public void setDisposalRecord(DisposalRecordVO disposalRecord) {
        this.disposalRecord = disposalRecord;
    }

    public List<SupplementRecordVO> getSupplementRecords() {
        return supplementRecords;
    }

    public void setSupplementRecords(List<SupplementRecordVO> supplementRecords) {
        this.supplementRecords = supplementRecords;
    }
}
