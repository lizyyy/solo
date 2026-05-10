import { Entity, PrimaryColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from "typeorm";
import { Pen } from "./Pen";
import { VaccinationPlan } from "./VaccinationPlan";
import { Veterinarian } from "./Veterinarian";
import { Batch } from "./Batch";

export type RecordStatus = "pending" | "confirmed" | "rejected" | "needs_review";

@Entity()
export class VaccinationRecord {
  @PrimaryColumn()
  id: string;

  @Column({ type: "datetime" })
  vaccinationDate: Date;

  @Column({ type: "int" })
  animalCount: number;

  @Column({ type: "varchar" })
  status: RecordStatus;

  @Column({ nullable: true })
  rejectionReason?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column()
  penId: string;

  @Column()
  planId: string;

  @Column()
  veterinarianId: string;

  @Column()
  batchId: string;

  @ManyToOne(() => Pen, (pen) => pen.records)
  @JoinColumn({ name: "penId" })
  pen: Pen;

  @ManyToOne(() => VaccinationPlan, (plan) => plan.records)
  @JoinColumn({ name: "planId" })
  plan: VaccinationPlan;

  @ManyToOne(() => Veterinarian, (vet) => vet.records)
  @JoinColumn({ name: "veterinarianId" })
  veterinarian: Veterinarian;

  @ManyToOne(() => Batch, (batch) => batch.records)
  @JoinColumn({ name: "batchId" })
  batch: Batch;

  @Column({ nullable: true })
  previousRecordId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
