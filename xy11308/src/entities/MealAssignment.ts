import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Elder } from './Elder';
import { Meal } from './Meal';
import { MealChange } from './MealChange';

export enum AssignmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  CHANGED = 'changed'
}

@Entity('meal_assignments')
export class MealAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  elderId: string;

  @Column()
  mealId: string;

  @Column({ type: 'simple-enum', enum: AssignmentStatus, default: AssignmentStatus.PENDING })
  status: AssignmentStatus;

  @Column({ type: 'simple-array', nullable: true })
  ruleCheckResults: string[];

  @Column({ type: 'text', nullable: true })
  ruleCheckDetails: string;

  @Column({ default: false })
  hasConflicts: boolean;

  @Column({ nullable: true })
  notes: string;

  @Column()
  assignedBy: string;

  @Column()
  assignedByRole: string;

  @CreateDateColumn()
  assignedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Elder, elder => elder.mealAssignments)
  @JoinColumn({ name: 'elderId' })
  elder: Elder;

  @ManyToOne(() => Meal, meal => meal.mealAssignments)
  @JoinColumn({ name: 'mealId' })
  meal: Meal;

  @OneToMany(() => MealChange, change => change.originalAssignment)
  mealChanges: MealChange[];
}