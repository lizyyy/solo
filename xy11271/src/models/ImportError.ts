import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { ImportBatch } from "./ImportBatch";

@Entity()
export class ImportError {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  batchId!: string;

  @Column({ type: "integer" })
  lineNumber!: number;

  @Column({ type: "text", nullable: true })
  originalContent?: string;

  @Column({ type: "text" })
  errorMessage!: string;

  @Column({ type: "text", nullable: true })
  suggestion?: string;

  @Column({ type: "boolean", default: false })
  resolved!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => ImportBatch, (batch) => batch.errors, { onDelete: "CASCADE" })
  @JoinColumn({ name: "batchId" })
  batch!: ImportBatch;
}
