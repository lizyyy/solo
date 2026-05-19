import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, OneToMany, Index } from "typeorm";
import { CallRecord } from "./CallRecord";
import { QualityIssue } from "./QualityIssue";

export type TranscriptStatus = "pending" | "processed" | "reviewed" | "archived";
export type SpeakerRole = "agent" | "customer" | "unknown";

export interface TranscriptSegment {
  timestamp: string;
  speaker: string;
  role: SpeakerRole;
  text: string;
}

@Entity()
export class Transcript {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  @Index()
  callId!: string;

  @Column({ type: "text" })
  rawContent!: string;

  @Column({ type: "simple-json", nullable: true })
  segments?: TranscriptSegment[];

  @Column({ type: "text", nullable: true })
  fullText?: string;

  @Column({ type: "varchar", default: "pending" })
  status!: TranscriptStatus;

  @Column({ type: "boolean", default: false })
  hasApology!: boolean;

  @Column({ type: "boolean", default: false })
  hasRefundPromise!: boolean;

  @Column({ type: "boolean", default: false })
  hasSensitiveWords!: boolean;

  @Column({ type: "integer", default: 0 })
  issueCount!: number;

  @Column({ type: "text", nullable: true })
  processingNotes?: string;

  @Column()
  batchId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => CallRecord, (call) => call.transcript, { onDelete: "CASCADE" })
  @JoinColumn({ name: "callId", referencedColumnName: "callId" })
  callRecord!: CallRecord;

  @OneToMany(() => QualityIssue, (issue) => issue.transcript)
  issues!: QualityIssue[];
}
