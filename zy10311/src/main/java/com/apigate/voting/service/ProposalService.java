package com.apigate.voting.service;

import com.apigate.voting.dto.*;
import com.apigate.voting.exception.BusinessException;
import com.apigate.voting.model.*;
import com.apigate.voting.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProposalService {
    private final ChangeProposalRepository proposalRepository;
    private final CallerRepository callerRepository;
    private final ImpactItemRepository impactItemRepository;
    private final VoteOpinionRepository voteOpinionRepository;
    private final BlockReasonRepository blockReasonRepository;
    private final ReleaseRecordRepository releaseRecordRepository;

    @Transactional
    public ChangeProposal createProposal(CreateProposalRequest request) {
        Caller submitter = callerRepository.findByCallerId(request.getSubmitterId())
                .orElseThrow(() -> new BusinessException("SUBMITTER_NOT_FOUND", "提交人不存在"));

        String proposalNo = generateProposalNo();
        
        ChangeProposal proposal = new ChangeProposal();
        proposal.setProposalNo(proposalNo);
        proposal.setTitle(request.getTitle());
        proposal.setDescription(request.getDescription());
        proposal.setApiName(request.getApiName());
        proposal.setApiVersion(request.getApiVersion());
        proposal.setChangeType(request.getChangeType());
        proposal.setSubmitter(submitter);
        proposal.setStatus(ProposalStatus.DRAFT);
        
        if (request.getVotingDurationHours() != null) {
            proposal.setVotingDurationHours(request.getVotingDurationHours());
        }
        if (request.getApproveThreshold() != null) {
            proposal.setApproveThreshold(request.getApproveThreshold());
        }

        ChangeProposal savedProposal = proposalRepository.save(proposal);

        if (request.getImpactItems() != null && !request.getImpactItems().isEmpty()) {
            for (ImpactItemRequest itemRequest : request.getImpactItems()) {
                ImpactItem item = new ImpactItem();
                item.setProposal(savedProposal);
                item.setImpactScope(itemRequest.getImpactScope());
                item.setImpactDescription(itemRequest.getImpactDescription());
                item.setAffectedService(itemRequest.getAffectedService());
                item.setAffectedEndpoint(itemRequest.getAffectedEndpoint());
                item.setCompatibilityLevel(itemRequest.getCompatibilityLevel());
                impactItemRepository.save(item);
            }
        }

        log.info("创建提案成功: {}", proposalNo);
        return proposalRepository.findById(savedProposal.getId()).orElseThrow();
    }

    @Transactional
    public ChangeProposal submitProposal(String proposalNo) {
        ChangeProposal proposal = getProposalByNo(proposalNo);
        
        if (proposal.getStatus() != ProposalStatus.DRAFT) {
            throw new BusinessException("INVALID_STATUS", "只有草稿状态的提案才能提交");
        }

        proposal.setStatus(ProposalStatus.SUBMITTED);
        proposal.setSubmittedAt(LocalDateTime.now());
        
        log.info("提交提案成功: {}", proposalNo);
        return proposalRepository.save(proposal);
    }

    @Transactional
    public ChangeProposal startVoting(String proposalNo) {
        ChangeProposal proposal = getProposalByNo(proposalNo);
        
        if (proposal.getStatus() != ProposalStatus.SUBMITTED) {
            throw new BusinessException("INVALID_STATUS", "只有已提交状态的提案才能开始投票");
        }

        proposal.setStatus(ProposalStatus.VOTING);
        proposal.setVotingStartTime(LocalDateTime.now());
        proposal.setVotingEndTime(LocalDateTime.now().plusHours(proposal.getVotingDurationHours()));
        
        distributeImpactNotification(proposal);
        
        log.info("开始投票: {}", proposalNo);
        return proposalRepository.save(proposal);
    }

    @Transactional
    public VoteOpinion vote(String proposalNo, VoteRequest request) {
        ChangeProposal proposal = getProposalByNo(proposalNo);
        
        if (proposal.getStatus() != ProposalStatus.VOTING) {
            throw new BusinessException("INVALID_STATUS", "只有投票中的提案才能投票");
        }

        Caller voter = callerRepository.findByCallerId(request.getVoterId())
                .orElseThrow(() -> new BusinessException("VOTER_NOT_FOUND", "投票人不存在"));

        if (voteOpinionRepository.existsByProposalIdAndVoterId(proposal.getId(), voter.getId())) {
            throw new BusinessException("DUPLICATE_VOTE", "该用户已经投过票了");
        }

        VoteOpinion vote = new VoteOpinion();
        vote.setProposal(proposal);
        vote.setVoter(voter);
        vote.setResult(request.getResult());
        vote.setComment(request.getComment());
        
        if (request.getResult() == VoteResult.BLOCK) {
            proposal.setStatus(ProposalStatus.BLOCKED);
            proposalRepository.save(proposal);
            
            BlockReason blockReason = new BlockReason();
            blockReason.setProposal(proposal);
            blockReason.setBlocker(voter);
            blockReason.setReason(request.getComment() != null ? request.getComment() : "投票阻塞");
            blockReasonRepository.save(blockReason);
            
            log.info("投票阻塞提案: {}", proposalNo);
        }

        VoteOpinion savedVote = voteOpinionRepository.save(vote);
        checkVotingResult(proposal);
        
        return savedVote;
    }

    private void checkVotingResult(ChangeProposal proposal) {
        long approveCount = voteOpinionRepository.countByProposalIdAndResult(proposal.getId(), VoteResult.APPROVE);
        
        if (approveCount >= proposal.getApproveThreshold()) {
            proposal.setStatus(ProposalStatus.APPROVED);
            proposal.setApprovedAt(LocalDateTime.now());
            proposalRepository.save(proposal);
            log.info("提案达到审批阈值，自动通过: {}", proposal.getProposalNo());
        }
    }

    @Transactional
    public void processExpiredVotingProposals() {
        List<ChangeProposal> expiredProposals = proposalRepository.findExpiredVotingProposals(LocalDateTime.now());
        for (ChangeProposal proposal : expiredProposals) {
            long approveCount = voteOpinionRepository.countByProposalIdAndResult(proposal.getId(), VoteResult.APPROVE);
            if (approveCount >= proposal.getApproveThreshold()) {
                proposal.setStatus(ProposalStatus.APPROVED);
                proposal.setApprovedAt(LocalDateTime.now());
                log.info("超时提案自动通过: {}", proposal.getProposalNo());
            } else {
                proposal.setStatus(ProposalStatus.REJECTED);
                log.info("超时提案未通过: {}", proposal.getProposalNo());
            }
            proposalRepository.save(proposal);
        }
    }

    @Transactional
    public BlockReason blockProposal(String proposalNo, BlockRequest request) {
        ChangeProposal proposal = getProposalByNo(proposalNo);
        
        if (proposal.getStatus() != ProposalStatus.VOTING) {
            throw new BusinessException("INVALID_STATUS", "只有投票中的提案才能被阻塞");
        }

        Caller blocker = callerRepository.findByCallerId(request.getBlockerId())
                .orElseThrow(() -> new BusinessException("BLOCKER_NOT_FOUND", "阻塞人不存在"));

        proposal.setStatus(ProposalStatus.BLOCKED);
        proposalRepository.save(proposal);

        BlockReason blockReason = new BlockReason();
        blockReason.setProposal(proposal);
        blockReason.setBlocker(blocker);
        blockReason.setReason(request.getReason());
        
        log.info("阻塞提案: {}", proposalNo);
        return blockReasonRepository.save(blockReason);
    }

    @Transactional
    public ChangeProposal resolveBlock(String proposalNo, ResolveBlockRequest request) {
        ChangeProposal proposal = getProposalByNo(proposalNo);
        
        if (proposal.getStatus() != ProposalStatus.BLOCKED) {
            throw new BusinessException("INVALID_STATUS", "只有阻塞状态的提案才能解除阻塞");
        }

        List<BlockReason> unresolvedBlocks = blockReasonRepository.findByProposalIdAndIsResolvedFalse(proposal.getId());
        for (BlockReason block : unresolvedBlocks) {
            block.setIsResolved(true);
            block.setResolvedAt(LocalDateTime.now());
            block.setResolvedNote(request.getResolvedNote());
            blockReasonRepository.save(block);
        }

        proposal.setStatus(ProposalStatus.VOTING);
        proposal.setVotingEndTime(LocalDateTime.now().plusHours(proposal.getVotingDurationHours()));
        
        log.info("解除提案阻塞: {}", proposalNo);
        return proposalRepository.save(proposal);
    }

    @Transactional
    public ReleaseRecord releaseProposal(String proposalNo, ReleaseRequest request) {
        ChangeProposal proposal = getProposalByNo(proposalNo);
        
        if (proposal.getStatus() != ProposalStatus.APPROVED) {
            throw new BusinessException("INVALID_STATUS", "只有已通过状态的提案才能发布");
        }

        proposal.setStatus(ProposalStatus.RELEASED);
        proposal.setReleasedAt(request.getActualReleaseTime() != null ? request.getActualReleaseTime() : LocalDateTime.now());
        proposalRepository.save(proposal);

        ReleaseRecord releaseRecord = new ReleaseRecord();
        releaseRecord.setProposal(proposal);
        releaseRecord.setReleaseVersion(request.getReleaseVersion());
        releaseRecord.setReleaseNote(request.getReleaseNote());
        releaseRecord.setOperatorName(request.getOperatorName());
        releaseRecord.setActualReleaseTime(request.getActualReleaseTime());
        
        log.info("发布提案: {}", proposalNo);
        return releaseRecordRepository.save(releaseRecord);
    }

    @Transactional
    public ChangeProposal archiveProposal(String proposalNo) {
        ChangeProposal proposal = getProposalByNo(proposalNo);
        
        if (proposal.getStatus() != ProposalStatus.RELEASED) {
            throw new BusinessException("INVALID_STATUS", "只有已发布状态的提案才能归档");
        }

        proposal.setStatus(ProposalStatus.ARCHIVED);
        log.info("归档提案: {}", proposalNo);
        return proposalRepository.save(proposal);
    }

    @Transactional
    public ChangeProposal cancelProposal(String proposalNo, String operatorId) {
        ChangeProposal proposal = getProposalByNo(proposalNo);
        
        if (proposal.getStatus() == ProposalStatus.ARCHIVED || proposal.getStatus() == ProposalStatus.RELEASED) {
            throw new BusinessException("INVALID_STATUS", "已发布或已归档的提案不能撤销");
        }

        proposal.setStatus(ProposalStatus.CANCELLED);
        log.info("撤销提案: {}", proposalNo);
        return proposalRepository.save(proposal);
    }

    public Page<ChangeProposal> queryProposals(ProposalQueryRequest request) {
        Pageable pageable = PageRequest.of(request.getPage(), request.getSize(), Sort.by(Sort.Direction.DESC, "createdAt"));
        return proposalRepository.findByConditions(
                request.getProposalNo(),
                request.getTitle(),
                request.getApiName(),
                request.getStatus(),
                request.getSubmitterId(),
                request.getStartTime(),
                request.getEndTime(),
                pageable
        );
    }

    public ChangeProposal getProposalDetail(String proposalNo) {
        return getProposalByNo(proposalNo);
    }

    public byte[] exportProposal(String proposalNo) {
        ChangeProposal proposal = getProposalByNo(proposalNo);
        List<VoteOpinion> votes = voteOpinionRepository.findByProposalId(proposal.getId());
        List<ImpactItem> impacts = impactItemRepository.findByProposalId(proposal.getId());
        List<BlockReason> blocks = blockReasonRepository.findByProposalId(proposal.getId());
        List<ReleaseRecord> releases = releaseRecordRepository.findByProposalId(proposal.getId());

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("提案详情");
            int rowNum = 0;

            Row headerRow = sheet.createRow(rowNum++);
            headerRow.createCell(0).setCellValue("提案编号");
            headerRow.createCell(1).setCellValue("标题");
            headerRow.createCell(2).setCellValue("API名称");
            headerRow.createCell(3).setCellValue("API版本");
            headerRow.createCell(4).setCellValue("变更类型");
            headerRow.createCell(5).setCellValue("状态");
            headerRow.createCell(6).setCellValue("提交人");
            headerRow.createCell(7).setCellValue("创建时间");
            headerRow.createCell(8).setCellValue("描述");

            Row dataRow = sheet.createRow(rowNum++);
            dataRow.createCell(0).setCellValue(proposal.getProposalNo());
            dataRow.createCell(1).setCellValue(proposal.getTitle());
            dataRow.createCell(2).setCellValue(proposal.getApiName());
            dataRow.createCell(3).setCellValue(proposal.getApiVersion() != null ? proposal.getApiVersion() : "");
            dataRow.createCell(4).setCellValue(proposal.getChangeType().name());
            dataRow.createCell(5).setCellValue(proposal.getStatus().name());
            dataRow.createCell(6).setCellValue(proposal.getSubmitter().getName());
            dataRow.createCell(7).setCellValue(proposal.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            dataRow.createCell(8).setCellValue(proposal.getDescription() != null ? proposal.getDescription() : "");

            rowNum++;
            Row impactHeaderRow = sheet.createRow(rowNum++);
            impactHeaderRow.createCell(0).setCellValue("影响项");
            impactHeaderRow.createCell(1).setCellValue("影响范围");
            impactHeaderRow.createCell(2).setCellValue("影响描述");
            impactHeaderRow.createCell(3).setCellValue("影响服务");
            impactHeaderRow.createCell(4).setCellValue("影响端点");
            impactHeaderRow.createCell(5).setCellValue("兼容性");
            impactHeaderRow.createCell(6).setCellValue("是否通知");

            for (ImpactItem item : impacts) {
                Row itemRow = sheet.createRow(rowNum++);
                itemRow.createCell(1).setCellValue(item.getImpactScope());
                itemRow.createCell(2).setCellValue(item.getImpactDescription());
                itemRow.createCell(3).setCellValue(item.getAffectedService() != null ? item.getAffectedService() : "");
                itemRow.createCell(4).setCellValue(item.getAffectedEndpoint() != null ? item.getAffectedEndpoint() : "");
                itemRow.createCell(5).setCellValue(item.getCompatibilityLevel() != null ? item.getCompatibilityLevel() : "");
                itemRow.createCell(6).setCellValue(item.getIsNotified() ? "是" : "否");
            }

            rowNum++;
            Row voteHeaderRow = sheet.createRow(rowNum++);
            voteHeaderRow.createCell(0).setCellValue("投票记录");
            voteHeaderRow.createCell(1).setCellValue("投票人");
            voteHeaderRow.createCell(2).setCellValue("结果");
            voteHeaderRow.createCell(3).setCellValue("意见");
            voteHeaderRow.createCell(4).setCellValue("投票时间");

            for (VoteOpinion vote : votes) {
                Row voteRow = sheet.createRow(rowNum++);
                voteRow.createCell(1).setCellValue(vote.getVoter().getName());
                voteRow.createCell(2).setCellValue(vote.getResult().name());
                voteRow.createCell(3).setCellValue(vote.getComment() != null ? vote.getComment() : "");
                voteRow.createCell(4).setCellValue(vote.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            }

            rowNum++;
            Row blockHeaderRow = sheet.createRow(rowNum++);
            blockHeaderRow.createCell(0).setCellValue("阻塞记录");
            blockHeaderRow.createCell(1).setCellValue("阻塞人");
            blockHeaderRow.createCell(2).setCellValue("阻塞原因");
            blockHeaderRow.createCell(3).setCellValue("是否解决");
            blockHeaderRow.createCell(4).setCellValue("解决说明");
            blockHeaderRow.createCell(5).setCellValue("创建时间");

            for (BlockReason block : blocks) {
                Row blockRow = sheet.createRow(rowNum++);
                blockRow.createCell(1).setCellValue(block.getBlocker().getName());
                blockRow.createCell(2).setCellValue(block.getReason());
                blockRow.createCell(3).setCellValue(block.getIsResolved() ? "是" : "否");
                blockRow.createCell(4).setCellValue(block.getResolvedNote() != null ? block.getResolvedNote() : "");
                blockRow.createCell(5).setCellValue(block.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            }

            rowNum++;
            Row releaseHeaderRow = sheet.createRow(rowNum++);
            releaseHeaderRow.createCell(0).setCellValue("放行记录");
            releaseHeaderRow.createCell(1).setCellValue("发布版本");
            releaseHeaderRow.createCell(2).setCellValue("发布说明");
            releaseHeaderRow.createCell(3).setCellValue("操作人");
            releaseHeaderRow.createCell(4).setCellValue("实际发布时间");
            releaseHeaderRow.createCell(5).setCellValue("创建时间");

            for (ReleaseRecord release : releases) {
                Row releaseRow = sheet.createRow(rowNum++);
                releaseRow.createCell(1).setCellValue(release.getReleaseVersion());
                releaseRow.createCell(2).setCellValue(release.getReleaseNote() != null ? release.getReleaseNote() : "");
                releaseRow.createCell(3).setCellValue(release.getOperatorName());
                releaseRow.createCell(4).setCellValue(release.getActualReleaseTime() != null ? 
                    release.getActualReleaseTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) : "");
                releaseRow.createCell(5).setCellValue(release.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            }

            for (int i = 0; i < 9; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("导出提案失败: {}", proposalNo, e);
            throw new BusinessException("EXPORT_ERROR", "导出失败");
        }
    }

    private ChangeProposal getProposalByNo(String proposalNo) {
        return proposalRepository.findByProposalNo(proposalNo)
                .orElseThrow(() -> new BusinessException("PROPOSAL_NOT_FOUND", "提案不存在"));
    }

    private String generateProposalNo() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return "AP-" + dateStr + "-" + uuid;
    }

    private void distributeImpactNotification(ChangeProposal proposal) {
        List<ImpactItem> impactItems = impactItemRepository.findByProposalIdAndIsNotifiedFalse(proposal.getId());
        for (ImpactItem item : impactItems) {
            item.setIsNotified(true);
            item.setNotifiedAt(LocalDateTime.now());
            impactItemRepository.save(item);
        }
        log.info("分发影响通知完成: {}", proposal.getProposalNo());
    }
}
