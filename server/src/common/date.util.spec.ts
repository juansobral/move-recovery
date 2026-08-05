import { addMonths } from './date.util';

describe('addMonths', () => {
  it('adds months normally when the day exists in the target month', () => {
    expect(addMonths('2026-03-15', 1)).toBe('2026-04-15');
  });

  it('clamps to the last day of February when the source day is the 31st', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('clamps to the last day of a 30-day target month', () => {
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('rolls over into the next year when crossing December', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });
});
