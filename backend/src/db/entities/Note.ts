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
import type { Rect } from '@reading/shared'
import { Book } from './Book'
import { ChatSession } from './ChatSession'

/**
 * 摘抄笔记：可来自 AI 摘抄（携带截图 + 归一化 rect + 页码），也可手动创建。
 */
@Entity('notes')
@Index(['bookId', 'createdAt'])
export class Note {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'book_id', type: 'int' })
  bookId!: number

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book?: Book

  @Column({ name: 'session_id', type: 'int', nullable: true })
  sessionId!: number | null

  @ManyToOne(() => ChatSession, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'session_id' })
  session?: ChatSession | null

  @Column({ type: 'text' })
  content!: string

  @Column({ name: 'page_number', type: 'int', nullable: true })
  pageNumber!: number | null

  /** 归一化矩形（0–1），simple-json 跨方言存 TEXT */
  @Column({ type: 'simple-json', nullable: true })
  rect!: Rect | null

  @Column({ name: 'screenshot_rel_path', type: 'varchar', length: 512, nullable: true })
  screenshotRelPath!: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
