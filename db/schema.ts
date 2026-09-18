import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(), title: text("title").notNull(),
  platform: text("platform").notNull(), format: text("format").notNull().default("Digital"),
  status: text("status").notNull().default("Backlog"), progress: integer("progress").notNull().default(0),
  hours: integer("hours").notNull().default(0), priority: text("priority").notNull().default("Normal"),
  series: text("series").notNull().default(""), nextGoal: text("next_goal").notNull().default(""),
  notes: text("notes").notNull().default(""), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_games_user_updated").on(table.userId, table.updatedAt)]);
