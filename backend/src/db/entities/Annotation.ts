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

/**
 * 文本注释/批注：挂在某页某个归一化区域上，类型 sticky/underline/marker。
 */
@Entity('annotations')
@Index(['bookId', 'pageNumber'])
export class Annotation {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'book_id', type: 'int' })
  bookId!: number

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book?: Book

  @Column({ name: 'page_number', type: 'int' })
  pageNumber!: number

  /** 归一化矩形（0–1），可空（整页批注） */
  @Column({ type: 'simple-json', nullable: true })
  rect!: Rect | null

  @Column({ type: 'text', nullable: true })
  text!: string | null

  @Column({ name: 'annotation_type', type: 'varchar', length: 16, default: 'sticky' })
  annotationType!: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
