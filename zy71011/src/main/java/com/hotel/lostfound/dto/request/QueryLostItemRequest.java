package com.hotel.lostfound.dto.request;

import com.hotel.lostfound.entity.enums.ItemCategory;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
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
}
