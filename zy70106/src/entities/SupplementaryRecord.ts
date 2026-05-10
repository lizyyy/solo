import { Entity, PrimaryColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from "typeorm";
import { VaccinationRecord } from "./VaccinationRecord";

export type SupplementaryStatus = "pending" | "approved" | "rejected";

@Entity()
export class SupplementaryRecord {
  @PrimaryColumn()
  id: string;

  @Column({ type: "datetime" })
  actualVaccinationDate: Date;

  @Column()
  reasonForSupplementary: string;

  @Column()
  submittedBy: string;

  @Column({ nullable: true })
  reviewedBy?: string;

  @Column({ type: "datetime", nullable: true })
  reviewDate?: Date;

  @Column({ nullable: true })
  reviewComments?: string;

  @Column({ type: "varchar" })
  status: SupplementaryStatus;

  @Column()
  originalRecordId: string;

  @ManyToOne(() => VaccinationRecord)
  @JoinColumn({ name: "originalRecordId" })
  originalRecord: VaccinationRecord;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
