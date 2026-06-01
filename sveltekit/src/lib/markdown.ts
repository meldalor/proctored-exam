import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

marked.use({ breaks: true, gfm: true });

export function md(text: string): string {
	if (!text) return '';
	return DOMPurify.sanitize(marked.parse(text) as string);
}
