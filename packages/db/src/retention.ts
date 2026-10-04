/** How long each table keeps its rows. The one place these numbers live. */
export const RETENTION = {
  statsHourlyDays: 14,
  breakdownDailyDays: 90,
  breakdownMonthlyMonths: 25,
  flushLogDays: 30,
} as const

export const FREE_STORAGE_BYTES = 1024 ** 3
/** The guard alerts at this share of the free allowance. */
export const STORAGE_ALERT_RATIO = 0.6
