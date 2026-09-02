import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

/**
 * 书籍（PDF 元数据）。文件本体在文件系统 userData/books/{id}/original.pdf，
 * 本表只存元数据与相对路径。列类型保持 MySQL/SQLite 双方言可移植。
 */
@Entity('books')
export class Book {
  @PrimaryGeneratedColumn()
  id!: number

  @Index()
  @Column({ type: 'varchar', length: 512 })
  title!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  author!: string | null

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string

  @Column({ name: 'file_rel_path', type: 'varchar', length: 512 })
  fileRelPath!: string

  @Column({ name: 'file_size', type: 'bigint', default: 0 })
  fileSize!: number

  @Column({ name: 'mime_type', type: 'varchar', length: 64, nullable: true })
  mimeType!: string | null

  @Column({ name: 'page_count', type: 'int', nullable: true })
  pageCount!: number | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  sha256!: string | null

  @Column({ name: 'last_opened_at', type: 'datetime', nullable: true })
  lastOpenedAt!: string | null

  /** 阅读进度：最近一次离开该书时的页码（重开自动定位；未读过为 null） */
  @Column({ name: 'last_page', type: 'int', nullable: true })
  lastPage!: number | null

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
