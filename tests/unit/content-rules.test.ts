import { describe, expect, test } from 'vitest';
import { byOrder, categoriesWithCounts, featuredProjects, findTodoFields, isHttpsUrl, isSafeHref, neighbours, pageHref, projectsInCategory, published, publicRepoUrl } from '../../src/lib/content-rules';

describe('pageHref: a link written in the content goes straight to the page, with no redirect', () => {
  test.each([
    ['/contact', '/contact/'],
    ['/contact/', '/contact/'],
    ['/', '/'],
    ['/projects/english-coach', '/projects/english-coach/'],
    ['/projects?category=research', '/projects/?category=research'],
    ['/contact#email', '/contact/#email'],
    ['/#resume', '/#resume'],
    ['/resume/resume.pdf', '/resume/resume.pdf'],
    ['/images/a.webp', '/images/a.webp'],
    ['https://example.com/page', 'https://example.com/page'],
    ['mailto:someone@example.com', 'mailto:someone@example.com'],
    ['#contact', '#contact'],
    ['', ''],
  ])('%s becomes %s', (value, expected) => {
    expect(pageHref(value)).toBe(expected);
  });
});

describe('published: a placeholder never reaches a page', () => {
  test('passes real text through', () => {
    expect(published('A real sentence.')).toBe('A real sentence.');
  });

  test.each(['TODO: describe the problem', '  TODO write this', 'TODO', '', '   '])('hides %j', (value) => {
    expect(published(value)).toBe('');
  });

  test('keeps text that only mentions the word', () => {
    expect(published('A TODO list app')).toBe('A TODO list app');
  });
});

describe('categoriesWithCounts', () => {
  const list = [{ category: 'vision' }, { category: 'vision' }, { category: 'research' }];

  test('labels and counts the categories in use, in the fixed order', () => {
    expect(categoriesWithCounts(list)).toEqual([
      { value: 'vision', label: 'Computer Vision', count: 2 },
      { value: 'research', label: 'Research', count: 1 },
    ]);
  });

  test('leaves out empty categories', () => {
    expect(categoriesWithCounts([])).toEqual([]);
  });
});

describe('neighbours', () => {
  const list = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];

  test('finds the items on either side', () => {
    expect(neighbours(list, 'b')).toEqual({ previous: { slug: 'a' }, next: { slug: 'c' } });
  });

  test('wraps around at both ends, so the last project leads somewhere', () => {
    expect(neighbours(list, 'a').previous).toEqual({ slug: 'c' });
    expect(neighbours(list, 'c').next).toEqual({ slug: 'a' });
  });

  test('a list of one has nowhere to go', () => {
    expect(neighbours([{ slug: 'a' }], 'a')).toEqual({ previous: null, next: null });
  });

  test('an unknown item has nowhere to go', () => {
    expect(neighbours(list, 'z')).toEqual({ previous: null, next: null });
  });
});

describe('isSafeHref: a link can go to one of our pages or a normal https page', () => {
  test.each(['/contact', '/projects/some-project', '/#resume', 'https://example.com/a'])('accepts %s', (value) => {
    expect(isSafeHref(value)).toBe(true);
  });

  test.each(['javascript:alert(1)', '//evil.example', '/\\evil.example', 'http://example.com', 'contact', ''])('refuses %j', (value) => {
    expect(isSafeHref(value)).toBe(false);
  });
});

describe('isHttpsUrl: a link in the content can only ever open a normal https page', () => {
  test('accepts https links', () => {
    expect(isHttpsUrl('https://github.com/Parth3557')).toBe(true);
    expect(isHttpsUrl('https://www.linkedin.com/in/parth3557/')).toBe(true);
  });

  test.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'http://github.com/x', 'file:///etc/passwd', 'not a url', ''])('refuses %s', (value) => {
    expect(isHttpsUrl(value)).toBe(false);
  });
});

describe('findTodoFields', () => {
  test('names the fields still marked TODO', () => {
    expect(findTodoFields({ problem: 'TODO: describe it', title: 'Done', tags: ['TODO: one', 'ok'], order: 1, empty: null })).toEqual(['problem', 'tags']);
  });

  test('a normal sentence containing the letters is not a to-do', () => {
    expect(findTodoFields({ note: 'Tornado todo list' })).toEqual([]);
  });
});

const project = (over: object) => ({ order: 1, featured: false, category: 'genai', isPrivate: false, repoUrl: '', ...over });

describe('byOrder', () => {
  test('sorts by order without changing the original array', () => {
    const items = [{ order: 2 }, { order: 1 }];
    expect(byOrder(items).map((i) => i.order)).toEqual([1, 2]);
    expect(items[0].order).toBe(2);
  });
});

describe('featuredProjects', () => {
  test('keeps only featured projects, in order', () => {
    const list = [project({ order: 3, featured: true }), project({ order: 2 }), project({ order: 1, featured: true })];
    expect(featuredProjects(list).map((p) => p.order)).toEqual([1, 3]);
  });
});

describe('projectsInCategory', () => {
  const list = [project({ order: 1, category: 'genai' }), project({ order: 2, category: 'vision' })];

  test('all returns everything', () => {
    expect(projectsInCategory(list, 'all')).toHaveLength(2);
  });

  test('a category returns only its projects', () => {
    expect(projectsInCategory(list, 'vision').map((p) => p.order)).toEqual([2]);
  });
});

describe('publicRepoUrl', () => {
  test('returns the link for a public project', () => {
    const url = 'https://github.com/Parth3557/RAG';
    expect(publicRepoUrl(project({ repoUrl: url }))).toBe(url);
  });

  test('a private project never gets a link, even if one was entered by mistake', () => {
    expect(publicRepoUrl(project({ isPrivate: true, repoUrl: 'https://github.com/Parth3557/secret' }))).toBeNull();
  });

  test('refuses anything that is not a GitHub https link', () => {
    expect(publicRepoUrl(project({ repoUrl: 'javascript:alert(1)' }))).toBeNull();
    expect(publicRepoUrl(project({ repoUrl: 'https://evil.example/Parth3557/RAG' }))).toBeNull();
    expect(publicRepoUrl(project({ repoUrl: 'https://github.com.evil.example/x' }))).toBeNull();
  });

  test('an empty link gives null', () => {
    expect(publicRepoUrl(project({ repoUrl: '' }))).toBeNull();
  });
});
