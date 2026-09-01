import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

/**
 * 应用配置键值表：AI key/baseUrl/model、db 模式、schema 版本等。
 * value 存 JSON 字符串（或纯字符串，由 SettingsService 统一编解码）。
 */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  key!: string

  @Column({ type: 'text' })
  value!: string

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
