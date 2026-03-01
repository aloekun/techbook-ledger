import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isWhitelistedSite, matchesWhitelistPattern } from '../../src/content/whitelist.js';
import { DEFAULT_WHITELIST } from '@techbook-ledger/shared';

/**
 * ドメインラベル用のジェネレーター（小文字英数字のみ）
 */
const domainLabelGen = fc
  .array(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
      'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
      'u', 'v', 'w', 'x', 'y', 'z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ),
    { minLength: 1, maxLength: 10 },
  )
  .map((chars) => chars.join(''));

/**
 * 有効なドメイン名を生成するジェネレーター
 * 例: "example.com"
 */
const domainGen = fc
  .tuple(domainLabelGen, domainLabelGen)
  .map(([label, tld]) => `${label}.${tld}`);

/**
 * ホワイトリストに含まれないことが保証されるドメインを生成するジェネレーター
 */
const nonWhitelistedDomainGen = domainGen.filter((domain) => {
  return (
    !domain.endsWith('amazon.co.jp') &&
    domain !== 'gihyo.jp' &&
    !domain.endsWith('.gihyo.jp')
  );
});

describe('Feature: tech-book-decision-support, Property 5: ホワイトリスト外サイトの機能無効化', () => {
  it('すべてのホワイトリストに含まれないドメインに対して、isWhitelistedSite()はfalseを返す', () => {
    fc.assert(
      fc.property(nonWhitelistedDomainGen, (hostname) => {
        expect(isWhitelistedSite(hostname)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('空のホワイトリストに対して、すべてのドメインでfalseを返す', () => {
    fc.assert(
      fc.property(domainGen, (hostname) => {
        expect(isWhitelistedSite(hostname, [])).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: tech-book-decision-support, Property 6: ホワイトリスト内サイトのUI表示', () => {
  it('すべてのホワイトリストに含まれるドメインに対して、isWhitelistedSite()はtrueを返す', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DEFAULT_WHITELIST.filter((p) => !p.startsWith('*.'))),
        (hostname) => {
          expect(isWhitelistedSite(hostname)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ホワイトリストの完全一致ドメインに対して、trueを返す', () => {
    fc.assert(
      fc.property(
        fc.tuple(domainGen, fc.array(domainGen, { minLength: 1, maxLength: 5 })),
        ([hostname, extraDomains]) => {
          const whitelist = [hostname, ...extraDomains];
          expect(isWhitelistedSite(hostname, whitelist)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: tech-book-decision-support, Property 7: ワイルドカードドメインマッチング', () => {
  it('ワイルドカードパターン *.domain に対して、sub.domain がマッチする', () => {
    fc.assert(
      fc.property(
        fc.tuple(domainLabelGen, domainLabelGen, domainLabelGen),
        ([subdomain, label, tld]) => {
          const pattern = `*.${label}.${tld}`;
          const hostname = `${subdomain}.${label}.${tld}`;
          expect(matchesWhitelistPattern(hostname, pattern)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ワイルドカードパターン *.domain に対して、domain 自体はマッチしない', () => {
    fc.assert(
      fc.property(
        fc.tuple(domainLabelGen, domainLabelGen),
        ([label, tld]) => {
          const pattern = `*.${label}.${tld}`;
          const hostname = `${label}.${tld}`;
          expect(matchesWhitelistPattern(hostname, pattern)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('完全一致パターンに対して、完全一致するホスト名のみマッチする', () => {
    fc.assert(
      fc.property(fc.tuple(domainGen, domainGen), ([pattern, hostname]) => {
        if (pattern === hostname) {
          expect(matchesWhitelistPattern(hostname, pattern)).toBe(true);
        } else {
          expect(matchesWhitelistPattern(hostname, pattern)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('isWhitelistedSiteでワイルドカードパターンが正しく機能する', () => {
    fc.assert(
      fc.property(
        fc.tuple(domainLabelGen, domainLabelGen, domainLabelGen),
        ([subdomain, label, tld]) => {
          const wildcardPattern = `*.${label}.${tld}`;
          const hostname = `${subdomain}.${label}.${tld}`;
          expect(isWhitelistedSite(hostname, [wildcardPattern])).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('複数のワイルドカードパターンを持つホワイトリストで正しくマッチする', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          domainLabelGen,
          fc.tuple(domainLabelGen, domainLabelGen),
          fc.tuple(domainLabelGen, domainLabelGen),
        ),
        ([subdomain, [label1, tld1], [label2, tld2]]) => {
          const whitelist = [`*.${label1}.${tld1}`, `*.${label2}.${tld2}`];
          const hostname1 = `${subdomain}.${label1}.${tld1}`;
          expect(isWhitelistedSite(hostname1, whitelist)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
