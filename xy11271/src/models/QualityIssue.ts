import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Transcript } from "./Transcript";
import { ReviewRecord } from "./ReviewRecord";

export type IssueType = "missing_apology" | "missing_refund_promise" | "sensitive_word" | "other";
export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type IssueStatus = "open" | "confirmed" | "resolved" | "false_positive";

@Entity()
export class QualityIssue {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  transcriptId!: string;

  @Column({ type: "varchar" })
  type!: IssueType;

  @Column({ type: "varchar", default: "medium" })
  severity!: IssueSeverity;

  @Column({ type: "varchar", default: "open" })
  status!: IssueStatus;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: true })
  matchedContent?: string;

  @Column({ type: "integer", nullable: true })
  segmentIndex?: number;

  @Column({ type: "text", nullable: true })
  ruleName?: string;

  @Column({ type: "text", nullable: true })
  suggestion?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Transcript, (transcript) => transcript.issues, { onDelete: "CASCADE" })
  @JoinColumn({ name: "transcriptId" })
  transcript!: Transcript;

  @ManyToOne(() => ReviewRecord, (review) => review.issues, { nullable: true })
  review?: ReviewRecord;
}
