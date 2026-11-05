/** Rules for what the site shows. They live here so they hold on every page. */
type Ordered = { order: number };

export const PRIVATE_PROJECT_LABEL = 'Research · paper under review · code on request';

/** Links in the content can only open a normal https page, never run script. */
export function isHttpsUrl(value: string): boolean {
  try {
    return value === value.trim() && new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** A link in the content can go to one of our own pages or to a normal https page. */
export function isSafeHref(value: string): boolean {
  return /^\/(?![/\\])/.test(value) || isHttpsUrl(value);
}

/** GitHub Pages redirects /contact to /contact/, so a page link goes straight there. Files and other sites stay as written. */
export function pageHref(href: string): string {
  const [, path, rest] = href.match(/^(\/[^?#]*)(.*)$/) ?? [];
  if (!path || path.endsWith('/') || /\.[a-z0-9]+$/i.test(path)) return href;
  return `${path}/${rest}`;
}

export const CATEGORIES = [
  { value: 'genai', label: 'GenAI / RAG' },
  { value: 'vision', label: 'Computer Vision' },
  { value: 'research', label: 'Research' },
  { value: 'android', label: 'Android' },
] as const;

export function categoriesWithCounts(projects: ReadonlyArray<{ category: string }>) {
  return CATEGORIES
    .map((category) => ({ ...category, count: projects.filter((project) => project.category === category.value).length }))
    .filter((category) => category.count > 0);
}

/** The items on either side, wrapping around, so the last project still leads somewhere. */
export function neighbours<T extends { slug: string }>(items: readonly T[], slug: string): { previous: T | null; next: T | null } {
  const at = items.findIndex((item) => item.slug === slug);
  if (at === -1 || items.length < 2) return { previous: null, next: null };
  return { previous: items[(at - 1 + items.length) % items.length], next: items[(at + 1) % items.length] };
}

const isTodo = (value: unknown) => typeof value === 'string' && /^\s*TODO\b/.test(value);

/** Real text, or nothing. A TODO placeholder must never reach a public page. */
export function published(value: string): string {
  return isTodo(value) || !value.trim() ? '' : value;
}

/** The names of fields still holding a TODO placeholder. */
export function findTodoFields(data: Record<string, unknown>): string[] {
  return Object.entries(data)
    .filter(([, value]) => (Array.isArray(value) ? value.some(isTodo) : isTodo(value)))
    .map(([name]) => name);
}

export function byOrder<T extends Ordered>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function featuredProjects<T extends Ordered & { featured: boolean }>(projects: readonly T[]): T[] {
  return byOrder(projects.filter((project) => project.featured));
}

export function projectsInCategory<T extends Ordered & { category: string }>(projects: readonly T[], category: string): T[] {
  return byOrder(category === 'all' ? projects : projects.filter((project) => project.category === category));
}

/** A private project never gets a link, even if one is entered in the dashboard by mistake. */
export function publicRepoUrl(project: { isPrivate: boolean; repoUrl?: string | null }): string | null {
  if (project.isPrivate || !project.repoUrl) return null;
  try {
    const url = new URL(project.repoUrl);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? project.repoUrl : null;
  } catch {
    return null;
  }
}
