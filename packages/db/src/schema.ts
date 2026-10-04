import type { Breakdown } from '@copper/core'
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

// Better Auth tables. Property names are the ones its Drizzle adapter looks up.
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  /** Projects this account may create. Raised per user from the admin app. */
  projectLimit: integer('project_limit').notNull().default(10),
  ...timestamps,
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    ...timestamps,
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

export const project = pgTable(
  'project',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    siteKey: varchar('site_key', { length: 10 }).notNull().unique(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    domains: text('domains').array().notNull().default([]),
    timezone: text('timezone').notNull().default('UTC'),
    isPublic: boolean('is_public').notNull().default(false),
    dailyCap: integer('daily_cap').notNull().default(5000),
    /** Kill switch. A disabled project's pageviews are dropped at ingest. */
    disabled: boolean('disabled').notNull().default(false),
    /** SHA-256 of the read-only stats API token, or null when none has been issued. */
    apiTokenHash: text('api_token_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_owner_id_idx').on(t.ownerId)],
)

const projectId = () =>
  integer('project_id')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' })

const counters = {
  pageviews: integer('pageviews').notNull().default(0),
  visitors: integer('visitors').notNull().default(0),
  visits: integer('visits').notNull().default(0),
  bounces: integer('bounces').notNull().default(0),
}

export const statsHourly = pgTable(
  'stats_hourly',
  {
    projectId: projectId(),
    hour: timestamp('hour', { withTimezone: true }).notNull(),
    ...counters,
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.hour] }),
    index('stats_hourly_hour_idx').on(t.hour),
  ],
)

export const statsDaily = pgTable(
  'stats_daily',
  { projectId: projectId(), day: date('day').notNull(), ...counters },
  (t) => [primaryKey({ columns: [t.projectId, t.day] })],
)

export const breakdownDaily = pgTable(
  'breakdown_daily',
  {
    projectId: projectId(),
    day: date('day').notNull(),
    data: jsonb('data').$type<Breakdown>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.day] }),
    index('breakdown_daily_day_idx').on(t.day),
  ],
)

export const breakdownMonthly = pgTable(
  'breakdown_monthly',
  {
    projectId: projectId(),
    month: date('month').notNull(),
    data: jsonb('data').$type<Breakdown>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.month] })],
)

export const flushLog = pgTable(
  'flush_log',
  {
    shard: smallint('shard').notNull(),
    flushId: text('flush_id').notNull(),
    flushedAt: timestamp('flushed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.shard, t.flushId] })],
)

/** One reading a day of the database's size, for the storage guard. */
export const dbSizeLog = pgTable('db_size_log', {
  day: date('day').primaryKey(),
  bytes: bigint('bytes', { mode: 'number' }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
})
