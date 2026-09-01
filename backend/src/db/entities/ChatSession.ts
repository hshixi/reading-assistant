import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Book } from './Book'

/** 聊天会话：每本书可拥有多个会话；重开书籍即恢复对应会话与消息。 */
@Entity('chat_sessions')
@Index(['bookId', 'createdAt'])
export class ChatSession {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'book_id', type: 'int' })
  bookId!: number

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book?: Book

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
