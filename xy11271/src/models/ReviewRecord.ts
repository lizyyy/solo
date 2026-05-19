import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, JoinColumn, ManyToOne } from "typeorm";
import { QualityIssue } from "./QualityIssue";
import { Transcript } from "./Transcript";

export type ReviewResult = "pass" | "fail" | "need_review";
export type ReviewStatus = "pending" | "in_progress" | "completed";

@Entity()
export class ReviewRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  transcriptId!: string;

  @Column({ nullable: true })
  reviewerId?: string;

  @Column({ nullable: true })
  reviewerName?: string;

  @Column({ type: "varchar", default: "pending" })
  status!: ReviewStatus;

  @Column({ type: "varchar", nullable: true })
  result?: ReviewResult;

  @Column({ type: "integer", default: 0 })
  score!: number;

  @Column({ type: "text", nullable: true })
  comments?: string;

  @Column({ type: "text", nullable: true })
  correctionNotes?: string;

  @Column({ type: "datetime", nullable: true })
  reviewedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Transcript, { onDelete: "CASCADE" })
  @JoinColumn({ name: "transcriptId" })
  transcript!: Transcript;

  @OneToMany(() => QualityIssue, (issue) => issue.review)
  issues!: QualityIssue[];
}
