import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './Contract';
import { ResponseScene } from './ResponseScene';

@Entity()
export class ReplayHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Contract, contract => contract.replayHistories, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'contractId' })
  contract!: Contract | null;

  @Column({ nullable: true })
  contractId!: string | null;

  @ManyToOne(() => ResponseScene, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sceneId' })
  scene!: ResponseScene | null;

  @Column({ nullable: true })
  sceneId!: string | null;

  @Column()
  requestMethod!: string;

  @Column()
  requestPath!: string;

  @Column('simple-json', { nullable: true })
  requestHeaders!: Record<string, any>;

  @Column('simple-json', { nullable: true })
  requestQuery!: Record<string, any>;

  @Column('simple-json', { nullable: true })
  requestBody!: Record<string, any>;

  @Column({ nullable: true })
  matchedSceneName!: string;

  @Column({ default: 200 })
  responseStatusCode!: number;

  @Column('simple-json', { nullable: true })
  responseBody!: Record<string, any>;

  @Column({ default: 0 })
  responseDelay!: number;

  @Column({ default: 'success' })
  status!: 'success' | 'failed' | 'matched' | 'no_match' | 'compensated';

  @Column('text', { nullable: true })
  failureReason!: string;

  @Column({ default: false })
  isCompensated!: boolean;

  @Column({ nullable: true })
  compensatedBy!: string;

  @Column({ nullable: true })
  compensatedAt!: Date;

  @Column('simple-json', { nullable: true })
  compensationData!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;
}
