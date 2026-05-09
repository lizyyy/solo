import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('idempotency_requests')
export class IdempotencyRequest {
  @PrimaryColumn()
  id: string;

  @Column()
  userId: string;

  @Column()
  endpoint: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  response: any;

  @Column({ type: 'jsonb', nullable: true })
  requestHash: string;
}
