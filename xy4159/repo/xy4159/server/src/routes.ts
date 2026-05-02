import { Router, Request, Response } from 'express';
import { db } from './database';
import { diffParser } from './diffParser';
import { exporter } from './exporter';
import { CreateCardRequest, UpdateCardRequest, ExportMarkdownOptions, CardStatus, Severity } from '../../src/types';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/prs', (req: Request, res: Response) => {
  try {
    const prs = db.getAllPRs();
    res.json(prs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get PRs' });
  }
});

router.get('/prs/:id', (req: Request, res: Response) => {
  try {
    const pr = db.getPR(req.params.id);
    if (!pr) {
      res.status(404).json({ error: 'PR not found' });
      return;
    }
    res.json(pr);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get PR' });
  }
});

router.post('/prs', (req: Request, res: Response) => {
  try {
    const { title, description, sourceBranch, targetBranch, author } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    const id = db.createPR(title, description, sourceBranch, targetBranch, author);
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create PR' });
  }
});

router.delete('/prs/:id', (req: Request, res: Response) => {
  try {
    db.deletePR(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete PR' });
  }
});

router.post('/prs/import-diff', (req: Request, res: Response) => {
  try {
    const { prTitle, diffContent, sourceBranch, targetBranch } = req.body;
    if (!prTitle || !diffContent) {
      res.status(400).json({ error: 'prTitle and diffContent are required' });
      return;
    }

    const diffFiles = diffParser.parse(diffContent);
    const addedLines = diffParser.getAddedLines(diffFiles);
    const changedFiles = diffParser.getChangedFiles(diffFiles);

    const prId = db.createPR(prTitle, `Imported from diff (${changedFiles.length} files changed)`, sourceBranch, targetBranch);

    res.status(201).json({
      prId,
      stats: {
        filesChanged: changedFiles.length,
        linesAdded: addedLines.length,
        files: diffFiles.map(f => ({
          path: f.filePath,
          isNew: f.isNew,
          isDeleted: f.isDeleted,
          hunks: f.hunks.length
        }))
      }
    });
  } catch (error) {
    console.error('Import diff error:', error);
    res.status(500).json({ error: 'Failed to import diff' });
  }
});

router.get('/prs/:prId/cards', (req: Request, res: Response) => {
  try {
    const cards = db.getCardsByPR(req.params.prId);
    const cardsWithDetails = cards.map(card => ({
      ...card,
      codeLocations: db.getCodeLocationsByCard(card.id),
      attachments: db.getAttachmentsByCard(card.id),
      reviewRecords: db.getReviewRecordsByCard(card.id)
    }));
    res.json(cardsWithDetails);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cards' });
  }
});

router.get('/cards/:id', (req: Request, res: Response) => {
  try {
    const card = db.getCard(req.params.id);
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    const cardWithDetails = {
      ...card,
      codeLocations: db.getCodeLocationsByCard(card.id),
      attachments: db.getAttachmentsByCard(card.id),
      reviewRecords: db.getReviewRecordsByCard(card.id)
    };
    res.json(cardWithDetails);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get card' });
  }
});

router.post('/cards', (req: Request, res: Response) => {
  try {
    const { prId, title, description, severity, codeLocation, attachment }: CreateCardRequest = req.body;
    
    if (!prId || !title) {
      res.status(400).json({ error: 'prId and title are required' });
      return;
    }

    if (codeLocation) {
      const duplicate = db.checkDuplicateLocation(
        codeLocation.filePath,
        codeLocation.startLine,
        codeLocation.endLine
      );
      if (duplicate) {
        res.status(409).json({
          error: 'Duplicate card found',
          duplicate: {
            cardId: duplicate.card_id,
            cardTitle: duplicate.card_title,
            status: duplicate.status
          }
        });
        return;
      }
    }

    const cardId = db.createCard(prId, title, description || '', severity);

    if (codeLocation) {
      db.createCodeLocation(cardId, codeLocation);
    }

    if (attachment) {
      db.createAttachment(cardId, attachment);
    }

    res.status(201).json({ id: cardId });
  } catch (error) {
    console.error('Create card error:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

router.patch('/cards/:id', (req: Request, res: Response) => {
  try {
    const { title, description, severity, status }: UpdateCardRequest = req.body;
    const cardId = req.params.id;

    const existingCard = db.getCard(cardId);
    if (!existingCard) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    const updates: { title?: string; description?: string; severity?: string; status?: string } = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (severity !== undefined) updates.severity = severity;
    if (status !== undefined && existingCard.status !== status) {
      updates.status = status;
      db.createReviewRecord({
        cardId,
        reviewer: 'system',
        action: 'status_change',
        comment: `Status changed from ${existingCard.status} to ${status}`,
        oldStatus: existingCard.status,
        newStatus: status
      });
    }

    db.updateCard(cardId, updates);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update card' });
  }
});

router.delete('/cards/:id', (req: Request, res: Response) => {
  try {
    db.deleteCard(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

router.post('/cards/:id/locations', (req: Request, res: Response) => {
  try {
    const cardId = req.params.id;
    const card = db.getCard(cardId);
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    const { filePath, startLine, endLine, startColumn, endColumn, lineContent, contextBefore, contextAfter } = req.body;
    if (!filePath || startLine === undefined || endLine === undefined) {
      res.status(400).json({ error: 'filePath, startLine and endLine are required' });
      return;
    }

    const duplicate = db.checkDuplicateLocation(filePath, startLine, endLine);
    if (duplicate && duplicate.card_id !== cardId) {
      res.status(409).json({
        error: 'Duplicate location found in another card',
        duplicate: {
          cardId: duplicate.card_id,
          cardTitle: duplicate.card_title,
          status: duplicate.status
        }
      });
      return;
    }

    const id = db.createCodeLocation(cardId, {
      filePath,
      startLine,
      endLine,
      startColumn,
      endColumn,
      lineContent,
      contextBefore,
      contextAfter
    });
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add location' });
  }
});

router.post('/cards/:id/attachments', (req: Request, res: Response) => {
  try {
    const cardId = req.params.id;
    const card = db.getCard(cardId);
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    const { type, name, data, mimeType } = req.body;
    if (!type || !name || !data || !mimeType) {
      res.status(400).json({ error: 'type, name, data and mimeType are required' });
      return;
    }

    const id = db.createAttachment(cardId, { type, name, data, mimeType });
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add attachment' });
  }
});

router.get('/prs/:prId/export/markdown', (req: Request, res: Response) => {
  try {
    const pr = db.getPR(req.params.prId);
    if (!pr) {
      res.status(404).json({ error: 'PR not found' });
      return;
    }

    const cards = db.getCardsByPR(req.params.prId);
    const cardsWithDetails = cards.map(card => ({
      ...card,
      codeLocations: db.getCodeLocationsByCard(card.id),
      attachments: db.getAttachmentsByCard(card.id),
      reviewRecords: db.getReviewRecordsByCard(card.id)
    }));

    const options: ExportMarkdownOptions = {
      includeAttachments: req.query.includeAttachments === 'true',
      includeReviewHistory: req.query.includeReviewHistory === 'true',
      statusFilter: req.query.status ? (req.query.status as string).split(',') as CardStatus[] : undefined,
      severityFilter: req.query.severity ? (req.query.severity as string).split(',') as Severity[] : undefined
    };

    const markdown = exporter.exportToMarkdown(pr, cardsWithDetails, options);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="review-${pr.id}.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export markdown' });
  }
});

router.get('/prs/:prId/export/json', (req: Request, res: Response) => {
  try {
    const pr = db.getPR(req.params.prId);
    if (!pr) {
      res.status(404).json({ error: 'PR not found' });
      return;
    }

    const cards = db.getCardsByPR(req.params.prId);
    const cardsWithDetails = cards.map(card => ({
      ...card,
      codeLocations: db.getCodeLocationsByCard(card.id),
      attachments: db.getAttachmentsByCard(card.id),
      reviewRecords: db.getReviewRecordsByCard(card.id)
    }));

    const options: ExportMarkdownOptions = {
      statusFilter: req.query.status ? (req.query.status as string).split(',') as CardStatus[] : undefined,
      severityFilter: req.query.severity ? (req.query.severity as string).split(',') as Severity[] : undefined
    };

    const json = exporter.exportToJson(pr, cardsWithDetails, options);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="review-${pr.id}.json"`);
    res.send(json);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export JSON' });
  }
});

export default router;
