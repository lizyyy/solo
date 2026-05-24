package com.hotel.lostfound.dto.request;

import com.hotel.lostfound.entity.enums.ItemCategory;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;

public class ExportRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    private String itemNo;

    private String itemName;

    private ItemCategory category;

    private LostItemStatus status;

    private String roomNumber;

    private String pickedByStaff;

    private LocalDateTime foundTimeStart;

    private LocalDateTime foundTimeEnd;

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
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
}
