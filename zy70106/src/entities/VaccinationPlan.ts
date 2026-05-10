import { Entity, PrimaryColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from "typeorm";
import { Pen } from "./Pen";
import { VaccinationRecord } from "./VaccinationRecord";
import { Batch } from "./Batch";

export type PlanStatus = "pending" | "in_progress" | "completed" | "cancelled";

@Entity()
export class VaccinationPlan {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  vaccineName: string;

  @Column({ type: "date" })
  scheduledDate: Date;

  @Column({ nullable: true })
  completedDate?: Date;

  @Column({ type: "varchar" })
  status: PlanStatus;

  @Column({ type: "int" })
  targetAnimalCount: number;

  @Column({ nullable: true })
  notes?: string;

  @Column()
  penId: string;

  @ManyToOne(() => Pen, (pen) => pen.plans)
  @JoinColumn({ name: "penId" })
  pen: Pen;

  @OneToMany(() => VaccinationRecord, (record) => record.plan)
  records: VaccinationRecord[];

  @OneToMany(() => Batch, (batch) => batch.plan)
  batches: Batch[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
