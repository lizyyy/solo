import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { MealAssignment } from './MealAssignment';

export enum ChronicDisease {
  DIABETES = 'diabetes',
  HYPERTENSION = 'hypertension',
  HEART_DISEASE = 'heart_disease',
  KIDNEY_DISEASE = 'kidney_disease',
  GOUT = 'gout'
}

@Entity('elders')
export class Elder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  idCard: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  roomNumber: string;

  @Column({ type: 'simple-array', nullable: true })
  allergies: string[];

  @Column({ type: 'simple-array', nullable: true })
  chronicDiseases: ChronicDisease[];

  @Column({ type: 'simple-array', nullable: true })
  dietaryRestrictions: string[];

  @Column({ nullable: true })
  notes: string;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  createdBy: string;

  @Column()
  createdByRole: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => MealAssignment, assignment => assignment.elder)
  mealAssignments: MealAssignment[];
}