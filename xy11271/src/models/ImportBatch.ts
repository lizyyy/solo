import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { ImportError } from "./ImportError";

export type BatchStatus = "pending" | "processing" | "completed" | "partial_failed" | "failed";

@Entity()
export class ImportBatch {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  batchNumber!: string;

  @Column({ type: "varchar" })
  sourceType!: "transcript" | "metadata" | "sensitive_words";

  @Column({ nullable: true })
  fileName?: string;

  @Column({ type: "integer", default: 0 })
  totalRecords!: number;

  @Column({ type: "integer", default: 0 })
  successCount!: number;

  @Column({ type: "integer", default: 0 })
  failedCount!: number;

  @Column({ type: "varchar", default: "pending" })
  status!: BatchStatus;

  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => ImportError, (error) => error.batch)
  errors!: ImportError[];
}
