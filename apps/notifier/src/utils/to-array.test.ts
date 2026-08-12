import { describe, expect, it } from 'vitest';
import { toArray } from './to-array';

describe('toArray', () => {
  it('wraps a string', () => {
    expect(toArray('a')).toEqual(['a']);
  });

  it('returns an array unchanged', () => {
    expect(toArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('returns undefined for undefined', () => {
    expect(toArray(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(toArray('')).toBeUndefined();
  });
});
