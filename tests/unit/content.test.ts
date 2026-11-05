import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { achievements, contentTodos, heroAchievement, home, journeyOnHome, profile, projects, skills } from '../../src/lib/content';
import { isHttpsUrl } from '../../src/lib/content-rules';

const contentFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? contentFiles(path) : [path];
  });

describe('the seeded content', () => {
  test('has all eight projects, sorted by order', () => {
    expect(projects).toHaveLength(8);
    expect(projects.map((project) => project.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('exactly the two research projects are private, and they have no link', () => {
    const hidden = projects.filter((project) => project.isPrivate);
    expect(hidden.map((project) => project.slug).sort()).toEqual([
      'artifact-robust-gi-endoscopy-classifier',
      'grassroots-football-talent-analytics',
    ]);
    for (const project of hidden) expect(project.repoUrl).toBeNull();
  });

  test('every public project links to GitHub', () => {
    for (const project of projects.filter((entry) => !entry.isPrivate)) {
      expect(project.repoUrl).toMatch(/^https:\/\/github\.com\/Parth3557\//);
    }
  });

  test('the headline metrics match the brief', () => {
    expect(projects.find((project) => project.slug === 'artifact-robust-gi-endoscopy-classifier')?.badge).toBe('97.99% accuracy');
    expect(projects.find((project) => project.slug === 'neuroscan-brain-tumor-mri-classifier')?.badge).toBe('98.07% test accuracy');
    expect(heroAchievement.metric).toBe('38');
    expect(achievements.find((item) => item.slug === 'amazon-ml-challenge-2026')?.metric).toBe('91');
  });

  test('the journey on the home page is ordered and has one smash', () => {
    expect(journeyOnHome.map((stop) => stop.order)).toEqual([...journeyOnHome.map((stop) => stop.order)].sort((a, b) => a - b));
    expect(journeyOnHome.filter((stop) => stop.smash)).toHaveLength(1);
  });

  test('contact details are the owner\'s real ones', () => {
    expect(profile.email).toBe('parth.jadhav.3557@gmail.com');
    expect(profile.githubUrl).toBe('https://github.com/Parth3557');
    expect(profile.linkedinUrl).toMatch(/^https:\/\/www\.linkedin\.com\/in\/parth3557\/?$/);
    expect(home.contactHeading).toBe("What's next?");
  });

  test('the public resume and its preview exist', () => {
    expect(profile.resume).toBe('/resume/resume.pdf');
    expect(profile.resumePreview).toBe('/resume/resumePreview.webp');
    expect(existsSync(`public${profile.resume}`)).toBe(true);
    expect(existsSync(`public${profile.resumePreview}`)).toBe(true);
    expect(home.resumeHeading).toBe('Resume');
  });

  test('every outside link in the content is https', () => {
    expect(isHttpsUrl(profile.githubUrl)).toBe(true);
    expect(isHttpsUrl(profile.linkedinUrl)).toBe(true);
    for (const achievement of achievements) {
      if (achievement.sourceUrl) expect(isHttpsUrl(achievement.sourceUrl)).toBe(true);
    }
  });

  test('no phone number is in any content file', () => {
    const phone = /(?<![\d.])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\d.])/;
    for (const file of contentFiles('content')) {
      expect(readFileSync(file, 'utf8')).not.toMatch(phone);
    }
  });

  test('skills are grouped and ordered', () => {
    expect(skills.map((group) => group.title)).toEqual(['AI/ML', 'NLP & GenAI', 'Computer Vision', 'Frameworks', 'Languages', 'Tools']);
  });
});

describe('contentTodos', () => {
  test('lists what the owner still has to fill in, each with a place to edit it', () => {
    const todos = contentTodos();
    expect(todos.length).toBeGreaterThan(0);
    for (const todo of todos) {
      expect(todo.text).toBeTruthy();
      expect(todo.path).toMatch(/^(singleton|collection)\//);
    }
    expect(todos.map((todo) => todo.text)).toContain('Profile: add a photo');
  });
});
