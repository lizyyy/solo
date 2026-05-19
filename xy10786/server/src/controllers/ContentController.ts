import { Request, Response } from 'express';
import { ContentService } from '../services/ContentService';
import { ApiResponse, ResponseCode, ContentStatus, ReviewAction } from '../types';
import { createObjectCsvStringifier } from 'csv-writer';

export class ContentController {
  private contentService: ContentService;

  constructor() {
    this.contentService = new ContentService();
  }

  private sendResponse<T>(res: Response, data: {
    success: boolean;
    code: ResponseCode;
    message: string;
    data?: T;
  }) {
    res.status(data.code).json({
      success: data.success,
      code: data.code,
      message: data.message,
      data: data.data
    } as ApiResponse<T>);
  }

  createContent = async (req: Request, res: Response) => {
    try {
      const { title, content, author, scheduledAt, channels, idempotencyKey } = req.body;
      
      if (!title || !content || !author) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.VALIDATION_ERROR,
          message: 'Missing required fields: title, content, author'
        });
      }

      const result = await this.contentService.createContent({
        title,
        content,
        author,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        channels,
        idempotencyKey
      });

      if (!result.isNew) {
        return this.sendResponse(res, {
          success: true,
          code: ResponseCode.SUCCESS,
          message: 'Content already exists (idempotent)',
          data: result.content
        });
      }

      if (result.content.status === ContentStatus.PENDING_REVIEW) {
        return this.sendResponse(res, {
          success: true,
          code: ResponseCode.PENDING_REVIEW,
          message: 'Content created and pending review',
          data: result.content
        });
      }

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Content created successfully',
        data: result.content
      });
    } catch (error) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  getContent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const content = await this.contentService.getContent(id);
      
      if (!content) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.NOT_FOUND,
          message: 'Content not found'
        });
      }

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Content retrieved successfully',
        data: content
      });
    } catch (error) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  getContentList = async (req: Request, res: Response) => {
    try {
      const { status, page, pageSize } = req.query;
      
      const result = await this.contentService.getContentList({
        status: status as ContentStatus,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined
      });

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Content list retrieved successfully',
        data: result
      });
    } catch (error) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  updateContent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { title, content, scheduledAt, channels } = req.body;

      const updated = await this.contentService.updateContent(id, {
        title,
        content,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        channels
      });

      if (!updated) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.NOT_FOUND,
          message: 'Content not found'
        });
      }

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Content updated successfully',
        data: updated
      });
    } catch (error) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  submitForReview = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reviewer } = req.body;

      const updated = await this.contentService.submitForReview(id, reviewer || 'admin');

      if (!updated) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.NOT_FOUND,
          message: 'Content not found'
        });
      }

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.PENDING_REVIEW,
        message: 'Content submitted for review',
        data: updated
      });
    } catch (error: any) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.BLOCKED,
        message: error.message || 'Operation blocked'
      });
    }
  };

  reviewContent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { action, reviewer, reason, remark } = req.body;

      if (!action || !reason) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.VALIDATION_ERROR,
          message: 'Missing required fields: action, reason'
        });
      }

      const updated = await this.contentService.reviewContent(
        id,
        action as ReviewAction,
        reviewer || 'admin',
        reason,
        remark
      );

      if (!updated) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.NOT_FOUND,
          message: 'Content not found'
        });
      }

      if (updated.status === ContentStatus.NEEDS_REVIEW) {
        return this.sendResponse(res, {
          success: true,
          code: ResponseCode.RETRYABLE,
          message: 'Content needs review and revision',
          data: updated
        });
      }

      if (updated.status === ContentStatus.BLOCKED) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.BLOCKED,
          message: 'Content has been blocked',
          data: updated
        });
      }

      if (updated.status === ContentStatus.WITHDRAWN) {
        return this.sendResponse(res, {
          success: true,
          code: ResponseCode.RETRYABLE,
          message: 'Content withdrawn, can be resubmitted',
          data: updated
        });
      }

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Review completed successfully',
        data: updated
      });
    } catch (error: any) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.BLOCKED,
        message: error.message || 'Operation blocked'
      });
    }
  };

  retryPublish = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const updated = await this.contentService.retryPublish(id);

      if (!updated) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.NOT_FOUND,
          message: 'Content not found'
        });
      }

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Publish retry initiated',
        data: updated
      });
    } catch (error: any) {
      if (error.message.includes('Max retries')) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.BLOCKED,
          message: error.message
        });
      }
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.RETRYABLE,
        message: error.message || 'Can be retried'
      });
    }
  };

  retryChannelSync = async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;

      const updated = await this.contentService.retryChannelSync(channelId);

      if (!updated) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.NOT_FOUND,
          message: 'Channel not found'
        });
      }

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Channel sync retry initiated',
        data: updated
      });
    } catch (error: any) {
      if (error.message.includes('Max retries')) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.BLOCKED,
          message: error.message
        });
      }
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.RETRYABLE,
        message: error.message || 'Can be retried'
      });
    }
  };

  getDashboardStats = async (req: Request, res: Response) => {
    try {
      const stats = await this.contentService.getDashboardStats();

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Dashboard stats retrieved successfully',
        data: stats
      });
    } catch (error) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  getTimeline = async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;
      const timeline = await this.contentService.getTimeline(contentId);

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Timeline retrieved successfully',
        data: timeline
      });
    } catch (error) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  getCalendar = async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const events = await this.contentService.getCalendar(start, end);

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Calendar events retrieved successfully',
        data: events
      });
    } catch (error) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  exportCalendar = async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const events = await this.contentService.getCalendar(start, end);

      const csvStringifier = createObjectCsvStringifier({
        path: '',
        header: [
          { id: 'id', title: 'ID' },
          { id: 'title', title: '标题' },
          { id: 'start', title: '发布时间' },
          { id: 'status', title: '状态' },
          { id: 'channels', title: '发布渠道' }
        ]
      });

      const records = events.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start.toISOString(),
        status: event.status,
        channels: event.channels.join(', ')
      }));

      const csv = '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="publish-calendar-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  fixChannelSync = async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      const { correction, operator } = req.body;

      if (!correction) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.VALIDATION_ERROR,
          message: 'Missing required fields: correction'
        });
      }

      const updated = await this.contentService.fixChannelSync(channelId, correction, operator || 'admin');

      if (!updated) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.NOT_FOUND,
          message: 'Channel not found'
        });
      }

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.RETRYABLE,
        message: 'Channel sync fix applied, ready for retry',
        data: updated
      });
    } catch (error) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  };

  publishNow = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const updated = await this.contentService.simulatePublishNow(id);

      if (!updated) {
        return this.sendResponse(res, {
          success: false,
          code: ResponseCode.NOT_FOUND,
          message: 'Content not found'
        });
      }

      this.sendResponse(res, {
        success: true,
        code: ResponseCode.SUCCESS,
        message: 'Publish initiated',
        data: updated
      });
    } catch (error: any) {
      this.sendResponse(res, {
        success: false,
        code: ResponseCode.BLOCKED,
        message: error.message || 'Operation blocked'
      });
    }
  };
}
