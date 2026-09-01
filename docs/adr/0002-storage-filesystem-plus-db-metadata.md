# ADR-002：PDF 二进制与截图存文件系统，DB 只存元数据

- 日期：2026-09-01
- 状态：已接受

## 背景

需求要求 MySQL 存储书籍/笔记/注释等。PDF 文件通常几十 MB，截图为 PNG。

## 决策

**PDF 二进制与截图图片存文件系统**（userData 下 `books/{id}/original.pdf`、`media/{sessionId}/{messageId}.png`），数据库只存元数据 + 相对路径。所有文件操作统一收敛到 `book-store` / `media-store` 服务。

## 理由

1. **方言无关**：BLOB 在 MySQL 是 LONGBLOB、SQLite 是 BLOB，跨方言迁移体积与语义不同；落文件系统则 DB 与方言完全无关，SQLite 退回零额外成本。
2. **性能**：大 PDF 经 HTTP Range 流式播放，文件系统 `createReadStream(start,end)` 天然支持；BLOB 出库要整体进内存再切片。
3. **备份/导出**：整目录 copy 即备份。

## 代价与对策

- 文件生命周期需自行管理：删除 book 走事务（先删 DB 记录再删文件），启动时清扫孤儿文件兜底。
- 文件删除失败可能留孤儿文件：由启动清扫逻辑兜底（M3 实现）。

## 跨方言铁律（写实体的前提，贯穿所有表）

- 时间戳 `DATETIME DEFAULT CURRENT_TIMESTAMP`，`updated_at` 应用层赋值（禁用 MySQL `ON UPDATE CURRENT_TIMESTAMP`）。
- JSON 一律 TEXT 列存 JSON 字符串，应用层 parse/stringify。
- 禁用 MySQL 专属类型：ENUM（用 varchar+应用层校验）、unsigned、TEXT 默认值（有默认值用 VARCHAR）。
- SQLite 需 `PRAGMA foreign_keys=ON`（TypeORM `extra: { foreign_keys:'ON' }`）。
- 列类型统一走 `db/dialect.ts` 辅助函数，实体不写死方言类型。
