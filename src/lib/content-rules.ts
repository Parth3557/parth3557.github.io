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

const isTodo = (value: unknown) => typeof value === 'string' && /^\s*TODO\b/.test(value);

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
