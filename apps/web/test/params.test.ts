import { describe, expect, it } from 'vitest'
import { reportParams } from '../src/features/stats/params'

describe('reportParams', () => {
  it('defaults to 30 days of visitors', () => {
    expect(reportParams({})).toEqual({ range: '30d', metric: 'visitors', custom: {} })
  })

  it('accepts known values and ignores unknown ones', () => {
    expect(reportParams({ range: '7d', metric: 'bounce' })).toMatchObject({
      range: '7d',
      metric: 'bounce',
    })
    expect(reportParams({ range: 'forever', metric: 'money' })).toMatchObject({
      range: '30d',
      metric: 'visitors',
    })
    expect(reportParams({ range: ['custom', '7d'], from: '2026-09-01', to: '2026-09-10' })).toEqual(
      {
        range: 'custom',
        metric: 'visitors',
        custom: { from: '2026-09-01', to: '2026-09-10' },
      },
    )
  })
})
