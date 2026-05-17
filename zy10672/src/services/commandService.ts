import pool from '../config/database';
import { CommandStatus, ApprovalAction, BatchCommand, CommandApproval } from '../types';
import { createError } from '../middleware/errorHandler';
import { AuditService } from './auditService';

const ALLOWED_TRANSITIONS: Map<CommandStatus, CommandStatus[]> = new Map([
  [CommandStatus.PENDING_APPROVAL, [CommandStatus.APPROVED, CommandStatus.TERMINATED]],
  [CommandStatus.APPROVED, [CommandStatus.EXECUTING, CommandStatus.TERMINATED, CommandStatus.EXPIRED]],
  [CommandStatus.EXECUTING, [CommandStatus.COMPLETED, CommandStatus.FAILED, CommandStatus.TERMINATED]],
  [CommandStatus.EXPIRED, [CommandStatus.APPROVED, CommandStatus.TERMINATED]],
  [CommandStatus.TERMINATED, []],
  [CommandStatus.COMPLETED, []],
  [CommandStatus.FAILED, []],
]);

export class CommandService {
  static async submitCommand(
    requestId: string,
    title: string,
    command: string,
    hostGroupId: string,
    executionWindowStart: Date,
    executionWindowEnd: Date,
    submitterId: string,
    submitterName: string,
    requiredApprovalCount: number = 1
  ): Promise<BatchCommand> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        `SELECT * FROM batch_commands WHERE request_id = $1`,
        [requestId]
      );

      if (existingResult.rows.length > 0) {
        throw createError(
          'DUPLICATE_REQUEST',
          `请求ID ${requestId} 已存在`,
          '请使用唯一的requestId，或查询现有命令状态',
          409,
          { existingCommand: existingResult.rows[0] }
        );
      }

      const hostGroupResult = await client.query(
        `SELECT * FROM host_groups WHERE id = $1 AND is_deleted = false`,
        [hostGroupId]
      );

      if (hostGroupResult.rows.length === 0) {
        throw createError(
          'HOST_GROUP_NOT_FOUND',
          `主机组 ${hostGroupId} 不存在`,
          '请先创建主机组或使用有效的主机组ID'
        );
      }

      const hostGroup = hostGroupResult.rows[0];
      const totalHosts = hostGroup.hosts.length;

      const result = await client.query(
        `INSERT INTO batch_commands (
          request_id, title, command, host_group_id,
          execution_window_start, execution_window_end,
          submitter_id, submitter_name, required_approval_count,
          total_hosts, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          requestId, title, command, hostGroupId,
          executionWindowStart, executionWindowEnd,
          submitterId, submitterName, requiredApprovalCount,
          totalHosts, CommandStatus.PENDING_APPROVAL
        ]
      );

      const newCommand = result.rows[0];

      await AuditService.log(
        newCommand.id,
        ApprovalAction.SUBMIT,
        submitterId,
        submitterName,
        undefined,
        CommandStatus.PENDING_APPROVAL,
        '提交批量命令审批',
        {
          title,
          command,
          hostGroupId,
          executionWindowStart,
          executionWindowEnd,
          totalHosts
        }
      );

      await client.query('COMMIT');
      return newCommand;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async approveCommand(
    commandId: string,
    approverId: string,
    approverName: string,
    remark?: string
  ): Promise<BatchCommand> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const commandResult = await client.query(
        `SELECT * FROM batch_commands WHERE id = $1 FOR UPDATE`,
        [commandId]
      );

      if (commandResult.rows.length === 0) {
        throw createError('NOT_FOUND', '命令不存在', '请检查commandId是否正确');
      }

      const command = commandResult.rows[0];

      if (command.status !== CommandStatus.PENDING_APPROVAL) {
        throw createError(
          'INVALID_STATE_TRANSITION',
          `当前状态 ${command.status} 不允许审批`,
          '只有待审批状态的命令才能进行审批操作'
        );
      }

      const existingApprovalResult = await client.query(
        `SELECT * FROM command_approvals WHERE command_id = $1 AND approver_id = $2`,
        [commandId, approverId]
      );

      if (existingApprovalResult.rows.length > 0) {
        throw createError(
          'DUPLICATE_REQUEST',
          '您已审批过此命令',
          '请勿重复审批'
        );
      }

      await client.query(
        `INSERT INTO command_approvals (
          command_id, approver_id, approver_name, is_approved, remark
        ) VALUES ($1, $2, $3, $4, $5)`,
        [commandId, approverId, approverName, true, remark]
      );

      const newApprovalCount = command.current_approval_count + 1;
      let newStatus = command.status;

      if (newApprovalCount >= command.required_approval_count) {
        const now = new Date();
        if (now > command.execution_window_end) {
          newStatus = CommandStatus.EXPIRED;
        } else {
          newStatus = CommandStatus.APPROVED;
        }
      }

      const updateResult = await client.query(
        `UPDATE batch_commands 
         SET current_approval_count = $1, status = $2
         WHERE id = $3
         RETURNING *`,
        [newApprovalCount, newStatus, commandId]
      );

      await AuditService.log(
        commandId,
        ApprovalAction.APPROVE,
        approverId,
        approverName,
        command.status,
        newStatus,
        remark,
        { newApprovalCount }
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async startExecution(
    commandId: string,
    operatorId: string,
    operatorName: string
  ): Promise<BatchCommand> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const commandResult = await client.query(
        `SELECT * FROM batch_commands WHERE id = $1 FOR UPDATE`,
        [commandId]
      );

      if (commandResult.rows.length === 0) {
        throw createError('NOT_FOUND', '命令不存在', '请检查commandId是否正确');
      }

      const command = commandResult.rows[0];
      const now = new Date();

      if (command.status === CommandStatus.EXPIRED && !command.is_expired_handled) {
        throw createError(
          'EXECUTION_WINDOW_EXPIRED',
          '执行窗口已过期',
          '需要人工备注确认后才能继续执行，请先调用manualRemarkAfterExpired接口',
          425,
          {
            executionWindowEnd: command.execution_window_end,
            currentTime: now
          }
        );
      }

      if (!ALLOWED_TRANSITIONS.get(command.status)?.includes(CommandStatus.EXECUTING)) {
        throw createError(
          'INVALID_STATE_TRANSITION',
          `当前状态 ${command.status} 不允许开始执行`,
          '只有已批准或已处理过期状态的命令才能开始执行'
        );
      }

      if (now < command.execution_window_start || now > command.execution_window_end) {
        if (!command.is_expired_handled) {
          throw createError(
            'EXECUTION_WINDOW_EXPIRED',
            '不在执行时间窗口内',
            '请在执行窗口内操作，或人工备注确认后继续执行',
            425,
            {
              executionWindowStart: command.execution_window_start,
              executionWindowEnd: command.execution_window_end,
              currentTime: now
            }
          );
        }
      }

      const updateResult = await client.query(
        `UPDATE batch_commands 
         SET status = $1
         WHERE id = $2
         RETURNING *`,
        [CommandStatus.EXECUTING, commandId]
      );

      await AuditService.log(
        commandId,
        ApprovalAction.START_EXECUTE,
        operatorId,
        operatorName,
        command.status,
        CommandStatus.EXECUTING,
        '开始执行批量命令'
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async manualRemarkAfterExpired(
    commandId: string,
    operatorId: string,
    operatorName: string,
    remark: string
  ): Promise<BatchCommand> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const commandResult = await client.query(
        `SELECT * FROM batch_commands WHERE id = $1 FOR UPDATE`,
        [commandId]
      );

      if (commandResult.rows.length === 0) {
        throw createError('NOT_FOUND', '命令不存在', '请检查commandId是否正确');
      }

      const command = commandResult.rows[0];

      if (command.status !== CommandStatus.EXPIRED) {
        throw createError(
          'INVALID_STATE_TRANSITION',
          `当前状态 ${command.status} 不需要人工备注`,
          '只有已过期的命令需要人工备注'
        );
      }

      const updateResult = await client.query(
        `UPDATE batch_commands 
         SET is_expired_handled = true, expired_remark = $1
         WHERE id = $2
         RETURNING *`,
        [remark, commandId]
      );

      await AuditService.log(
        commandId,
        ApprovalAction.MANUAL_REMARK,
        operatorId,
        operatorName,
        command.status,
        command.status,
        remark,
        { is_expired_handled: true }
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async continueAfterExpired(
    commandId: string,
    operatorId: string,
    operatorName: string,
    remark: string
  ): Promise<BatchCommand> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const commandResult = await client.query(
        `SELECT * FROM batch_commands WHERE id = $1 FOR UPDATE`,
        [commandId]
      );

      if (commandResult.rows.length === 0) {
        throw createError('NOT_FOUND', '命令不存在', '请检查commandId是否正确');
      }

      const command = commandResult.rows[0];

      if (command.status !== CommandStatus.EXPIRED || !command.is_expired_handled) {
        throw createError(
          'INVALID_STATE_TRANSITION',
          '命令状态不正确',
          '只有已人工备注的过期命令才能继续执行'
        );
      }

      const updateResult = await client.query(
        `UPDATE batch_commands 
         SET status = $1
         WHERE id = $2
         RETURNING *`,
        [CommandStatus.APPROVED, commandId]
      );

      await AuditService.log(
        commandId,
        ApprovalAction.CONTINUE_AFTER_EXPIRED,
        operatorId,
        operatorName,
        CommandStatus.EXPIRED,
        CommandStatus.APPROVED,
        remark
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async terminateCommand(
    commandId: string,
    operatorId: string,
    operatorName: string,
    reason: string
  ): Promise<BatchCommand> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const commandResult = await client.query(
        `SELECT * FROM batch_commands WHERE id = $1 FOR UPDATE`,
        [commandId]
      );

      if (commandResult.rows.length === 0) {
        throw createError('NOT_FOUND', '命令不存在', '请检查commandId是否正确');
      }

      const command = commandResult.rows[0];

      if (!ALLOWED_TRANSITIONS.get(command.status)?.includes(CommandStatus.TERMINATED)) {
        throw createError(
          'INVALID_STATE_TRANSITION',
          `当前状态 ${command.status} 不允许终止`,
          '命令已完成或已终止，无法再次终止'
        );
      }

      const updateResult = await client.query(
        `UPDATE batch_commands 
         SET status = $1
         WHERE id = $2
         RETURNING *`,
        [CommandStatus.TERMINATED, commandId]
      );

      await AuditService.log(
        commandId,
        ApprovalAction.TERMINATE,
        operatorId,
        operatorName,
        command.status,
        CommandStatus.TERMINATED,
        reason
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async completeExecution(
    commandId: string,
    successHosts: number,
    failedHosts: number
  ): Promise<BatchCommand> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const commandResult = await client.query(
        `SELECT * FROM batch_commands WHERE id = $1 FOR UPDATE`,
        [commandId]
      );

      if (commandResult.rows.length === 0) {
        throw createError('NOT_FOUND', '命令不存在', '请检查commandId是否正确');
      }

      const command = commandResult.rows[0];

      if (command.status !== CommandStatus.EXECUTING) {
        throw createError(
          'INVALID_STATE_TRANSITION',
          `当前状态 ${command.status} 不是执行中`,
          '只有执行中的命令才能标记完成'
        );
      }

      const finalStatus = failedHosts === 0 ? CommandStatus.COMPLETED : 
                         successHosts === 0 ? CommandStatus.FAILED : CommandStatus.COMPLETED;

      const updateResult = await client.query(
        `UPDATE batch_commands 
         SET status = $1, success_hosts = $2, failed_hosts = $3
         WHERE id = $4
         RETURNING *`,
        [finalStatus, successHosts, failedHosts, commandId]
      );

      await AuditService.log(
        commandId,
        finalStatus === CommandStatus.COMPLETED ? ApprovalAction.COMPLETE : ApprovalAction.FAIL,
        'system',
        'System',
        command.status,
        finalStatus,
        `执行完成: 成功${successHosts}台, 失败${failedHosts}台`
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getCommand(commandId: string): Promise<BatchCommand> {
    const result = await pool.query(
      `SELECT * FROM batch_commands WHERE id = $1`,
      [commandId]
    );

    if (result.rows.length === 0) {
      throw createError('NOT_FOUND', '命令不存在', '请检查commandId是否正确');
    }

    return result.rows[0];
  }

  static async listCommands(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      status?: CommandStatus;
      submitterId?: string;
      hostGroupId?: string;
    }
  ): Promise<{ commands: BatchCommand[]; total: number }> {
    let query = `SELECT * FROM batch_commands WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) FROM batch_commands WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      countQuery += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.submitterId) {
      query += ` AND submitter_id = $${paramIndex}`;
      countQuery += ` AND submitter_id = $${paramIndex}`;
      params.push(filters.submitterId);
      paramIndex++;
    }

    if (filters?.hostGroupId) {
      query += ` AND host_group_id = $${paramIndex}`;
      countQuery += ` AND host_group_id = $${paramIndex}`;
      params.push(filters.hostGroupId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSize, (page - 1) * pageSize);

    const [commandsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, paramIndex - 1))
    ]);

    return {
      commands: commandsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  static async getCommandApprovals(commandId: string): Promise<CommandApproval[]> {
    const result = await pool.query(
      `SELECT * FROM command_approvals WHERE command_id = $1 ORDER BY approved_at DESC`,
      [commandId]
    );
    return result.rows;
  }

  static async reportAgentExecution(
    commandId: string,
    hostAddress: string,
    status: string,
    exitCode?: number,
    stdout?: string,
    stderr?: string,
    startedAt?: Date,
    finishedAt?: Date
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const commandResult = await client.query(
        `SELECT * FROM batch_commands WHERE id = $1`,
        [commandId]
      );

      if (commandResult.rows.length === 0) {
        throw createError('NOT_FOUND', '命令不存在', '请检查commandId是否正确');
      }

      const command = commandResult.rows[0];
      const now = new Date();

      if (now > command.execution_window_end && command.status !== CommandStatus.EXECUTING) {
        throw createError(
          'AGENT_EXECUTION_ABNORMAL',
          '代理在执行窗口外上报执行结果',
          '该执行可能属于异常上报，请人工确认后决定是否继续流程',
          428,
          {
            executionWindowEnd: command.execution_window_end,
            reportTime: now,
            commandStatus: command.status
          }
        );
      }

      const existingRecord = await client.query(
        `SELECT * FROM execution_records WHERE command_id = $1 AND host_address = $2`,
        [commandId, hostAddress]
      );

      if (existingRecord.rows.length > 0) {
        await client.query(
          `UPDATE execution_records 
           SET status = $1, exit_code = $2, stdout = $3, stderr = $4,
               started_at = $5, finished_at = $6, agent_executed = true
           WHERE command_id = $7 AND host_address = $8`,
          [status, exitCode, stdout, stderr, startedAt, finishedAt, commandId, hostAddress]
        );
      } else {
        await client.query(
          `INSERT INTO execution_records (
            command_id, host_address, status, exit_code, stdout, stderr,
            started_at, finished_at, agent_executed
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [commandId, hostAddress, status, exitCode, stdout, stderr, startedAt, finishedAt, true]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getExecutionRecords(commandId: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM execution_records WHERE command_id = $1 ORDER BY created_at DESC`,
      [commandId]
    );
    return result.rows;
  }
}
