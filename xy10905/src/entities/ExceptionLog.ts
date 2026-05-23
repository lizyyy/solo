import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity()
export class ExceptionLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  requestId: string;

  @Column({ type: "text" })
  requestPath: string;

  @Column({ type: "text" })
  requestMethod: string;

  @Column({ type: "text" })
  rawInput: string;

  @Column({ type: "text" })
  errorMessage: string;

  @Column({ type: "text", nullable: true })
  errorStack: string;

  @Column({ type: "text", nullable: true })
  handlingConclusion: string;

  @Column({ default: false })
  isResolved: boolean;

  @Column({ type: "text", nullable: true })
  resolvedBy: string;

  @Column({ type: "datetime", nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
