package com.hotel.lostfound.dto.response;

import com.hotel.lostfound.entity.enums.ItemCategory;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class LostItemListVO {

    private Long id;

    private String itemNo;

    private String itemName;

    private ItemCategory category;

    private BigDecimal estimatedValue;

    private boolean isValuable;

    private String roomNumber;

    private String pickedByStaff;

    private LostItemStatus status;

    private LocalDateTime foundTime;

    private LocalDateTime expiredTime;

    private String ownerName;

    private boolean verified;

    private LocalDateTime createdAt;
}
