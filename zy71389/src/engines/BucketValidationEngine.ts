import { UserBucket } from '../types';

export interface BucketValidationResult {
  crossGroupUsers: Map<string, UserBucket[]>;
  crossGroupUserIds: string[];
  crossGroupRate: number;
  totalUsers: number;
  validBuckets: Map<string, UserBucket>;
}

export class BucketValidationEngine {
  static validate(userBuckets: UserBucket[]): BucketValidationResult {
    const userBucketsMap = new Map<string, UserBucket[]>();
    const validBuckets = new Map<string, UserBucket>();

    userBuckets.forEach(bucket => {
      const key = `${bucket.userId}_${bucket.experimentId}`;
      if (!userBucketsMap.has(key)) {
        userBucketsMap.set(key, []);
      }
      userBucketsMap.get(key)!.push(bucket);
    });

    const crossGroupUsers = new Map<string, UserBucket[]>();
    const crossGroupUserIds: string[] = [];
    const uniqueUsers = new Set<string>();

    userBucketsMap.forEach((buckets, key) => {
      const userId = buckets[0].userId;
      uniqueUsers.add(userId);

      const groupIds = new Set(buckets.map(b => b.groupId));
      
      if (groupIds.size > 1) {
        crossGroupUsers.set(key, buckets.sort((a, b) => a.bucketTime - b.bucketTime));
        if (!crossGroupUserIds.includes(userId)) {
          crossGroupUserIds.push(userId);
        }
        const earliestBucket = buckets.reduce((earliest, current) => 
          current.bucketTime < earliest.bucketTime ? current : earliest
        );
        validBuckets.set(key, earliestBucket);
      } else {
        const earliestBucket = buckets.reduce((earliest, current) => 
          current.bucketTime < earliest.bucketTime ? current : earliest
        );
        validBuckets.set(key, earliestBucket);
      }
    });

    const totalUsers = uniqueUsers.size;
    const crossGroupRate = totalUsers > 0 ? crossGroupUserIds.length / totalUsers : 0;

    return {
      crossGroupUsers,
      crossGroupUserIds,
      crossGroupRate,
      totalUsers,
      validBuckets
    };
  }

  static getUserBuckets(userId: string, userBuckets: UserBucket[]): UserBucket[] {
    return userBuckets
      .filter(b => b.userId === userId)
      .sort((a, b) => a.bucketTime - b.bucketTime);
  }

  static isUserCrossGroup(userId: string, experimentId: string, crossGroupUsers: Map<string, UserBucket[]>): boolean {
    const key = `${userId}_${experimentId}`;
    return crossGroupUsers.has(key);
  }

  static getCrossGroupReason(userId: string, experimentId: string, crossGroupUsers: Map<string, UserBucket[]>): string {
    const key = `${userId}_${experimentId}`;
    const buckets = crossGroupUsers.get(key);
    if (!buckets || buckets.length < 2) return '';
    
    const groups = buckets.map(b => `${b.groupName}(${b.groupId})@${new Date(b.bucketTime).toLocaleString()}`).join(', ');
    return `用户在实验中被分到多个组: ${groups}`;
  }
}
