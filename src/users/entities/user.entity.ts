import { Matches, MaxLength, MinLength } from 'class-validator';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PasswordReset } from '@/auth/entities/passwordReset.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  surName: string;

  @Column({ nullable: true })
  avatar: string;

  @Matches('^[a-zA-Z0-9]*$')
  @MaxLength(15)
  @MinLength(5)
  @Column({ nullable: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  token: string;

  @Column({ nullable: true })
  fireblocksVaultId: string;


  @OneToMany(() => PasswordReset, (passwordReset) => passwordReset.user)
  passwordResets: PasswordReset[];

  constructor(user?: Partial<User>) {
    Object.assign(this, user);
  }
}
