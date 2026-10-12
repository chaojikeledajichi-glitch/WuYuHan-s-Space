import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const portfolio = sqliteTable('portfolio', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull(),
  ownerUserId: text('owner_user_id').notNull(),
  updatedAt: text('updated_at').notNull(),
});
