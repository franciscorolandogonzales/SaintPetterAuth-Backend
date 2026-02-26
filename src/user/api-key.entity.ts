import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  /** SHA-256 of the raw API key. Never store the raw key. */
  @Column({ unique: true, type: 'varchar', length: 64 })
  keyHash!: string;

  /** First 12 chars of the raw key (e.g. "spk_a1b2c3d4") for visual identification. */
  @Column({ type: 'varchar', length: 16 })
  keyPrefix!: string;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ default: true })
  active!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
