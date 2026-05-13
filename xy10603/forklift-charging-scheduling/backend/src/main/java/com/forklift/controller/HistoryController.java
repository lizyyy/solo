package com.forklift.controller;

import com.forklift.common.Result;
import com.forklift.entity.ChangeHistory;
import com.forklift.mapper.ChangeHistoryMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/history")
public class HistoryController {

    @Autowired
    private ChangeHistoryMapper changeHistoryMapper;

    @GetMapping
    public Result<List<ChangeHistory>> getAllHistory() {
        List<ChangeHistory> list = changeHistoryMapper.selectList(null);
        return Result.success(list);
    }

    @GetMapping("/{entityType}")
    public Result<List<ChangeHistory>> getHistoryByType(@PathVariable String entityType) {
        List<ChangeHistory> list = changeHistoryMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<ChangeHistory>()
                .eq(ChangeHistory::getEntityType, entityType)
                .orderByDesc(ChangeHistory::getCreatedAt)
        );
        return Result.success(list);
    }

    @GetMapping("/{entityType}/{entityId}")
    public Result<List<ChangeHistory>> getHistoryByEntity(
            @PathVariable String entityType,
            @PathVariable Long entityId) {
        List<ChangeHistory> list = changeHistoryMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<ChangeHistory>()
                .eq(ChangeHistory::getEntityType, entityType)
                .eq(ChangeHistory::getEntityId, entityId)
                .orderByDesc(ChangeHistory::getCreatedAt)
        );
        return Result.success(list);
    }
}
