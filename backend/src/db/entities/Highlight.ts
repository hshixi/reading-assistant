import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import type { Rect } from '@reading/shared'
import { Book } from './Book'
import { Note } from './Note'

/**
 * 高亮标注：rect/page 坐标由前端框选精确给定（模型不负责坐标），颜色可自定义。
 */
@Entity('highlights')
@Index(['bookId', 'pageNumber'])
export class Highlight {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'book_id', type: 'int' })
  bookId!: number

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book?: Book

  @Column({ name: 'page_number', type: 'int' })
  pageNumber!: number

  /** 归一化矩形（0–1） */
  @Column({ type: 'simple-json' })
  rect!: Rect

  @Column({ type: 'varchar', length: 32, default: 'yellow' })
  color!: string

  @Column({ name: 'excerpt_text', type: 'text', nullable: true })
  excerptText!: string | null

  @Column({ name: 'note_id', type: 'int', nullable: true })
  noteId!: number | null

  @ManyToOne(() => Note, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'note_id' })
  note?: Note | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
