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

  /** V2：选中原文摘录（AI 整理笔记时回填原文；手动笔记的批注正文仍走 content） */
  @Column({ name: 'excerpt_text', type: 'text', nullable: true })
  excerptText!: string | null

  @Column({ name: 'page_number', type: 'int', nullable: true })
  pageNumber!: number | null

  /** V2：归一化行盒数组（DB 列仍名 `rect`，V1 存单对象，读时归一化） */
  @Column({ name: 'rect', type: 'simple-json', nullable: true })
  rects!: Rect[] | null

  @Column({ name: 'screenshot_rel_path', type: 'varchar', length: 512, nullable: true })
  screenshotRelPath!: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
