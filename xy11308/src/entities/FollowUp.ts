import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MealAssignment } from './MealAssignment';

export enum SatisfactionLevel {
  VERY_DISSATISFIED = 'very_dissatisfied',
  DISSATISFIED = 'dissatisfied',
  NEUTRAL = 'neutral',
  SATISFIED = 'satisfied',
  VERY_SATISFIED = 'very_satisfied'
}

@Entity('follow_ups')
export class FollowUp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  assignmentId: string;

  @Column({ type: 'simple-enum', enum: SatisfactionLevel })
  satisfaction: SatisfactionLevel;

  @Column({ default: false })
  mealQualityOk: boolean;

  @Column({ default: false })
  temperatureOk: boolean;

  @Column({ default: false })
  deliveryTimeOk: boolean;

  @Column({ type: 'simple-array', nullable: true })
  complaints: string[];

  @Column({ type: 'simple-array', nullable: true })
  suggestions: string[];

  @Column({ nullable: true })
  notes: string;

  @Column()
  conductedBy: string;

  @Column()
  conductedByRole: string;

  @CreateDateColumn()
  conductedAt: Date;

  @ManyToOne(() => MealAssignment)
  @JoinColumn({ name: 'assignmentId' })
  assignment: MealAssignment;
}