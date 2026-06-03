package com.xxx.financial.util;

import com.xxx.financial.model.BalanceChangeRecord;
import com.xxx.financial.model.CommercialBill;
import com.xxx.financial.model.TailAdjustment;
import com.xxx.financial.model.TrusteeConfirmation;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class TestDataBuilder {

    public static CommercialBill buildNormalBill() {
        CommercialBill bill = new CommercialBill();
        bill.setBillNo("CD20260601001");
        bill.setBillType("银行承兑汇票");
        bill.setFaceAmount(new BigDecimal("1000000.00"));
        bill.setDiscountRate(new BigDecimal("3.65"));
        bill.setDiscountDate(new Date());
        bill.setMaturityDate(new Date(System.currentTimeMillis() + 90L * 24 * 60 * 60 * 1000));
        bill.setDiscountInterest(new BigDecimal("9000.00"));
        bill.setDrawer("ABC贸易有限公司");
        bill.setDrawee("XYZ银行");
        return bill;
    }

    public static TailAdjustment buildNormalTailAdjustment() {
        TailAdjustment adj = new TailAdjustment();
        adj.setAdjustmentNo("ADJ20260601001");
        adj.setBillNo("CD20260601001");
        adj.setAdjustmentAmount(new BigDecimal("12.50"));
        adj.setAdjustmentReason("四舍五入尾差调整");
        adj.setApprover("张明");
        adj.setImportTime(new Date());
        adj.setImportBatchNo("BATCH20260601");
        adj.setRemark("正常尾差调整");
        return adj;
    }

    public static TailAdjustment buildPinyinApproverTailAdjustment() {
        TailAdjustment adj = buildNormalTailAdjustment();
        adj.setAdjustmentNo("ADJ20260601002");
        adj.setApprover("zhang ming");
        adj.setRemark("");
        return adj;
    }

    public static TailAdjustment buildConflictTailAdjustment() {
        TailAdjustment adj = buildNormalTailAdjustment();
        adj.setAdjustmentNo("ADJ20260601003");
        adj.setAdjustmentAmount(new BigDecimal("15.80"));
        return adj;
    }

    public static TrusteeConfirmation buildNormalTrusteeConfirmation() {
        TrusteeConfirmation tc = new TrusteeConfirmation();
        tc.setConfirmationNo("TC20260601001");
        tc.setBillNo("CD20260601001");
        tc.setConfirmedInterest(new BigDecimal("9012.50"));
        tc.setConfirmedBalance(new BigDecimal("9012.50"));
        tc.setConfirmationDate(new Date());
        tc.setTrustee("中国工商银行托管部");
        tc.setConfirmationStatus("已确认");
        tc.setRemark("数据核对无误");
        return tc;
    }

    public static TrusteeConfirmation buildConflictTrusteeConfirmation() {
        TrusteeConfirmation tc = buildNormalTrusteeConfirmation();
        tc.setConfirmedInterest(new BigDecimal("9010.50"));
        tc.setConfirmedBalance(new BigDecimal("9010.50"));
        return tc;
    }

    public static List<BalanceChangeRecord> buildEmptyBalanceHistory() {
        return new ArrayList<>();
    }

    public static List<BalanceChangeRecord> buildNormalBalanceHistory(String billNo) {
        List<BalanceChangeRecord> history = new ArrayList<>();

        BalanceChangeRecord r1 = new BalanceChangeRecord();
        r1.setRecordNo("BAL00000001");
        r1.setBillNo(billNo);
        r1.setPreviousBalance(new BigDecimal("0.00"));
        r1.setChangeAmount(new BigDecimal("9000.00"));
        r1.setCurrentBalance(new BigDecimal("9000.00"));
        r1.setChangeTime(new Date(System.currentTimeMillis() - 86400000L));
        r1.setChangeReason("贴现利息入账");
        r1.setOperator("system");
        r1.setRelatedBusinessNo("INT20260601001");
        history.add(r1);

        return history;
    }

    public static List<BalanceChangeRecord> buildInconsistentBalanceHistory(String billNo) {
        List<BalanceChangeRecord> history = new ArrayList<>();

        BalanceChangeRecord r1 = new BalanceChangeRecord();
        r1.setRecordNo("BAL00000001");
        r1.setBillNo(billNo);
        r1.setPreviousBalance(new BigDecimal("0.00"));
        r1.setChangeAmount(new BigDecimal("9000.00"));
        r1.setCurrentBalance(new BigDecimal("9000.00"));
        r1.setChangeTime(new Date(System.currentTimeMillis() - 86400000L));
        r1.setChangeReason("贴现利息入账");
        r1.setOperator("system");
        r1.setRelatedBusinessNo("INT20260601001");
        history.add(r1);

        BalanceChangeRecord r2 = new BalanceChangeRecord();
        r2.setRecordNo("BAL00000002");
        r2.setBillNo(billNo);
        r2.setPreviousBalance(new BigDecimal("8000.00"));
        r2.setChangeAmount(new BigDecimal("100.00"));
        r2.setCurrentBalance(new BigDecimal("8100.00"));
        r2.setChangeTime(new Date());
        r2.setChangeReason("错误记录-用于测试");
        r2.setOperator("test");
        r2.setRelatedBusinessNo("TEST001");
        history.add(r2);

        return history;
    }
}
