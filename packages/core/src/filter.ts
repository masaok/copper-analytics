import { isbot } from 'isbot'
import type { ProjectConfig } from './types'
import { originAllowed } from './url'

export interface FilterInput {
  userAgent: string
  /** `Origin` header, or the page URL when the header is absent. */
  origin: string
  ip: string
  referrer: string
  project: ProjectConfig
}

/** Decides whether a pageview is counted. The hosted service swaps in a stricter implementation. */
export interface Filter {
  /** Returns a reason to drop the event, or null to accept it. */
  reject(input: FilterInput): string | null
}

export const defaultFilter: Filter = {
  reject({ userAgent, origin, project }) {
    if (!userAgent || isbot(userAgent)) return 'bot'
    if (!originAllowed(origin, project.domains)) return 'origin'
    return null
  },
}
