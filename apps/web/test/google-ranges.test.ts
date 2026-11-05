import { describe, expect, it } from 'vitest'
import { sumByDay, weightedMean } from '../src/features/google/ranges'

describe('sumByDay', () => {
  it('adds the series day by day, keeping days only one series has', () => {
    expect(
      sumByDay([
        [
          { day: '2026-11-01', value: 2 },
          { day: '2026-11-02', value: 3 },
        ],
        [{ day: '2026-11-02', value: 4 }],
        [],
      ]),
    ).toEqual([
      { day: '2026-11-01', value: 2 },
      { day: '2026-11-02', value: 7 },
    ])
  })
})

describe('weightedMean', () => {
  it('weights each value and is 0 with no weight', () => {
    expect(weightedMean([10, 20], [1, 3])).toBe(17.5)
    expect(weightedMean([10], [0])).toBe(0)
  })
})
