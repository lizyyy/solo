package com.xxx.financial.service;

import com.xxx.financial.enums.ApproverType;
import com.xxx.financial.enums.ReviewStatus;
import com.xxx.financial.model.InterestReviewContext;
import com.xxx.financial.model.TailAdjustment;
import com.xxx.financial.util.PinyinDetector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.Set;

public class TailAdjustmentService {

    private static final Logger logger = LoggerFactory.getLogger(TailAdjustmentService.class);

    private final Set<String> importedAdjustmentNos = new HashSet<>();

    public boolean processTailAdjustment(InterestReviewContext context, TailAdjustment adjustment) {
        logger.info("开始处理尾差调整条，调整单号: {}, 票据号: {}", adjustment.getAdjustmentNo(), adjustment.getBillNo());

        ApproverType approverType = PinyinDetector.detectApproverType(adjustment.getApprover());
        adjustment.setApproverType(approverType);

        boolean isPinyin = approverType == ApproverType.PINYIN_ONLY;
        adjustment.setPinyinApproverFlag(isPinyin);

        if (isPinyin) {
            logger.warn("尾差调整条审批人仅为拼音: {}, 标记为待客户经理复核", adjustment.getApprover());
            adjustment.setRemark("审批人仅留拼音(" + adjustment.getApprover() + ")，需客户经理复核确认");
            context.setStatus(ReviewStatus.PENDING_MANAGER_REVIEW);
        } else {
            context.setStatus(ReviewStatus.NORMAL);
            logger.info("尾差调整条审批人信息完整，进入正常流程");
        }

        context.setTailAdjustment(adjustment);
        context.setStep1ImportCompleted(true);

        logger.info("尾差调整条处理完成，状态: {}", context.getStatus().getDescription());
        return true;
    }

    public boolean isDuplicateImport(String adjustmentNo) {
        return importedAdjustmentNos.contains(adjustmentNo);
    }

    public void recordImport(String adjustmentNo) {
        importedAdjustmentNos.add(adjustmentNo);
    }

    public void clearImportRecord(String adjustmentNo) {
        importedAdjustmentNos.remove(adjustmentNo);
    }
}
