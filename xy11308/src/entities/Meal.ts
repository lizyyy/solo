import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { MealAssignment } from './MealAssignment';

export enum MealType {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner'
}

@Entity('meals')
export class Meal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'simple-enum', enum: MealType })
  type: MealType;

  @Column({ type: 'simple-array', nullable: true })
  ingredients: string[];

  @Column({ type: 'simple-array', nullable: true })
  allergens: string[];

  @Column({ default: false })
  isDiabetesFriendly: boolean;

  @Column({ default: false })
  isLowSalt: boolean;

  @Column({ default: false })
  isLowSugar: boolean;

  @Column({ default: false })
  isLowPurine: boolean;

  @Column({ nullable: true })
  description: string;

  @Column()
  createdBy: string;

  @Column()
  createdByRole: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => MealAssignment, assignment => assignment.meal)
  mealAssignments: MealAssignment[];
}