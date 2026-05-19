import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './Contract';
import { DelayConfig } from './DelayConfig';

@Entity()
export class ResponseScene {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column('simple-json')
  matchRules!: MatchRule[];

  @Column('simple-json')
  responseBody!: Record<string, any>;

  @Column({ default: 200 })
  statusCode!: number;

  @Column('simple-json', { nullable: true })
  headers!: Record<string, string>;

  @Column({ default: false })
  isDefault!: boolean;

  @Column({ default: true })
  isEnabled!: boolean;

  @ManyToOne(() => Contract, contract => contract.scenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contractId' })
  contract!: Contract;

  @Column()
  contractId!: string;

  @Column('simple-json', { nullable: true })
  delayConfig!: DelayConfig;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

interface MatchRule {
  type: 'header' | 'query' | 'body' | 'path';
  key: string;
  value: string;
  operator: 'equals' | 'contains' | 'regex' | 'exists';
}
