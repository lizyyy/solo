package com.account.freeze.service;

import com.account.freeze.entity.EvidenceChain;
import com.account.freeze.enums.EvidenceChainStatus;
import com.account.freeze.mapper.EvidenceChainMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class EvidenceChainService {

    private final EvidenceChainMapper evidenceChainMapper;

    @Transactional(rollbackFor = Exception.class)
    public Long createEvidenceChain(Long batchId, Long batchItemId, String accountNo, 
                                     String smsContent, String operator) {
        EvidenceChain chain = new EvidenceChain();
        chain.setChainNo("EVC" + System.currentTimeMillis());
        chain.setBatchId(batchId);
        chain.setBatchItemId(batchItemId);
        chain.setAccountNo(accountNo);
        chain.setStatus(EvidenceChainStatus.COMPLETE.getCode());
        chain.setSmsEvidence(smsContent != null && !smsContent.isEmpty() ? 1 : 0);
        chain.setLogisticsEvidence(0);
        chain.setLogisticsScreenshotReviewed(0);
        chain.setOperator(operator);
        chain.setCreatedTime(LocalDateTime.now());
        chain.setUpdatedTime(LocalDateTime.now());
        
        evidenceChainMapper.insert(chain);
        
        log.info("创建证据链成功，链编号: {}", chain.getChainNo());
        return chain.getId();
    }

    public boolean validateEvidenceChain(Long chainId) {
        EvidenceChain chain = evidenceChainMapper.selectById(chainId);
        if (chain == null) {
            return false;
        }
        
        return chain.getSmsEvidence() == 1;
    }

    @Transactional(rollbackFor = Exception.class)
    public void updateEvidenceChainStatus(Long chainId, String status, String breakReason) {
        EvidenceChain chain = new EvidenceChain();
        chain.setId(chainId);
        chain.setStatus(status);
        chain.setBreakReason(breakReason);
        chain.setUpdatedTime(LocalDateTime.now());
        evidenceChainMapper.updateById(chain);
    }

    public EvidenceChain getByChainNo(String chainNo) {
        return evidenceChainMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<EvidenceChain>()
                .eq(EvidenceChain::getChainNo, chainNo)
        );
    }
}
