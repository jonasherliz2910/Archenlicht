import { readFileSync } from 'node:fs';
export const PODBASE_PRINT_TEMPLATES = JSON.parse(readFileSync(new URL('./podbase-print-templates.json', import.meta.url), 'utf8'));
