package com.hotel.lostfound.dto.request;

import com.hotel.lostfound.entity.enums.ItemCategory;
import com.hotel.lostfound.entity.enums.LostItemStatus;

import java.time.LocalDateTime;

public class QueryLostItemRequest {

    private String itemNo;

    private String itemName;

    private ItemCategory category;

    private LostItemStatus status;

    private String roomNumber;

    private String pickedByStaff;

    private String ownerPhone;

    private Boolean isValuable;

    private LocalDateTime foundTimeStart;

    private LocalDateTime foundTimeEnd;

    private Integer pageNum = 1;

    private Integer pageSize = 20;

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

    public ItemCategory getCategory() {
        return category;
    }

    public void setCategory(ItemCategory category) {
        this.category = category;
    }

    public LostItemStatus getStatus() {
        return status;
    }

    public void setStatus(LostItemStatus status) {
        this.status = status;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public String getPickedByStaff() {
        return pickedByStaff;
    }

    public void setPickedByStaff(String pickedByStaff) {
        this.pickedByStaff = pickedByStaff;
    }

    public String getOwnerPhone() {
        return ownerPhone;
    }

    public void setOwnerPhone(String ownerPhone) {
        this.ownerPhone = ownerPhone;
    }

    public Boolean getIsValuable() {
        return isValuable;
    }

    public void setIsValuable(Boolean valuable) {
        isValuable = valuable;
    }

    public LocalDateTime getFoundTimeStart() {
        return foundTimeStart;
    }

    public void setFoundTimeStart(LocalDateTime foundTimeStart) {
        this.foundTimeStart = foundTimeStart;
    }

    public LocalDateTime getFoundTimeEnd() {
        return foundTimeEnd;
    }

    public void setFoundTimeEnd(LocalDateTime foundTimeEnd) {
        this.foundTimeEnd = foundTimeEnd;
    }

    public Integer getPageNum() {
        return pageNum;
    }

    public void setPageNum(Integer pageNum) {
        this.pageNum = pageNum;
    }

    public Integer getPageSize() {
        return pageSize;
    }

    public void setPageSize(Integer pageSize) {
        this.pageSize = pageSize;
    }
}
