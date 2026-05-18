import { v4 as uuidv4 } from 'uuid';
import { ReplacementApplication, CreateApplicationRequest, ApplicationStatus, DietaryRestriction, ReplacementItem } from '../types';
import { validationService } from './validationService';

class ApplicationService {
  private applications: Map<string, ReplacementApplication> = new Map();

  createApplication(request: CreateApplicationRequest): ReplacementApplication {
    const validation = validationService.validateApplication(request);

    const dietaryRestrictions: DietaryRestriction[] = request.dietaryRestrictions.map(r => ({
      ...r,
      id: uuidv4()
    }));

    const replacementItems: ReplacementItem[] = request.replacementItems.map(item => ({
      ...item,
      id: uuidv4()
    }));

    const now = new Date().toISOString();
    const application: ReplacementApplication = {
      id: uuidv4(),
      ...request,
      dietaryRestrictions,
      replacementItems,
      status: validation.valid ? ApplicationStatus.PENDING : validation.status!,
      rejectionReason: validation.rejectionReason,
      rejectionMessage: validation.message,
      createdAt: now,
      updatedAt: now
    };

    this.applications.set(application.id, application);
    return application;
  }

  getApplicationById(id: string): ReplacementApplication | undefined {
    return this.applications.get(id);
  }

  getAllApplications(): ReplacementApplication[] {
    return Array.from(this.applications.values());
  }

  getApplicationsByStatus(status: ApplicationStatus): ReplacementApplication[] {
    return Array.from(this.applications.values()).filter(a => a.status === status);
  }

  approveApplication(id: string, reviewedBy: string): ReplacementApplication | undefined {
    const application = this.applications.get(id);
    if (!application) return undefined;

    application.status = ApplicationStatus.APPROVED;
    application.reviewedBy = reviewedBy;
    application.reviewedAt = new Date().toISOString();
    application.updatedAt = new Date().toISOString();
    
    return application;
  }

  rejectApplication(id: string, reviewedBy: string, reason: string): ReplacementApplication | undefined {
    const application = this.applications.get(id);
    if (!application) return undefined;

    application.status = ApplicationStatus.REJECTED;
    application.reviewedBy = reviewedBy;
    application.reviewedAt = new Date().toISOString();
    application.updatedAt = new Date().toISOString();
    application.rejectionMessage = reason;
    
    return application;
  }

  exportApplication(id: string): object | undefined {
    const application = this.applications.get(id);
    if (!application) return undefined;

    return {
      exportTime: new Date().toISOString(),
      application: {
        id: application.id,
        orderId: application.orderId,
        motherName: application.motherName,
        roomNumber: application.roomNumber,
        mealPlanType: application.mealPlanType,
        status: application.status,
        deliveryDateRange: application.deliveryDateRange,
        dietaryRestrictions: application.dietaryRestrictions,
        replacementItems: application.replacementItems,
        rejectionMessage: application.rejectionMessage
      }
    };
  }

  clearAll(): void {
    this.applications.clear();
  }
}

export const applicationService = new ApplicationService();
