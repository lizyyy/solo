package com.apigate.voting.controller;

import com.apigate.voting.dto.*;
import com.apigate.voting.model.BlockReason;
import com.apigate.voting.model.ChangeProposal;
import com.apigate.voting.model.ReleaseRecord;
import com.apigate.voting.model.VoteOpinion;
import com.apigate.voting.service.ProposalService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/proposals")
@RequiredArgsConstructor
public class ProposalController {
    private final ProposalService proposalService;

    @PostMapping
    public ResponseEntity<ChangeProposal> createProposal(@Valid @RequestBody CreateProposalRequest request) {
        ChangeProposal proposal = proposalService.createProposal(request);
        return ResponseEntity.ok(proposal);
    }

    @PostMapping("/{proposalNo}/submit")
    public ResponseEntity<ChangeProposal> submitProposal(@PathVariable String proposalNo) {
        ChangeProposal proposal = proposalService.submitProposal(proposalNo);
        return ResponseEntity.ok(proposal);
    }

    @PostMapping("/{proposalNo}/start-voting")
    public ResponseEntity<ChangeProposal> startVoting(@PathVariable String proposalNo) {
        ChangeProposal proposal = proposalService.startVoting(proposalNo);
        return ResponseEntity.ok(proposal);
    }

    @PostMapping("/{proposalNo}/vote")
    public ResponseEntity<VoteOpinion> vote(@PathVariable String proposalNo, @Valid @RequestBody VoteRequest request) {
        VoteOpinion vote = proposalService.vote(proposalNo, request);
        return ResponseEntity.ok(vote);
    }

    @PostMapping("/{proposalNo}/block")
    public ResponseEntity<BlockReason> blockProposal(@PathVariable String proposalNo, @Valid @RequestBody BlockRequest request) {
        BlockReason blockReason = proposalService.blockProposal(proposalNo, request);
        return ResponseEntity.ok(blockReason);
    }

    @PostMapping("/{proposalNo}/resolve-block")
    public ResponseEntity<ChangeProposal> resolveBlock(@PathVariable String proposalNo, @Valid @RequestBody ResolveBlockRequest request) {
        ChangeProposal proposal = proposalService.resolveBlock(proposalNo, request);
        return ResponseEntity.ok(proposal);
    }

    @PostMapping("/{proposalNo}/release")
    public ResponseEntity<ReleaseRecord> releaseProposal(@PathVariable String proposalNo, @Valid @RequestBody ReleaseRequest request) {
        ReleaseRecord releaseRecord = proposalService.releaseProposal(proposalNo, request);
        return ResponseEntity.ok(releaseRecord);
    }

    @PostMapping("/{proposalNo}/archive")
    public ResponseEntity<ChangeProposal> archiveProposal(@PathVariable String proposalNo) {
        ChangeProposal proposal = proposalService.archiveProposal(proposalNo);
        return ResponseEntity.ok(proposal);
    }

    @PostMapping("/{proposalNo}/cancel")
    public ResponseEntity<ChangeProposal> cancelProposal(@PathVariable String proposalNo, @RequestParam String operatorId) {
        ChangeProposal proposal = proposalService.cancelProposal(proposalNo, operatorId);
        return ResponseEntity.ok(proposal);
    }

    @GetMapping("/{proposalNo}")
    public ResponseEntity<ChangeProposal> getProposalDetail(@PathVariable String proposalNo) {
        ChangeProposal proposal = proposalService.getProposalDetail(proposalNo);
        return ResponseEntity.ok(proposal);
    }

    @GetMapping
    public ResponseEntity<Page<ChangeProposal>> queryProposals(
            @RequestParam(required = false) String proposalNo,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String apiName,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String submitterId,
            @RequestParam(required = false) LocalDateTime startTime,
            @RequestParam(required = false) LocalDateTime endTime,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        
        ProposalQueryRequest request = new ProposalQueryRequest();
        request.setProposalNo(proposalNo);
        request.setTitle(title);
        request.setApiName(apiName);
        request.setStatus(status != null ? com.apigate.voting.model.ProposalStatus.valueOf(status) : null);
        request.setSubmitterId(submitterId);
        request.setStartTime(startTime);
        request.setEndTime(endTime);
        request.setPage(page);
        request.setSize(size);
        
        Page<ChangeProposal> proposals = proposalService.queryProposals(request);
        return ResponseEntity.ok(proposals);
    }

    @GetMapping("/{proposalNo}/export")
    public ResponseEntity<byte[]> exportProposal(@PathVariable String proposalNo) {
        byte[] data = proposalService.exportProposal(proposalNo);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", proposalNo + ".xlsx");
        return ResponseEntity.ok().headers(headers).body(data);
    }

    @PostMapping("/process-expired")
    public ResponseEntity<String> processExpiredVotingProposals() {
        proposalService.processExpiredVotingProposals();
        return ResponseEntity.ok("超时提案处理完成");
    }
}
