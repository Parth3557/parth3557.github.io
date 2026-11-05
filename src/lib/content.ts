/**
 * Every word and number on the site comes from the files in /content, which the editor writes.
 * They're validated here, so a bad edit fails the build and the live site stays as it was.
 */
import { z } from 'astro/zod';
import { parse } from 'yaml';
import { byOrder, CATEGORIES, findTodoFields, isHttpsUrl, isSafeHref, publicRepoUrl } from './content-rules';

const files = import.meta.glob<string>('/content/**/*.yaml', { eager: true, query: '?raw', import: 'default' });

const text = z.string().nullish().transform((value) => value ?? '');
const list = z.array(z.string()).nullish().transform((value) => value ?? []);
const order = z.number().int().nullish().transform((value) => value ?? 1);
const flag = z.boolean().nullish().transform((value) => value ?? false);
const path = z.string().nullish().transform((value) => value || null);
// A link in the content can't become a javascript: link on the page, even after a bad edit.
const httpsUrl = z.string().refine(isHttpsUrl, 'Must be an https link');
const optionalHttpsUrl = text.refine((value) => !value || isHttpsUrl(value), 'Must be an https link');

function read<S extends z.ZodObject>(name: string, raw: string, schema: S): z.output<S> {
  try {
    return schema.parse(parse(raw)) as z.output<S>;
  } catch (error) {
    throw new Error(`Invalid content in content/${name}.yaml: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function single<S extends z.ZodObject>(name: string, schema: S): z.output<S> {
  const raw = files[`/content/${name}.yaml`];
  if (raw === undefined) throw new Error(`Missing content/${name}.yaml`);
  return read(name, raw, schema);
}

function collection<S extends z.ZodObject>(name: string, schema: S): Array<z.output<S> & { slug: string }> {
  const prefix = `/content/${name}/`;
  return Object.entries(files)
    .filter(([file]) => file.startsWith(prefix))
    .map(([file, raw]) => {
      const slug = file.slice(prefix.length, -'.yaml'.length);
      return { ...read(`${name}/${slug}`, raw, schema), slug };
    });
}

export const profile = single('profile', z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  studies: text,
  location: text,
  hometown: text,
  email: z.email(),
  githubUrl: httpsUrl,
  linkedinUrl: httpsUrl,
  bio: text,
  curiosity: text,
  availability: text,
  photo: path,
  resume: path,
  resumePreview: path,
}));

export const home = single('home', z.object({
  statement: z.string().min(1),
  heroAchievement: z.string().min(1),
  serveFact: text,
  journeyHeading: z.string().min(1),
  projectsHeading: z.string().min(1),
  resumeHeading: z.string().min(1),
  resumeNote: text,
  contactHeading: z.string().min(1),
}));

const heading = z.string().min(1);

export const pages = single('pages', z.object({
  aboutHeading: heading,
  valuesHeading: heading,
  courtHeading: heading,
  educationHeading: heading,
  certificationsHeading: heading,
  experienceHeading: heading,
  workHeading: heading,
  achievementsHeading: heading,
  skillsHeading: heading,
  problemHeading: heading,
  approachHeading: heading,
  pipelineHeading: heading,
  resultsHeading: heading,
  techHeading: heading,
}));

export const about = single('about', z.object({ story: text, values: list, badminton: text }));

export const theme = single('theme', z.object({ heavyAnimations: flag }));

// The loader itself strips a private project's link, so no page can render one by mistake.
export const projects = byOrder(collection('projects', z.object({
  title: z.string().min(1),
  badge: text,
  summary: text,
  problem: text,
  approach: text,
  pipeline: list,
  results: list,
  tech: list,
  category: z.enum(CATEGORIES.map((category) => category.value)),
  repoUrl: text,
  isPrivate: flag,
  featured: flag,
  order,
  coverImage: path,
  coverDiagram: z.enum(['none', 'multimodal']).nullish().transform((value) => value ?? 'none'),
  coverAlt: text,
  coverCredit: text,
}))).map((project) => ({ ...project, repoUrl: publicRepoUrl(project) }));

export const journey = byOrder(collection('journey', z.object({
  title: z.string().min(1),
  date: text,
  place: text,
  description: text,
  fact: text,
  icon: text,
  order,
  showOnHome: flag,
  smash: flag,
  metric: text,
  metricFrom: z.number().nullish().transform((value) => value ?? null),
  metricLabel: text,
  linkHref: text.refine((value) => !value || isSafeHref(value), 'Must be a page on this site or an https link'),
  linkLabel: text,
})));
export const journeyOnHome = journey.filter((stop) => stop.showOnHome);

export const achievements = byOrder(collection('achievements', z.object({
  title: z.string().min(1),
  metric: text,
  metricFrom: z.number().nullish().transform((value) => value ?? null),
  metricLabel: text,
  year: text,
  details: list,
  sourceUrl: optionalHttpsUrl,
  order,
})));

const chosen = achievements.find((item) => item.slug === home.heroAchievement);
if (!chosen) throw new Error(`content/home.yaml names an achievement that doesn't exist: ${home.heroAchievement}`);
export const heroAchievement = chosen;

export const experience = byOrder(collection('experience', z.object({
  title: z.string().min(1),
  company: text,
  place: text,
  dates: text,
  points: list,
  order,
})));

export const education = byOrder(collection('education', z.object({
  title: z.string().min(1),
  institution: text,
  dates: text,
  cgpa: text,
  order,
})));

export const skills = byOrder(collection('skills', z.object({ title: z.string().min(1), items: list, order })));

export const certifications = byOrder(collection('certifications', z.object({ title: z.string().min(1), issuer: text, order })));

const FIELD_NAMES: Record<string, string> = {
  problem: 'the problem',
  approach: 'the approach',
  story: 'your curiosity story',
  badminton: 'lessons from the court',
};

/** What the owner still has to fill in. Shown on the dashboard, each with a link to where it's edited. */
export function contentTodos(): Array<{ text: string; path: string }> {
  const todos: Array<{ text: string; path: string }> = [];
  const missing = (data: Record<string, unknown>) => findTodoFields(data).map((field) => FIELD_NAMES[field] ?? field).join(' and ');
  if (!profile.photo) todos.push({ text: 'Profile: add a photo', path: 'singleton/profile' });
  if (!profile.resume) todos.push({ text: 'Profile: add your resume PDF, with your phone number removed first', path: 'singleton/profile' });
  const aboutGaps = missing(about);
  if (aboutGaps) todos.push({ text: `About page: write ${aboutGaps}`, path: 'singleton/about' });
  for (const project of projects) {
    const gaps = missing(project);
    if (gaps) todos.push({ text: `${project.title}: write ${gaps}`, path: `collection/projects/item/${project.slug}` });
    if (!project.coverImage && project.coverDiagram === 'none') {
      todos.push({ text: `${project.title}: add a cover image`, path: `collection/projects/item/${project.slug}` });
    }
  }
  return todos;
}
