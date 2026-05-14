package com.account.freeze.service;

import com.account.freeze.dto.CandidateListCreateDTO;
import com.account.freeze.entity.CandidateList;
import com.account.freeze.entity.CandidateListItem;
import com.account.freeze.entity.FreezeBatch;
import com.account.freeze.entity.FreezeBatchItem;
import com.account.freeze.mapper.CandidateListItemMapper;
import com.account.freeze.mapper.CandidateListMapper;
import com.account.freeze.mapper.FreezeBatchItemMapper;
import com.account.freeze.mapper.FreezeBatchMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CandidateListService {

    private final CandidateListMapper candidateListMapper;
    private final CandidateListItemMapper candidateListItemMapper;
    private final FreezeBatchMapper freezeBatchMapper;
    private final FreezeBatchItemMapper freezeBatchItemMapper;

    @Transactional(rollbackFor = Exception.class)
    public String createList(CandidateListCreateDTO dto) {
        String listNo = "CAND" + System.currentTimeMillis();

        CandidateList list = new CandidateList();
        list.setListNo(listNo);
        list.setListName(dto.getListName());
        list.setListType(dto.getListType());
        list.setStatus("CREATED");
        list.setTotalCount(0);
        list.setConfirmedCount(0);
        list.setRuleSnapshot("规则快照待生成");
        list.setOperator(dto.getOperator());
        list.setRemark(dto.getRemark());
        list.setCreatedTime(LocalDateTime.now());
        list.setUpdatedTime(LocalDateTime.now());

        candidateListMapper.insert(list);

        int itemCount = 0;
        if (dto.getSourceBatchNo() != null) {
            itemCount = addItemsFromBatch(list.getId(), listNo, dto.getSourceBatchNo());
        } else if (dto.getAccountNos() != null) {
            itemCount = addItemsByAccountNos(list.getId(), listNo, dto.getAccountNos(), dto.getListType());
        }

        list.setTotalCount(itemCount);
        candidateListMapper.updateById(list);

        log.info("创建候选清单成功，清单号: {}, 数量: {}", listNo, itemCount);
        return listNo;
    }

    @Transactional(rollbackFor = Exception.class)
    public String createRollbackList(String batchNo, String operator, String remark) {
        FreezeBatch batch = freezeBatchMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeBatch>()
                .eq(FreezeBatch::getBatchNo, batchNo)
        );
        if (batch == null) {
            throw new RuntimeException("批次不存在");
        }

        String listNo = "CAND" + System.currentTimeMillis();

        CandidateList list = new CandidateList();
        list.setListNo(listNo);
        list.setListName("回滚清单-" + batchNo);
        list.setListType("ROLLBACK");
        list.setStatus("CREATED");
        list.setTotalCount(0);
        list.setConfirmedCount(0);
        list.setRuleSnapshot("回滚规则：仅撤销已冻结账号");
        list.setOperator(operator);
        list.setRemark(remark);
        list.setCreatedTime(LocalDateTime.now());
        list.setUpdatedTime(LocalDateTime.now());

        candidateListMapper.insert(list);

        int itemCount = addItemsFromBatch(list.getId(), listNo, batchNo);
        list.setTotalCount(itemCount);
        candidateListMapper.updateById(list);

        log.info("创建回滚候选清单成功，清单号: {}, 数量: {}", listNo, itemCount);
        return listNo;
    }

    private int addItemsFromBatch(Long listId, String listNo, String batchNo) {
        FreezeBatch batch = freezeBatchMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeBatch>()
                .eq(FreezeBatch::getBatchNo, batchNo)
        );

        List<FreezeBatchItem> batchItems = freezeBatchItemMapper.selectByBatchId(batch.getId());
        List<CandidateListItem> items = new ArrayList<>();

        for (FreezeBatchItem batchItem : batchItems) {
            CandidateListItem item = new CandidateListItem();
            item.setListId(listId);
            item.setListNo(listNo);
            item.setBatchId(batch.getId());
            item.setBatchItemId(batchItem.getId());
            item.setAccountNo(batchItem.getAccountNo());
            item.setOriginalStatus(batchItem.getStatus());
            item.setTargetStatus("PENDING");
            item.setStatus("PENDING");
            item.setCreatedTime(LocalDateTime.now());
            item.setUpdatedTime(LocalDateTime.now());
            items.add(item);
        }

        items.forEach(candidateListItemMapper::insert);
        return items.size();
    }

    private int addItemsByAccountNos(Long listId, String listNo, List<String> accountNos, String listType) {
        List<CandidateListItem> items = new ArrayList<>();
        for (String accountNo : accountNos) {
            CandidateListItem item = new CandidateListItem();
            item.setListId(listId);
            item.setListNo(listNo);
            item.setAccountNo(accountNo);
            item.setTargetStatus("CLEAN".equals(listType) ? "CLEANED" : "ROLLBACK");
            item.setStatus("PENDING");
            item.setCreatedTime(LocalDateTime.now());
            item.setUpdatedTime(LocalDateTime.now());
            items.add(item);
        }
        items.forEach(candidateListItemMapper::insert);
        return items.size();
    }

    @Transactional(rollbackFor = Exception.class)
    public void confirmItem(Long itemId, String operator, String remark) {
        CandidateListItem item = candidateListItemMapper.selectById(itemId);
        if (item == null) {
            throw new RuntimeException("清单项不存在");
        }

        item.setStatus("CONFIRMED");
        item.setConfirmOperator(operator);
        item.setConfirmTime(LocalDateTime.now());
        item.setRemark(remark);
        item.setUpdatedTime(LocalDateTime.now());
        candidateListItemMapper.updateById(item);

        updateListConfirmedCount(item.getListId());

        log.info("确认清单项成功，账号: {}, 操作人: {}", item.getAccountNo(), operator);
    }

    @Transactional(rollbackFor = Exception.class)
    public void skipItem(Long itemId, String operator, String reason) {
        CandidateListItem item = candidateListItemMapper.selectById(itemId);
        if (item == null) {
            throw new RuntimeException("清单项不存在");
        }

        item.setStatus("SKIPPED");
        item.setConfirmOperator(operator);
        item.setConfirmTime(LocalDateTime.now());
        item.setReason(reason);
        item.setUpdatedTime(LocalDateTime.now());
        candidateListItemMapper.updateById(item);

        log.info("跳過清单项成功，账号: {}, 操作人: {}", item.getAccountNo(), operator);
    }

    private void updateListConfirmedCount(Long listId) {
        int confirmedCount = candidateListItemMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<CandidateListItem>()
                .eq(CandidateListItem::getListId, listId)
                .eq(CandidateListItem::getStatus, "CONFIRMED")
        ).intValue();

        CandidateList list = new CandidateList();
        list.setId(listId);
        list.setConfirmedCount(confirmedCount);
        list.setUpdatedTime(LocalDateTime.now());
        candidateListMapper.updateById(list);
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

        List<CandidateListItem> items = candidateListItemMapper.selectByListId(list.getId());
        for (CandidateListItem item : items) {
            if ("PENDING".equals(item.getStatus())) {
                item.setStatus("CONFIRMED");
                item.setConfirmOperator(operator);
                item.setConfirmTime(LocalDateTime.now());
                item.setUpdatedTime(LocalDateTime.now());
                candidateListItemMapper.updateById(item);
            }
        }

        list.setStatus("CONFIRMED");
        list.setConfirmOperator(operator);
        list.setConfirmTime(LocalDateTime.now());
        list.setConfirmedCount(items.size());
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

        List<CandidateListItem> items = candidateListItemMapper.selectByListId(list.getId());
        for (CandidateListItem item : items) {
            if ("CONFIRMED".equals(item.getStatus())) {
                if ("ROLLBACK".equals(list.getListType()) && item.getBatchItemId() != null) {
                    FreezeBatchItem batchItem = freezeBatchItemMapper.selectById(item.getBatchItemId());
                    if (batchItem != null) {
                        batchItem.setStatus("ROLLBACK");
                        batchItem.setUpdatedTime(LocalDateTime.now());
                        freezeBatchItemMapper.updateById(batchItem);
                    }
                }

                item.setStatus("PROCESSED");
                item.setUpdatedTime(LocalDateTime.now());
                candidateListItemMapper.updateById(item);
            }
        }

        list.setStatus("EXECUTED");
        list.setExecuteTime(LocalDateTime.now());
        list.setUpdatedTime(LocalDateTime.now());
        candidateListMapper.updateById(list);

        log.info("执行候选清单成功，清单号: {}", listNo);
    }

    @Transactional(rollbackFor = Exception.class)
    public void cancelList(String listNo, String operator, String reason) {
        CandidateList list = candidateListMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<CandidateList>()
                .eq(CandidateList::getListNo, listNo)
        );
        if (list == null) {
            throw new RuntimeException("清单不存在");
        }

        list.setStatus("CANCELLED");
        list.setRemark(reason);
        list.setUpdatedTime(LocalDateTime.now());
        candidateListMapper.updateById(list);

        log.info("取消候选清单成功，清单号: {}, 原因: {}", listNo, reason);
    }

    public CandidateList getByListNo(String listNo) {
        return candidateListMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<CandidateList>()
                .eq(CandidateList::getListNo, listNo)
        );
    }

    public List<CandidateListItem> getListItems(String listNo) {
        CandidateList list = getByListNo(listNo);
        if (list == null) {
            throw new RuntimeException("清单不存在");
        }
        return candidateListItemMapper.selectByListId(list.getId());
    }

    public List<CandidateList> listAll() {
        return candidateListMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<CandidateList>()
                .orderByDesc(CandidateList::getCreatedTime)
        );
    }
}
