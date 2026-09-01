import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import type { MessageMeta } from '@reading/shared'
import { ChatSession } from './ChatSession'

/**
 * 聊天消息。用户消息在发起 AI 流前落库；助手消息先插占位、流结束一次性更新（避免每 chunk 写库）。
 * meta 为 simple-json（跨方言存 TEXT 列），记录 token/model/action 等。
 */
@Entity('chat_messages')
@Index(['sessionId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'session_id', type: 'int' })
  sessionId!: number

  @ManyToOne(() => ChatSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session?: ChatSession

  /** user | assistant */
  @Column({ type: 'varchar', length: 16 })
  role!: 'user' | 'assistant'

  /** text | image | mixed */
  @Column({ name: 'content_type', type: 'varchar', length: 16, default: 'text' })
  contentType!: 'text' | 'image' | 'mixed'

  @Column({ type: 'text', nullable: true })
  content!: string | null

  @Column({ name: 'image_rel_path', type: 'varchar', length: 512, nullable: true })
  imageRelPath!: string | null

  @Column({ type: 'simple-json', nullable: true })
  meta!: MessageMeta | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
