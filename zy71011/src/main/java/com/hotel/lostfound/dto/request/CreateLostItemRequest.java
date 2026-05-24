package com.hotel.lostfound.dto.request;

import com.hotel.lostfound.entity.enums.ItemCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class CreateLostItemRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotBlank(message = "物品名称不能为空")
    private String itemName;

    private String description;

    @NotNull(message = "物品分类不能为空")
    private ItemCategory category;

    private BigDecimal estimatedValue;

    private String roomNumber;

    private String pickUpLocation;

    @NotBlank(message = "拾取员工不能为空")
    private String pickedByStaff;

    private String storageLocation;

    @NotNull(message = "拾取时间不能为空")
    private LocalDateTime foundTime;

    private String ownerName;

    private String ownerPhone;

    @NotBlank(message = "操作人不能为空")
    private String operator;

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
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

    public LocalDateTime getFoundTime() {
        return foundTime;
    }

    public void setFoundTime(LocalDateTime foundTime) {
        this.foundTime = foundTime;
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

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }
}
