import { describe, it, expect } from 'vitest';
import { isWhitelistedSite, matchesWhitelistPattern } from '../../src/content/whitelist.js';
import { DEFAULT_WHITELIST } from '@techbook-ledger/shared';

describe('matchesWhitelistPattern', () => {
  describe('完全一致パターン', () => {
    it('should return true when hostname exactly matches pattern', () => {
      expect(matchesWhitelistPattern('amazon.co.jp', 'amazon.co.jp')).toBe(true);
    });

    it('should return false when hostname does not match pattern', () => {
      expect(matchesWhitelistPattern('google.com', 'amazon.co.jp')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(matchesWhitelistPattern('Amazon.Co.JP', 'amazon.co.jp')).toBe(true);
      expect(matchesWhitelistPattern('amazon.co.jp', 'AMAZON.CO.JP')).toBe(true);
    });
  });

  describe('ワイルドカードパターン', () => {
    it('should match subdomain with wildcard pattern', () => {
      expect(matchesWhitelistPattern('www.amazon.co.jp', '*.amazon.co.jp')).toBe(true);
    });

    it('should match any subdomain with wildcard pattern', () => {
      expect(matchesWhitelistPattern('shop.amazon.co.jp', '*.amazon.co.jp')).toBe(true);
      expect(matchesWhitelistPattern('books.amazon.co.jp', '*.amazon.co.jp')).toBe(true);
    });

    it('should not match base domain with wildcard pattern', () => {
      expect(matchesWhitelistPattern('amazon.co.jp', '*.amazon.co.jp')).toBe(false);
    });

    it('should match deep subdomain with wildcard pattern', () => {
      expect(matchesWhitelistPattern('a.b.amazon.co.jp', '*.amazon.co.jp')).toBe(true);
    });

    it('should be case-insensitive with wildcard patterns', () => {
      expect(matchesWhitelistPattern('WWW.AMAZON.CO.JP', '*.amazon.co.jp')).toBe(true);
    });

    it('should not match partial domain suffix', () => {
      expect(matchesWhitelistPattern('notamazon.co.jp', '*.amazon.co.jp')).toBe(false);
    });
  });

  describe('エッジケース', () => {
    it('should handle empty hostname', () => {
      expect(matchesWhitelistPattern('', 'amazon.co.jp')).toBe(false);
    });

    it('should handle empty pattern', () => {
      expect(matchesWhitelistPattern('amazon.co.jp', '')).toBe(false);
    });

    it('should handle both empty', () => {
      expect(matchesWhitelistPattern('', '')).toBe(true);
    });

    it('should handle wildcard-only pattern', () => {
      // "*.": ワイルドカードで空のドメイン - 空ではないホスト名にマッチ
      expect(matchesWhitelistPattern('anything', '*.')).toBe(false);
    });
  });
});

describe('isWhitelistedSite', () => {
  describe('デフォルトホワイトリスト', () => {
    it('should return true for amazon.co.jp', () => {
      expect(isWhitelistedSite('amazon.co.jp')).toBe(true);
    });

    it('should return true for gihyo.jp', () => {
      expect(isWhitelistedSite('gihyo.jp')).toBe(true);
    });

    it('should return true for www.amazon.co.jp (wildcard match)', () => {
      expect(isWhitelistedSite('www.amazon.co.jp')).toBe(true);
    });

    it('should return false for non-whitelisted sites', () => {
      expect(isWhitelistedSite('google.com')).toBe(false);
      expect(isWhitelistedSite('example.com')).toBe(false);
    });

    it('should return false for similar but different domains', () => {
      expect(isWhitelistedSite('amazon.com')).toBe(false);
      expect(isWhitelistedSite('famazon.co.jp')).toBe(false);
    });
  });

  describe('カスタムホワイトリスト', () => {
    it('should work with custom whitelist', () => {
      const whitelist = ['example.com', '*.test.org'];
      expect(isWhitelistedSite('example.com', whitelist)).toBe(true);
      expect(isWhitelistedSite('sub.test.org', whitelist)).toBe(true);
      expect(isWhitelistedSite('google.com', whitelist)).toBe(false);
    });

    it('should return false with empty whitelist', () => {
      expect(isWhitelistedSite('amazon.co.jp', [])).toBe(false);
    });

    it('should match first pattern in whitelist', () => {
      const whitelist = ['first.com', 'second.com'];
      expect(isWhitelistedSite('first.com', whitelist)).toBe(true);
    });

    it('should match last pattern in whitelist', () => {
      const whitelist = ['first.com', 'second.com'];
      expect(isWhitelistedSite('second.com', whitelist)).toBe(true);
    });
  });

  describe('DEFAULT_WHITELIST定数', () => {
    it('should contain amazon.co.jp', () => {
      expect(DEFAULT_WHITELIST).toContain('amazon.co.jp');
    });

    it('should contain gihyo.jp', () => {
      expect(DEFAULT_WHITELIST).toContain('gihyo.jp');
    });

    it('should contain *.amazon.co.jp', () => {
      expect(DEFAULT_WHITELIST).toContain('*.amazon.co.jp');
    });
  });
});
