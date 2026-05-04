import * as fs from 'fs';
import * as path from 'path';
import { WallZone, Route, Hold, WearRecord, Feedback, Review } from '../types';

interface DatabaseData {
  wallZones: WallZone[];
  routes: Route[];
  holds: Hold[];
  wearRecords: WearRecord[];
  feedback: Feedback[];
  reviews: Review[];
}

const DEFAULT_DATA: DatabaseData = {
  wallZones: [],
  routes: [],
  holds: [],
  wearRecords: [],
  feedback: [],
  reviews: []
};

export class DatabaseService {
  private dbPath: string;
  private data: DatabaseData;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.data = this.loadData();
  }

  private loadData(): DatabaseData {
    try {
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.error('Failed to load database:', err);
    }
    return { ...DEFAULT_DATA };
  }

  private saveData(): void {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save database:', err);
    }
  }

  private getNextId<T extends { id?: number }>(items: T[]): number {
    if (items.length === 0) return 1;
    const maxId = Math.max(...items.map(item => item.id || 0));
    return maxId + 1;
  }

  // Wall Zones
  saveWallZone(zone: Omit<WallZone, 'id'> & { id?: number }): number {
    if (zone.id) {
      const index = this.data.wallZones.findIndex(z => z.id === zone.id);
      if (index !== -1) {
        this.data.wallZones[index] = { ...zone } as WallZone;
      }
    } else {
      const newZone: WallZone = {
        ...zone,
        id: this.getNextId(this.data.wallZones)
      };
      const existingIndex = this.data.wallZones.findIndex(z => z.code === zone.code);
      if (existingIndex !== -1) {
        this.data.wallZones[existingIndex] = { ...newZone, id: this.data.wallZones[existingIndex].id };
      } else {
        this.data.wallZones.push(newZone);
      }
    }
    this.saveData();
    return zone.id || this.data.wallZones.length;
  }

  getWallZones(): WallZone[] {
    return [...this.data.wallZones];
  }

  getWallZoneByCode(code: string): WallZone | undefined {
    return this.data.wallZones.find(z => z.code === code);
  }

  // Routes
  saveRoute(route: Omit<Route, 'id' | 'createdAt' | 'updatedAt'> & { id?: number; createdAt?: string; updatedAt?: string }): number {
    const now = new Date().toISOString();
    
    if (route.id) {
      const index = this.data.routes.findIndex(r => r.id === route.id);
      if (index !== -1) {
        this.data.routes[index] = {
          ...this.data.routes[index],
          ...route,
          updatedAt: now
        };
      }
      this.saveData();
      return route.id;
    } else {
      const existingRoute = this.data.routes.find(r => r.code === route.code);
      if (existingRoute) {
        Object.assign(existingRoute, route, { updatedAt: now });
        this.saveData();
        return existingRoute.id!;
      }
      
      const newRoute: Route = {
        ...route,
        id: this.getNextId(this.data.routes),
        createdAt: now,
        updatedAt: now
      };
      this.data.routes.push(newRoute);
      this.saveData();
      return newRoute.id!;
    }
  }

  getAllRoutes(): Route[] {
    return [...this.data.routes];
  }

  getRouteByCode(code: string): Route | undefined {
    return this.data.routes.find(r => r.code === code);
  }

  getRoutesByZone(zoneCode: string): Route[] {
    return this.data.routes.filter(r => r.zoneCode === zoneCode);
  }

  getChildrenRoutes(): Route[] {
    return this.data.routes.filter(r => r.isChildrenRoute);
  }

  deleteRoute(id: number): void {
    const index = this.data.routes.findIndex(r => r.id === id);
    if (index !== -1) {
      this.data.routes.splice(index, 1);
      this.saveData();
    }
  }

  // Holds
  saveHold(hold: Omit<Hold, 'id'> & { id?: number }): number {
    if (hold.id) {
      const index = this.data.holds.findIndex(h => h.id === hold.id);
      if (index !== -1) {
        this.data.holds[index] = { ...hold } as Hold;
      }
    } else {
      const existingHold = this.data.holds.find(h => h.code === hold.code);
      if (existingHold) {
        Object.assign(existingHold, hold);
        this.saveData();
        return existingHold.id!;
      }
      
      const newHold: Hold = {
        ...hold,
        id: this.getNextId(this.data.holds)
      };
      this.data.holds.push(newHold);
    }
    this.saveData();
    return hold.id || this.data.holds.length;
  }

  getAllHolds(): Hold[] {
    return [...this.data.holds];
  }

  getHoldByCode(code: string): Hold | undefined {
    return this.data.holds.find(h => h.code === code);
  }

  updateHoldUseCount(code: string, useCount: number): void {
    const hold = this.data.holds.find(h => h.code === code);
    if (hold) {
      hold.currentUseCount = useCount;
      this.saveData();
    }
  }

  // Wear Records
  saveWearRecord(record: Omit<WearRecord, 'id'> & { id?: number }): number {
    if (record.id) {
      const index = this.data.wearRecords.findIndex(r => r.id === record.id);
      if (index !== -1) {
        this.data.wearRecords[index] = { ...record } as WearRecord;
      }
    } else {
      const newRecord: WearRecord = {
        ...record,
        id: this.getNextId(this.data.wearRecords)
      };
      this.data.wearRecords.push(newRecord);
    }
    this.saveData();
    return record.id || this.data.wearRecords.length;
  }

  getWearRecordsByHold(holdCode: string): WearRecord[] {
    return this.data.wearRecords
      .filter(r => r.holdCode === holdCode)
      .sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());
  }

  // Feedback
  saveFeedback(feedback: Omit<Feedback, 'id'> & { id?: number }): number {
    if (feedback.id) {
      const index = this.data.feedback.findIndex(f => f.id === feedback.id);
      if (index !== -1) {
        this.data.feedback[index] = { ...feedback } as Feedback;
      }
    } else {
      const newFeedback: Feedback = {
        ...feedback,
        id: this.getNextId(this.data.feedback)
      };
      this.data.feedback.push(newFeedback);
    }
    this.saveData();
    return feedback.id || this.data.feedback.length;
  }

  getAllFeedback(): Feedback[] {
    return [...this.data.feedback]
      .sort((a, b) => new Date(b.feedbackDate).getTime() - new Date(a.feedbackDate).getTime());
  }

  getFeedbackByRoute(routeCode: string): Feedback[] {
    return this.data.feedback
      .filter(f => f.routeCode === routeCode)
      .sort((a, b) => new Date(b.feedbackDate).getTime() - new Date(a.feedbackDate).getTime());
  }

  // Reviews
  saveReview(review: Omit<Review, 'id'> & { id?: number }): number {
    if (review.id) {
      const index = this.data.reviews.findIndex(r => r.id === review.id);
      if (index !== -1) {
        this.data.reviews[index] = { ...review } as Review;
      }
    } else {
      const newReview: Review = {
        ...review,
        id: this.getNextId(this.data.reviews)
      };
      this.data.reviews.push(newReview);
    }
    this.saveData();
    return review.id || this.data.reviews.length;
  }

  getAllReviews(): Review[] {
    return [...this.data.reviews]
      .sort((a, b) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime());
  }

  getUnresolvedReviews(): Review[] {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return this.data.reviews
      .filter(r => !r.resolved)
      .sort((a, b) => {
        const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime();
      });
  }

  close(): void {
    this.saveData();
  }
}
