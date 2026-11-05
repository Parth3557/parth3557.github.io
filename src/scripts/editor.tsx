/** Mounts the content editor from a bundled file, so the page needs no inline script. */
import { makePage } from '@keystatic/astro/ui';
import { createRoot } from 'react-dom/client';
import config from '../../keystatic.config';

const Editor = makePage(config);
const root = document.getElementById('editor');
if (root) createRoot(root).render(<Editor />);
