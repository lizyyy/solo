package com.account.freeze.service;

import com.account.freeze.entity.CandidateList;
import com.account.freeze.entity.FreezeBatch;
import com.account.freeze.entity.FreezeBatchItem;
import com.account.freeze.mapper.CandidateListMapper;
import com.account.freeze.mapper.FreezeBatchItemMapper;
import com.account.freeze.mapper.FreezeBatchMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CandidateListService {

    private final CandidateListMapper candidateListMapper;
    private final FreezeBatchMapper freezeBatchMapper;
    private final FreezeBatchItemMapper freezeBatchItemMapper;

    @Transactional(rollbackFor = Exception.class)
    public String createRollbackList(String batchNo, String operator, String remark) {
        FreezeBatch batch = freezeBatchMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeBatch>()
                .eq(FreezeBatch::getBatchNo, batchNo)
        );
        if (batch == null) {
            throw new RuntimeException("批次不存在");
        }

        List<FreezeBatchItem> items = freezeBatchItemMapper.selectByBatchId(batch.getId());

        String listNo = "CAND" + System.currentTimeMillis();

        CandidateList list = new CandidateList();
        list.setListNo(listNo);
        list.setListName("回滚清单-" + batchNo);
        list.setListType("ROLLBACK");
        list.setStatus("CREATED");
        list.setTotalCount(items.size());
        list.setConfirmedCount(0);
        list.setRuleSnapshot("回滚规则：仅撤销已冻结账号");
        list.setOperator(operator);
        list.setRemark(remark);
        list.setCreatedTime(LocalDateTime.now());
        list.setUpdatedTime(LocalDateTime.now());

        candidateListMapper.insert(list);

        log.info("创建回滚候选清单成功，清单号: {}, 数量: {}", listNo, items.size());
        return listNo;
    }

    @Transactional(rollbackFor = Exception.class)
    public void confirmList(String listNo, String operator) {
        CandidateList list = candidateListMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<CandidateList>()
                .eq(CandidateList::getListNo, listNo)
        );
        if (list == null) {
            throw new RuntimeException("清单不存在");
        }

        list.setStatus("CONFIRMED");
        list.setConfirmOperator(operator);
        list.setConfirmTime(LocalDateTime.now());
        list.setUpdatedTime(LocalDateTime.now());
        candidateListMapper.updateById(list);

        log.info("确认候选清单成功，清单号: {}", listNo);
    }

    @Transactional(rollbackFor = Exception.class)
    public void executeList(String listNo, String operator) {
        CandidateList list = candidateListMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<CandidateList>()
                .eq(CandidateList::getListNo, listNo)
        );
        if (list == null) {
            throw new RuntimeException("清单不存在");
        }

        if (!"CONFIRMED".equals(list.getStatus())) {
            throw new RuntimeException("清单未确认，无法执行");
        }

        list.setStatus("EXECUTED");
        list.setExecuteTime(LocalDateTime.now());
        list.setUpdatedTime(LocalDateTime.now());
        candidateListMapper.updateById(list);

        log.info("执行候选清单成功，清单号: {}", listNo);
    }

    public CandidateList getByListNo(String listNo) {
        return candidateListMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<CandidateList>()
                .eq(CandidateList::getListNo, listNo)
        );
    }
}
