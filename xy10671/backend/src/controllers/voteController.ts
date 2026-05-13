import { Request, Response } from 'express';
import { OwnerVote, OperationLog, sequelize } from '../models';
import { VoteResult } from '../types';
import { recordChangeHistory } from '../utils/historyUtils';

export const getVotes = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const votes = await OwnerVote.findAll({
      where: { projectId },
      order: [['voteTime', 'DESC']]
    });
    res.json({ success: true, data: votes });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取投票列表失败' });
  }
};

export const createVote = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { projectId } = req.params;
    const { ownerName, ownerRoom, voteResult, remarks } = req.body;
    
    const existingVote = await OwnerVote.findOne({
      where: { projectId, ownerRoom }
    }, { transaction });
    
    if (existingVote) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '该业主已投票' });
    }
    
    const vote = await OwnerVote.create({
      projectId,
      ownerName,
      ownerRoom,
      voteResult,
      remarks,
      voteTime: new Date()
    }, { transaction });
    
    await OperationLog.create({
      projectId,
      operationType: 'VOTE',
      operationContent: `${ownerName} (${ownerRoom}) 投票: ${voteResult}`,
      operator: ownerName
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: vote });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '投票失败' });
  }
};

export const updateVote = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { updatedBy, ...updates } = req.body;
    
    const vote = await OwnerVote.findByPk(id, { transaction });
    if (!vote) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: '投票不存在' });
    }
    
    const oldValues = vote.toJSON();
    await vote.update(updates, { transaction });
    
    for (const [key, value] of Object.entries(updates)) {
      await recordChangeHistory(
        vote.projectId, 
        'OwnerVote', 
        id, 
        key, 
        oldValues[key as keyof typeof oldValues], 
        value, 
        updatedBy
      );
    }
    
    await OperationLog.create({
      projectId: vote.projectId,
      operationType: 'VOTE_UPDATE',
      operationContent: `更新投票: ${vote.ownerName}`,
      operator: updatedBy
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: vote });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '更新投票失败' });
  }
};

export const getVoteStatistics = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const allVotes = await OwnerVote.findAll({ where: { projectId } });
    
    const statistics = {
      total: allVotes.length,
      agree: allVotes.filter(v => v.voteResult === VoteResult.AGREE).length,
      disagree: allVotes.filter(v => v.voteResult === VoteResult.DISAGREE).length,
      abstain: allVotes.filter(v => v.voteResult === VoteResult.ABSTAIN).length
    };
    
    res.json({ success: true, data: statistics });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取投票统计失败' });
  }
};
