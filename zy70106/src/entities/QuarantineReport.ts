import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export type ReportStatus = "draft" | "submitted" | "approved" | "rejected";

@Entity()
export class QuarantineReport {
  @PrimaryColumn()
  id: string;

  @Column()
  reportNumber: string;

  @Column({ type: "date" })
  reportDate: Date;

  @Column({ type: "date" })
  reportPeriodStart: Date;

  @Column({ type: "date" })
  reportPeriodEnd: Date;

  @Column()
  penIds: string;

  @Column({ type: "int" })
  totalAnimals: number;

  @Column({ type: "int" })
  totalVaccinated: number;

  @Column({ type: "int" })
  pendingVaccinations: number;

  @Column({ type: "int" })
  overdueVaccinations: number;

  @Column({ type: "varchar" })
  status: ReportStatus;

  @Column()
  generatedBy: string;

  @Column({ nullable: true })
  approvedBy?: string;

  @Column({ type: "datetime", nullable: true })
  approvalDate?: Date;

  @Column({ type: "text", nullable: true })
  reportContent?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
