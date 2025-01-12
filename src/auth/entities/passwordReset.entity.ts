import { User } from '@/users/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne } from 'typeorm';

@Entity()
export class PasswordReset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index({ unique: true })
  token: string;

  @Column()
  expiresAt: Date;

  @ManyToOne(() => User, (user) => user.passwordResets, { onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
