package com.account.freeze.controller;

import com.account.freeze.common.Result;
import com.account.freeze.dto.CandidateListCreateDTO;
import com.account.freeze.entity.CandidateList;
import com.account.freeze.entity.CandidateListItem;
import com.account.freeze.service.CandidateListService;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/candidate")
@RequiredArgsConstructor
public class CandidateListController {

    private final CandidateListService candidateListService;

    @PostMapping("/create")
    public Result<String> createList(@Validated @RequestBody CandidateListCreateDTO dto) {
        return Result.success(candidateListService.createList(dto));
    }

    @PostMapping("/rollback/create")
    public Result<String> createRollbackList(
            @RequestParam String batchNo,
            @RequestParam String operator,
            @RequestParam(required = false) String remark) {
        return Result.success(candidateListService.createRollbackList(batchNo, operator, remark));
    }

    @GetMapping("/{listNo}")
    public Result<CandidateList> getByListNo(@PathVariable String listNo) {
        return Result.success(candidateListService.getByListNo(listNo));
    }

    @GetMapping("/{listNo}/items")
    public Result<List<CandidateListItem>> getListItems(@PathVariable String listNo) {
        return Result.success(candidateListService.getListItems(listNo));
    }

    @GetMapping("/list")
    public Result<List<CandidateList>> listAll() {
        return Result.success(candidateListService.listAll());
    }

    @PostMapping("/item/{itemId}/confirm")
    public Result<Void> confirmItem(
            @PathVariable Long itemId,
            @RequestParam String operator,
            @RequestParam(required = false) String remark) {
        candidateListService.confirmItem(itemId, operator, remark);
        return Result.success();
    }

    @PostMapping("/item/{itemId}/skip")
    public Result<Void> skipItem(
            @PathVariable Long itemId,
            @RequestParam String operator,
            @RequestParam String reason) {
        candidateListService.skipItem(itemId, operator, reason);
        return Result.success();
    }

    @PostMapping("/{listNo}/confirm")
    public Result<Void> confirmList(
            @PathVariable String listNo,
            @RequestParam String operator) {
        candidateListService.confirmList(listNo, operator);
        return Result.success();
    }

    @PostMapping("/{listNo}/execute")
    public Result<Void> executeList(
            @PathVariable String listNo,
            @RequestParam String operator) {
        candidateListService.executeList(listNo, operator);
        return Result.success();
    }

    @PostMapping("/{listNo}/cancel")
    public Result<Void> cancelList(
            @PathVariable String listNo,
            @RequestParam String operator,
            @RequestParam String reason) {
        candidateListService.cancelList(listNo, operator, reason);
        return Result.success();
    }
}
