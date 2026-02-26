import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 'human' for regular users; 'service' for service accounts (API key only). */
  @Column({ type: 'varchar', default: 'human' })
  type!: 'human' | 'service';

  /** Null for service accounts. */
  @Column({ unique: true, nullable: true, type: 'varchar' })
  email!: string | null;

  /** Display name used for service accounts; optional for human users. */
  @Column({ type: 'varchar', nullable: true })
  displayName!: string | null;

  /** Organization this service account belongs to. Only meaningful when type === 'service'. */
  @Column({ type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ default: false })
  emailVerified!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
