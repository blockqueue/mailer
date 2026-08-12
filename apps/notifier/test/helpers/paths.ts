import path from 'node:path';
import { fileURLToPath } from 'node:url';

const helpersDir = path.dirname(fileURLToPath(import.meta.url));

export const fixturesDir = path.join(helpersDir, '..', 'fixtures');
export const templatesFixtureDir = path.join(fixturesDir, 'templates');
