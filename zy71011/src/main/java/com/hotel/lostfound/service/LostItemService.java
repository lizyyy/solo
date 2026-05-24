package com.hotel.lostfound.service;

import com.hotel.lostfound.dto.request.*;
import com.hotel.lostfound.dto.response.*;
import com.hotel.lostfound.entity.*;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import com.hotel.lostfound.exception.BusinessException;
import com.hotel.lostfound.repository.*;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class LostItemService {

    private static final Logger log = LoggerFactory.getLogger(LostItemService.class);

    private final LostItemRepository lostItemRepository;
    private final ClaimRecordRepository claimRecordRepository;
    private final MailRecordRepository mailRecordRepository;
    private final DisposalRecordRepository disposalRecordRepository;
    private final SupplementRecordRepository supplementRecordRepository;
    private final StatusMachineService statusMachineService;
    private final IdempotentService idempotentService;

    public LostItemService(LostItemRepository lostItemRepository,
                          ClaimRecordRepository claimRecordRepository,
                          MailRecordRepository mailRecordRepository,
                          DisposalRecordRepository disposalRecordRepository,
                          SupplementRecordRepository supplementRecordRepository,
                          StatusMachineService statusMachineService,
                          IdempotentService idempotentService) {
        this.lostItemRepository = lostItemRepository;
        this.claimRecordRepository = claimRecordRepository;
        this.mailRecordRepository = mailRecordRepository;
        this.disposalRecordRepository = disposalRecordRepository;
        this.supplementRecordRepository = supplementRecordRepository;
        this.statusMachineService = statusMachineService;
        this.idempotentService = idempotentService;
    }

    @Value("${app.lost-item.expired-days:90}")
    private int expiredDays;

    @Value("${app.lost-item.valuable-amount:500}")
    private BigDecimal valuableAmount;

    @Transactional
    public LostItemDetailVO createLostItem(CreateLostItemRequest request) {
        String operationType = "CREATE_LOST_ITEM";
        idempotentService.checkDuplicate(request.getRequestId(), operationType);

        String itemNo = generateItemNo();
        
        LostItem item = new LostItem();
        BeanUtils.copyProperties(request, item);
        item.setItemNo(itemNo);
        item.setStatus(LostItemStatus.REGISTERED);
        item.setRequestId(request.getRequestId());
        item.setVerified(false);
        item.setExpiredTime(request.getFoundTime().plusDays(expiredDays));
        
        if (request.getEstimatedValue() != null && 
            request.getEstimatedValue().compareTo(valuableAmount) >= 0) {
            item.setValuable(true);
            item.setRequireManagerReview(true);
        }

        item.addStatusHistory(null, LostItemStatus.REGISTERED, request.getOperator(), "新建遗失物品登记");

        LostItem saved = lostItemRepository.save(item);
        LostItemDetailVO result = convertToDetailVO(saved);
        
        idempotentService.recordResult(request.getRequestId(), operationType, result, true);
        return result;
    }

    @Transactional
    public LostItemDetailVO verifyItem(VerifyItemRequest request) {
        String operationType = "VERIFY_ITEM";
        idempotentService.checkDuplicate(request.getRequestId(), operationType);

        LostItem item = getLostItemById(request.getItemId());

        if (!statusMachineService.canVerify(item.getStatus())) {
            throw new BusinessException("当前状态不允许审核");
        }

        if (item.isValuable() && !request.isVerified()) {
            throw new BusinessException("贵重物品必须审核通过");
        }

        item.setVerified(request.isVerified());
        item.setVerifiedBy(request.getVerifier());
        item.setVerifiedAt(LocalDateTime.now());
        item.setVerifyRemark(request.getVerifyRemark());
        
        if (request.getOwnerName() != null) {
            item.setOwnerName(request.getOwnerName());
        }
        if (request.getOwnerPhone() != null) {
            item.setOwnerPhone(request.getOwnerPhone());
        }

        if (request.isVerified()) {
            statusMachineService.transition(item, LostItemStatus.VERIFIED, 
                    request.getVerifier(), "物品审核通过");
        } else {
            statusMachineService.transition(item, LostItemStatus.REGISTERED, 
                    request.getVerifier(), "物品审核未通过，需补充信息");
        }

        LostItem saved = lostItemRepository.save(item);
        LostItemDetailVO result = convertToDetailVO(saved);
        
        idempotentService.recordResult(request.getRequestId(), operationType, result, true);
        return result;
    }

    @Transactional
    public ClaimRecordVO claimItem(ClaimItemRequest request) {
        String operationType = "CLAIM_ITEM";
        idempotentService.checkDuplicate(request.getRequestId(), operationType);

        LostItem item = getLostItemById(request.getItemId());

        if (!statusMachineService.canClaim(item.getStatus())) {
            throw new BusinessException("当前状态不允许认领");
        }

        if (claimRecordRepository.existsByLostItemIdAndApprovedTrue(item.getId())) {
            throw new BusinessException("该物品已被认领，不可重复认领");
        }

        if (!request.isIdentificationVerified()) {
            throw new BusinessException("身份未核验，无法完成认领");
        }

        ClaimRecord record = new ClaimRecord();
        BeanUtils.copyProperties(request, record);
        record.setLostItem(item);
        record.setRequestId(request.getRequestId());

        if (request.isApproved()) {
            record.setApprovedBy(request.getHandledBy());
            record.setApprovedAt(LocalDateTime.now());
            statusMachineService.transition(item, LostItemStatus.CLAIMED, 
                    request.getHandledBy(), "物品已被认领，认领人: " + request.getClaimantName());
            lostItemRepository.save(item);
        }

        ClaimRecord saved = claimRecordRepository.save(record);
        ClaimRecordVO result = convertToClaimRecordVO(saved);
        
        idempotentService.recordResult(request.getRequestId(), operationType, result, true);
        return result;
    }

    @Transactional
    public MailRecordVO mailItem(MailItemRequest request) {
        String operationType = "MAIL_ITEM";
        idempotentService.checkDuplicate(request.getRequestId(), operationType);

        LostItem item = getLostItemById(request.getItemId());

        if (!statusMachineService.canClaim(item.getStatus())) {
            throw new BusinessException("当前状态不允许邮寄");
        }

        if (mailRecordRepository.findByTrackingNumber(request.getTrackingNumber()).isPresent()) {
            throw new BusinessException("快递单号已存在");
        }

        MailRecord record = new MailRecord();
        BeanUtils.copyProperties(request, record);
        record.setLostItem(item);
        record.setRequestId(request.getRequestId());

        statusMachineService.transition(item, LostItemStatus.MAILED, 
                request.getHandledBy(), "物品已邮寄，快递单号: " + request.getTrackingNumber());
        lostItemRepository.save(item);

        MailRecord saved = mailRecordRepository.save(record);
        MailRecordVO result = convertToMailRecordVO(saved);
        
        idempotentService.recordResult(request.getRequestId(), operationType, result, true);
        return result;
    }

    @Transactional
    public DisposalRecordVO disposeItem(DisposeItemRequest request) {
        String operationType = "DISPOSE_ITEM";
        idempotentService.checkDuplicate(request.getRequestId(), operationType);

        LostItem item = getLostItemById(request.getItemId());

        if (!statusMachineService.canDispose(item.getStatus())) {
            throw new BusinessException("当前状态不允许处置");
        }

        if (disposalRecordRepository.existsByLostItemId(item.getId())) {
            throw new BusinessException("该物品已有处置记录");
        }

        if (item.isRequireManagerReview() && !request.isManagerApproved()) {
            throw new BusinessException("贵重物品处置需要经理审批");
        }

        DisposalRecord record = new DisposalRecord();
        BeanUtils.copyProperties(request, record);
        record.setLostItem(item);
        record.setRequestId(request.getRequestId());

        if (request.isManagerApproved()) {
            record.setApprovedBy(request.getApprovedBy());
            record.setApprovedAt(LocalDateTime.now());
        }

        statusMachineService.transition(item, LostItemStatus.DISPOSED, 
                request.getHandledBy(), "物品已处置，处置方式: " + request.getDisposalType());
        lostItemRepository.save(item);

        DisposalRecord saved = disposalRecordRepository.save(record);
        DisposalRecordVO result = convertToDisposalRecordVO(saved);
        
        idempotentService.recordResult(request.getRequestId(), operationType, result, true);
        return result;
    }

    @Transactional
    public SupplementRecordVO supplement(SupplementRequest request) {
        String operationType = "SUPPLEMENT";
        idempotentService.checkDuplicate(request.getRequestId(), operationType);

        LostItem item = getLostItemById(request.getItemId());

        SupplementRecord record = new SupplementRecord();
        BeanUtils.copyProperties(request, record);
        record.setLostItem(item);
        record.setRequestId(request.getRequestId());

        SupplementRecord saved = supplementRecordRepository.save(record);
        SupplementRecordVO result = convertToSupplementRecordVO(saved);
        
        idempotentService.recordResult(request.getRequestId(), operationType, result, true);
        return result;
    }

    @Transactional(readOnly = true)
    public Page<LostItemListVO> queryLostItems(QueryLostItemRequest request) {
        Pageable pageable = PageRequest.of(
                request.getPageNum() - 1,
                request.getPageSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Specification<LostItem> spec = buildSpecification(request);
        Page<LostItem> page = lostItemRepository.findAll(spec, pageable);
        
        return page.map(this::convertToListVO);
    }

    @Transactional(readOnly = true)
    public LostItemDetailVO getLostItemDetail(Long id) {
        LostItem item = getLostItemById(id);
        return convertToDetailVO(item);
    }

    @Transactional(readOnly = true)
    public List<LostItemListVO> getExpiringItems() {
        LocalDateTime warningTime = LocalDateTime.now().plusDays(7);
        return lostItemRepository.findAll().stream()
                .filter(item -> item.getExpiredTime() != null && 
                        item.getExpiredTime().isBefore(warningTime) &&
                        !statusMachineService.isTerminated(item.getStatus()))
                .map(this::convertToListVO)
                .collect(Collectors.toList());
    }

    private LostItem getLostItemById(Long id) {
        return lostItemRepository.findById(id)
                .orElseThrow(() -> new BusinessException("物品不存在"));
    }

    private String generateItemNo() {
        String prefix = "LF" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = lostItemRepository.count() + 1;
        return prefix + String.format("%04d", count);
    }

    private Specification<LostItem> buildSpecification(QueryLostItemRequest request) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (request.getItemNo() != null) {
                predicates.add(cb.like(root.get("itemNo"), "%" + request.getItemNo() + "%"));
            }
            if (request.getItemName() != null) {
                predicates.add(cb.like(root.get("itemName"), "%" + request.getItemName() + "%"));
            }
            if (request.getCategory() != null) {
                predicates.add(cb.equal(root.get("category"), request.getCategory()));
            }
            if (request.getStatus() != null) {
                predicates.add(cb.equal(root.get("status"), request.getStatus()));
            }
            if (request.getRoomNumber() != null) {
                predicates.add(cb.equal(root.get("roomNumber"), request.getRoomNumber()));
            }
            if (request.getPickedByStaff() != null) {
                predicates.add(cb.equal(root.get("pickedByStaff"), request.getPickedByStaff()));
            }
            if (request.getOwnerPhone() != null) {
                predicates.add(cb.equal(root.get("ownerPhone"), request.getOwnerPhone()));
            }
            if (request.getIsValuable() != null) {
                predicates.add(cb.equal(root.get("isValuable"), request.getIsValuable()));
            }
            if (request.getFoundTimeStart() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("foundTime"), request.getFoundTimeStart()));
            }
            if (request.getFoundTimeEnd() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("foundTime"), request.getFoundTimeEnd()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private LostItemDetailVO convertToDetailVO(LostItem item) {
        LostItemDetailVO vo = new LostItemDetailVO();
        BeanUtils.copyProperties(item, vo);
        
        if (!item.getClaimRecords().isEmpty()) {
            vo.setClaimRecords(item.getClaimRecords().stream()
                    .map(this::convertToClaimRecordVO)
                    .collect(Collectors.toList()));
        }
        if (!item.getStatusHistories().isEmpty()) {
            vo.setStatusHistories(item.getStatusHistories().stream()
                    .map(this::convertToStatusHistoryVO)
                    .collect(Collectors.toList()));
        }
        if (!item.getMailRecords().isEmpty()) {
            vo.setMailRecords(item.getMailRecords().stream()
                    .map(this::convertToMailRecordVO)
                    .collect(Collectors.toList()));
        }
        if (item.getDisposalRecord() != null) {
            vo.setDisposalRecord(convertToDisposalRecordVO(item.getDisposalRecord()));
        }
        
        return vo;
    }

    private LostItemListVO convertToListVO(LostItem item) {
        LostItemListVO vo = new LostItemListVO();
        BeanUtils.copyProperties(item, vo);
        return vo;
    }

    private ClaimRecordVO convertToClaimRecordVO(ClaimRecord record) {
        ClaimRecordVO vo = new ClaimRecordVO();
        BeanUtils.copyProperties(record, vo);
        return vo;
    }

    private StatusHistoryVO convertToStatusHistoryVO(StatusHistory history) {
        StatusHistoryVO vo = new StatusHistoryVO();
        BeanUtils.copyProperties(history, vo);
        return vo;
    }

    private MailRecordVO convertToMailRecordVO(MailRecord record) {
        MailRecordVO vo = new MailRecordVO();
        BeanUtils.copyProperties(record, vo);
        return vo;
    }

    private DisposalRecordVO convertToDisposalRecordVO(DisposalRecord record) {
        DisposalRecordVO vo = new DisposalRecordVO();
        BeanUtils.copyProperties(record, vo);
        return vo;
    }

    private SupplementRecordVO convertToSupplementRecordVO(SupplementRecord record) {
        SupplementRecordVO vo = new SupplementRecordVO();
        BeanUtils.copyProperties(record, vo);
        return vo;
    }
}
