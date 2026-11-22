import { describe, it, expect } from 'vitest';
import { calculateRightsDiff } from '@/lib/audit';

describe('Rights Diff Builder (calculateRightsDiff)', () => {
  it('returns hasChanged: false when rights arrays are identical', () => {
    const rights = ['add_customer', 'edit_customer', 'view_reports'];
    const diff = calculateRightsDiff(rights, [...rights]);

    expect(diff.hasChanged).toBe(false);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.oldSorted).toEqual(['add_customer', 'edit_customer', 'view_reports']);
    expect(diff.newSorted).toEqual(['add_customer', 'edit_customer', 'view_reports']);
  });

  it('returns hasChanged: false when rights are identical but in different order', () => {
    const oldRights = ['edit_customer', 'add_customer', 'view_reports'];
    const newRights = ['view_reports', 'add_customer', 'edit_customer'];
    const diff = calculateRightsDiff(oldRights, newRights);

    expect(diff.hasChanged).toBe(false);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.oldSorted).toEqual(diff.newSorted);
  });

  it('deduplicates input rights and normalizes whitespace', () => {
    const oldRights = ['add_customer', '  add_customer  ', 'view_reports'];
    const newRights = ['view_reports', 'add_customer'];
    const diff = calculateRightsDiff(oldRights, newRights);

    expect(diff.hasChanged).toBe(false);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.oldSorted).toEqual(['add_customer', 'view_reports']);
  });

  it('detects added rights correctly', () => {
    const oldRights = ['add_customer'];
    const newRights = ['add_customer', 'edit_customer', 'delete_customer'];
    const diff = calculateRightsDiff(oldRights, newRights);

    expect(diff.hasChanged).toBe(true);
    expect(diff.added).toEqual(['delete_customer', 'edit_customer']);
    expect(diff.removed).toEqual([]);
  });

  it('detects removed rights correctly', () => {
    const oldRights = ['add_customer', 'edit_customer', 'delete_customer'];
    const newRights = ['add_customer'];
    const diff = calculateRightsDiff(oldRights, newRights);

    expect(diff.hasChanged).toBe(true);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual(['delete_customer', 'edit_customer']);
  });

  it('detects simultaneous additions and removals', () => {
    const oldRights = ['add_customer', 'edit_customer'];
    const newRights = ['edit_customer', 'add_product'];
    const diff = calculateRightsDiff(oldRights, newRights);

    expect(diff.hasChanged).toBe(true);
    expect(diff.added).toEqual(['add_product']);
    expect(diff.removed).toEqual(['add_customer']);
  });

  it('handles empty or undefined arrays gracefully', () => {
    const diffFromEmpty = calculateRightsDiff([], ['add_product']);
    expect(diffFromEmpty.hasChanged).toBe(true);
    expect(diffFromEmpty.added).toEqual(['add_product']);
    expect(diffFromEmpty.removed).toEqual([]);

    const diffToEmpty = calculateRightsDiff(['add_product'], []);
    expect(diffToEmpty.hasChanged).toBe(true);
    expect(diffToEmpty.added).toEqual([]);
    expect(diffToEmpty.removed).toEqual(['add_product']);

    const diffBothEmpty = calculateRightsDiff([], []);
    expect(diffBothEmpty.hasChanged).toBe(false);
    expect(diffBothEmpty.added).toEqual([]);
    expect(diffBothEmpty.removed).toEqual([]);
  });
});
