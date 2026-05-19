import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MealAssignment } from './MealAssignment';
import { Meal } from './Meal';

export enum ChangeReason {
  DIETARY_REQUEST = 'dietary_request',
  HEALTH_ISSUE = 'health_issue',
  TASTE_PREFERENCE = 'taste_preference',
  ADMIN_CHANGE = 'admin_change',
  OTHER = 'other'
}

@Entity('meal_changes')
export class MealChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  assignmentId: string;

  @Column()
  originalMealId: string;

  @Column()
  newMealId: string;

  @Column({ type: 'simple-enum', enum: ChangeReason })
  reason: ChangeReason;

  @Column({ type: 'text', nullable: true })
  reasonDetails: string;

  @Column({ type: 'simple-array', nullable: true })
  ruleCheckResults: string[];

  @Column({ type: 'text', nullable: true })
  ruleCheckDetails: string;

  @Column()
  changedBy: string;

  @Column()
  changedByRole: string;

  @CreateDateColumn()
  changedAt: Date;

  @ManyToOne(() => MealAssignment, assignment => assignment.mealChanges)
  @JoinColumn({ name: 'assignmentId' })
  originalAssignment: MealAssignment;

  @ManyToOne(() => Meal)
  @JoinColumn({ name: 'originalMealId' })
  originalMeal: Meal;

  @ManyToOne(() => Meal)
  @JoinColumn({ name: 'newMealId' })
  newMeal: Meal;
}