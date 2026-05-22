import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { OrderItem } from './OrderItem';
import { HeadquartersPrice } from './HeadquartersPrice';

@Entity('materials')
export class Material extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit!: string;

  @Column({ type: 'text', nullable: true })
  specification!: string;

  @OneToMany(() => OrderItem, item => item.material)
  orderItems!: OrderItem[];

  @OneToMany(() => HeadquartersPrice, price => price.material)
  prices!: HeadquartersPrice[];
}
