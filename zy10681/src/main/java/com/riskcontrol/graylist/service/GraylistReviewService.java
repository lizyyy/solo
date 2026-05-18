package com.riskcontrol.graylist.service;

import com.riskcontrol.graylist.dto.GraylistRecordDTO;
import com.riskcontrol.graylist.dto.ReviewRequestDTO;
import com.riskcontrol.graylist.entity.GraylistRecord;
import com.riskcontrol.graylist.entity.ReviewHistory;
import com.riskcontrol.graylist.enums.GraylistStatus;
import com.riskcontrol.graylist.repository.GraylistRecordRepository;
import com.riskcontrol.graylist.repository.ReviewHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class GraylistReviewService {

    private final GraylistRecordRepository graylistRecordRepository;
    private final ReviewHistoryRepository reviewHistoryRepository;

    @Transactional
    public GraylistRecordDTO review(ReviewRequestDTO request) {
        GraylistRecord record = graylistRecordRepository.findById(request.getRecordId())
                .orElseThrow(() -> new IllegalArgumentException("记录不存在"));

        GraylistStatus previousStatus = record.getStatus();

        ReviewHistory history = new ReviewHistory();
        history.setRecordId(record.getId());
        history.setPreviousStatus(previousStatus);
        history.setNewStatus(request.getNewStatus());
        history.setConclusion(request.getConclusion());
        history.setReviewRemark(request.getReviewRemark());
        history.setReviewer(request.getReviewer());
        reviewHistoryRepository.save(history);

        record.setStatus(request.getNewStatus());
        record.setReviewRemark(request.getReviewRemark());
        record.setReviewer(request.getReviewer());
        record.setReviewTime(LocalDateTime.now());
        record.setIsExpiredNotReviewed(false);
        record.setNextStepHint(null);
        record.setUpdatedBy(request.getReviewer());
        graylistRecordRepository.save(record);

        return convertToDTO(record);
    }

    public GraylistRecordDTO getById(Long id) {
        GraylistRecord record = graylistRecordRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("记录不存在"));
        return convertToDTO(record);
    }

    public Page<GraylistRecordDTO> list(String customerId, String customerName, GraylistStatus status, Pageable pageable) {
        Specification<GraylistRecord> spec = Specification.where(null);

        if (customerId != null && !customerId.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("customerId"), "%" + customerId + "%"));
        }
        if (customerName != null && !customerName.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("customerName"), "%" + customerName + "%"));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }

        return graylistRecordRepository.findAll(spec, pageable).map(this::convertToDTO);
    }

    public List<ReviewHistory> getHistory(Long recordId) {
        return reviewHistoryRepository.findByRecordIdOrderByReviewTimeDesc(recordId);
    }

    @Scheduled(cron = "0 0 1 * * ?")
    @Transactional
    public void checkExpiredRecords() {
        log.info("开始检查到期未复核记录");
        List<GraylistStatus> statuses = List.of(GraylistStatus.IN_GRAYLIST, GraylistStatus.REVIEW_PENDING);
        List<GraylistRecord> expiredRecords = graylistRecordRepository.findExpiredRecords(LocalDateTime.now(), statuses);

        for (GraylistRecord record : expiredRecords) {
            record.setIsExpiredNotReviewed(true);
            record.setNextStepHint("请补充：1.逾期复核说明 2.风险重新评估报告 3.审批人确认");
            record.setStatus(GraylistStatus.REVIEW_PENDING);
            graylistRecordRepository.save(record);
        }
        log.info("检查完成，共处理{}条到期未复核记录", expiredRecords.size());
    }

    public GraylistRecordDTO checkCustomerStatus(String customerId) {
        GraylistRecord record = graylistRecordRepository.findActiveByCustomerId(customerId).orElse(null);
        if (record == null) {
            return null;
        }
        GraylistRecordDTO dto = convertToDTO(record);
        if (Boolean.TRUE.equals(record.getIsExpiredNotReviewed())) {
            dto.setNextStepHint("该客户灰名单已到期未复核，已自动拦截。请补充：1.逾期复核说明 2.风险重新评估报告 3.审批人确认后，方可解除限制");
        }
        return dto;
    }

    private GraylistRecordDTO convertToDTO(GraylistRecord record) {
        GraylistRecordDTO dto = new GraylistRecordDTO();
        BeanUtils.copyProperties(record, dto);
        return dto;
    }
}
