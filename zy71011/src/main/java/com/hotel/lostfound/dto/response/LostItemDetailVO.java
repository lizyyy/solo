package com.hotel.lostfound.dto.response;

import com.hotel.lostfound.entity.enums.ItemCategory;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
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
}
