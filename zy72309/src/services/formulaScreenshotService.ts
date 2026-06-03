import systemStore from '../store/systemStore';
import { generateId } from '../utils/idGenerator';
import { FormulaScreenshot, ErrorExplanation } from '../types';

export class FormulaScreenshotService {
  public uploadFormulaScreenshot(
    batchId: string,
    imageUrl: string,
    description: string,
    formulaText: string,
    uploadedBy: string
  ): FormulaScreenshot {
    const screenshot: FormulaScreenshot = {
      id: generateId(),
      batchId,
      imageUrl,
      description,
      formulaText,
      uploadedBy,
      uploadedAt: new Date(),
      isActive: false
    };

    systemStore.addFormulaScreenshot(screenshot);
    return screenshot;
  }

  public setActiveScreenshot(id: string): void {
    systemStore.setActiveFormulaScreenshot(id);
  }

  public getActiveScreenshot(): FormulaScreenshot | undefined {
    return systemStore.getActiveFormulaScreenshot();
  }

  public getAllScreenshots(): FormulaScreenshot[] {
    return systemStore.getFormulaScreenshots();
  }

  public createErrorExplanation(
    batchId: string,
    title: string,
    content: string,
    createdBy: string
  ): ErrorExplanation {
    const explanation: ErrorExplanation = {
      id: generateId(),
      batchId,
      title,
      content,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    systemStore.addErrorExplanation(explanation);
    return explanation;
  }

  public updateErrorExplanation(
    explanationId: string,
    title: string,
    content: string
  ): ErrorExplanation | null {
    const explanations = systemStore.getErrorExplanations();
    const explanation = explanations.find(e => e.id === explanationId);
    if (!explanation) return null;

    explanation.title = title;
    explanation.content = content;
    explanation.updatedAt = new Date();

    systemStore.updateErrorExplanation(explanation);
    return explanation;
  }

  public getErrorExplanations(): ErrorExplanation[] {
    return systemStore.getErrorExplanations();
  }

  public getErrorExplanationsByBatch(batchId: string): ErrorExplanation[] {
    return systemStore.getErrorExplanations().filter(e => e.batchId === batchId);
  }
}

export default new FormulaScreenshotService();
