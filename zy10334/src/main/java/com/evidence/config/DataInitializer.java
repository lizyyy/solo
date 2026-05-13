package com.evidence.config;

import com.evidence.dto.AddActionRequest;
import com.evidence.dto.AddRemarkRequest;
import com.evidence.dto.CreateEvidenceRequest;
import com.evidence.dto.StatusUpdateRequest;
import com.evidence.enums.ActionType;
import com.evidence.enums.EvidenceStatus;
import com.evidence.service.EvidenceChainService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final EvidenceChainService evidenceChainService;

    @Bean
    public CommandLineRunner initData() {
        return args -> {
            log.info("开始初始化测试数据...");
            createSampleEvidence1();
            createSampleEvidence2();
            createSampleEvidence3();
            log.info("测试数据初始化完成");
        };
    }

    private void createSampleEvidence1() {
        String requestId = "REQ-TEST-001";
        String businessNo = "ORD-2024-0514-001";

        CreateEvidenceRequest createRequest = new CreateEvidenceRequest();
        createRequest.setBusinessNo(businessNo);
        createRequest.setRequestId(requestId);
        createRequest.setSourceSystem("ORDER-SYSTEM");
        createRequest.setTargetSystem("PAYMENT-SYSTEM");
        createRequest.setApiName("createPayment");
        createRequest.setRequestBody("{\"amount\":100.00,\"currency\":\"CNY\",\"orderNo\":\"" + businessNo + "\"}");
        createRequest.setOperator("system");
        evidenceChainService.createEvidence(createRequest);

        AddActionRequest action1 = new AddActionRequest();
        action1.setRequestId(requestId);
        action1.setActionType(ActionType.INTERNAL_TRANSFORM);
        action1.setActionName("参数转换");
        action1.setActionDetail("订单参数转换为支付参数");
        action1.setOperator("system");
        evidenceChainService.addAction(action1);

        AddActionRequest action2 = new AddActionRequest();
        action2.setRequestId(requestId);
        action2.setActionType(ActionType.EXTERNAL_CALL);
        action2.setActionName("调用第三方支付");
        action2.setActionDetail("调用支付宝接口");
        action2.setExternalRefNo("PAY-20240514-ALIPAY-001");
        action2.setOperator("system");
        evidenceChainService.addAction(action2);

        AddActionRequest action3 = new AddActionRequest();
        action3.setRequestId(requestId);
        action3.setActionType(ActionType.EXTERNAL_RECEIPT);
        action3.setActionName("支付回执");
        action3.setActionDetail("收到支付宝成功回调");
        action3.setExternalRefNo("PAY-20240514-ALIPAY-001");
        action3.setReceiptData("{\"code\":\"10000\",\"msg\":\"Success\",\"tradeNo\":\"2024051422001414110005140001\"}");
        action3.setOperator("system");
        evidenceChainService.addAction(action3);

        StatusUpdateRequest statusRequest = new StatusUpdateRequest();
        statusRequest.setRequestId(requestId);
        statusRequest.setTargetStatus(EvidenceStatus.SUCCESS);
        statusRequest.setResponseBody("{\"code\":\"0000\",\"message\":\"支付成功\"}");
        statusRequest.setOperator("system");
        evidenceChainService.updateStatus(statusRequest);

        log.info("测试数据1创建成功: {}", requestId);
    }

    private void createSampleEvidence2() {
        String requestId = "REQ-TEST-002";
        String businessNo = "ORD-2024-0514-002";

        CreateEvidenceRequest createRequest = new CreateEvidenceRequest();
        createRequest.setBusinessNo(businessNo);
        createRequest.setRequestId(requestId);
        createRequest.setSourceSystem("ORDER-SYSTEM");
        createRequest.setTargetSystem("INVENTORY-SYSTEM");
        createRequest.setApiName("deductInventory");
        createRequest.setRequestBody("{\"skuId\":\"SKU001\",\"quantity\":2}");
        createRequest.setOperator("system");
        evidenceChainService.createEvidence(createRequest);

        AddActionRequest action1 = new AddActionRequest();
        action1.setRequestId(requestId);
        action1.setActionType(ActionType.INTERNAL_TRANSFORM);
        action1.setActionName("库存参数校验");
        action1.setActionDetail("校验库存参数合法性");
        action1.setOperator("system");
        evidenceChainService.addAction(action1);

        AddActionRequest action2 = new AddActionRequest();
        action2.setRequestId(requestId);
        action2.setActionType(ActionType.DB_OPERATION);
        action2.setActionName("查询库存");
        action2.setActionDetail("查询当前库存数量");
        action2.setOperator("system");
        evidenceChainService.addAction(action2);

        StatusUpdateRequest statusRequest = new StatusUpdateRequest();
        statusRequest.setRequestId(requestId);
        statusRequest.setTargetStatus(EvidenceStatus.PROCESSING);
        statusRequest.setOperator("system");
        evidenceChainService.updateStatus(statusRequest);

        log.info("测试数据2创建成功: {}", requestId);
    }

    private void createSampleEvidence3() {
        String requestId = "REQ-TEST-003";
        String businessNo = "ORD-2024-0514-003";

        CreateEvidenceRequest createRequest = new CreateEvidenceRequest();
        createRequest.setBusinessNo(businessNo);
        createRequest.setRequestId(requestId);
        createRequest.setSourceSystem("ORDER-SYSTEM");
        createRequest.setTargetSystem("PAYMENT-SYSTEM");
        createRequest.setApiName("createPayment");
        createRequest.setRequestBody("{\"amount\":500.00,\"currency\":\"CNY\",\"orderNo\":\"" + businessNo + "\"}");
        createRequest.setOperator("system");
        evidenceChainService.createEvidence(createRequest);

        AddActionRequest action1 = new AddActionRequest();
        action1.setRequestId(requestId);
        action1.setActionType(ActionType.EXTERNAL_CALL);
        action1.setActionName("调用第三方支付");
        action1.setActionDetail("调用微信支付接口");
        action1.setExternalRefNo("PAY-20240514-WECHAT-003");
        action1.setOperator("system");
        evidenceChainService.addAction(action1);

        StatusUpdateRequest statusRequest = new StatusUpdateRequest();
        statusRequest.setRequestId(requestId);
        statusRequest.setTargetStatus(EvidenceStatus.FAILED);
        statusRequest.setErrorMessage("余额不足");
        statusRequest.setResponseBody("{\"code\":\"40004\",\"message\":\"INSUFFICIENT_BALANCE\"}");
        statusRequest.setOperator("system");
        evidenceChainService.updateStatus(statusRequest);

        AddRemarkRequest remarkRequest = new AddRemarkRequest();
        remarkRequest.setRequestId(requestId);
        remarkRequest.setRemarkContent("客户反馈支付失败，已引导客户充值后重新支付");
        remarkRequest.setOperator("support-001");
        evidenceChainService.addRemark(remarkRequest);

        log.info("测试数据3创建成功: {}", requestId);
    }
}
