import { makeHandler } from '@keystatic/astro/api';
import type { APIRoute } from 'astro';
import config from '../../../../keystatic.config';
import { failure, ownerSession } from '../../../lib/server/http';

export const prerender = false;

const handler = makeHandler({ config });

/** The editor's own API. It can write content, so it's behind the same login as the dashboard. */
export const ALL: APIRoute = async (context) => {
  if (!(await ownerSession(context))) return failure('Sign in required', 401);
  return handler(context);
};
