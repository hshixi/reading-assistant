# ADR-001：ORM 选型 TypeORM（MySQL ↔ SQLite 双方言）

- 日期：2026-09-01
- 状态：已接受

## 背景

需求要求本地 MySQL 存储，同时需为「发布 dmg 后目标机器无 MySQL」保留退回内嵌 SQLite 的能力。ORM 需在运行时按环境切换方言，实体与仓库代码尽量复用。

## 决策

采用 **TypeORM**（驱动 `mysql2` + `better-sqlite3`），`DataSource` 按 `DATABASE_DRIVER` env（`mysql | sqlite | auto`）选择驱动与连接参数。

## 理由

- **运行时方言切换**：只差驱动与连接参数，实体/仓库代码 100% 复用。
- **实体可移植**：装饰器定义双方言映射一致（配合 ADR-002 的跨方言铁律）。
- **`synchronize: true`**：桌面单机应用 schema 随实体演进，开发期免维护两套 migration。
- **Prisma 痛点对照**：Prisma 需两套 `schema.prisma`、`generate` 产物按 provider 固定、运行期切 provider 需重新 generate、migration 按 provider 分叉——不适用于「一个 dmg 内按环境退回 SQLite」。

## 替代方案

Knex（query builder 非 ORM）；Drizzle（迁移同样要双份）。TypeORM 是「实体 ORM + 零迁移开销」的最优组合。

## 影响

- 实体列类型走 `db/dialect.ts` 辅助函数，禁用 MySQL 专属类型（见 ADR-002）。
- 开发期 `synchronize:true`；发布前冻结 schema 改 `bootstrap.ts` + `schemaVersion` 版本管理。
