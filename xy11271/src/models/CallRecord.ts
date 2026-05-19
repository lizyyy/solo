import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, Index } from "typeorm";
import { Transcript } from "./Transcript";

export type CallDirection = "inbound" | "outbound";
export type CallStatus = "completed" | "missed" | "abandoned";

@Entity()
export class CallRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  @Index()
  callId!: string;

  @Column({ nullable: true })
  agentId?: string;

  @Column({ nullable: true })
  agentName?: string;

  @Column({ nullable: true })
  customerPhone?: string;

  @Column({ type: "datetime", nullable: true })
  startTime?: Date;

  @Column({ type: "integer", nullable: true })
  duration?: number;

  @Column({ type: "varchar", nullable: true })
  direction?: CallDirection;

  @Column({ type: "varchar", nullable: true })
  status?: CallStatus;

  @Column({ nullable: true })
  queueName?: string;

  @Column({ type: "text", nullable: true })
  tags?: string;

  @Column()
  batchId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => Transcript, (transcript) => transcript.callRecord)
  transcript!: Transcript;
}
