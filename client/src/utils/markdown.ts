import { MessageBlock } from '../types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeInline(text: string): string {
  let escaped = escapeHtml(text);
  escaped = escaped.replace(/\r\n/g, '\n');
  escaped = escaped.replace(/\n/g, '<br />');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
  escaped = escaped.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  return escaped;
}

export function parseMarkdown(source: string): MessageBlock[] {
  const text = source.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const blocks: MessageBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && lines[index].startsWith('```')) {
        index += 1;
      }
      blocks.push({
        type: 'code',
        text: codeLines.join('\n'),
        language: language || undefined,
      });
      continue;
    }
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].startsWith('>')) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({
        type: 'quote',
        text: quoteLines.join('\n'),
      });
      continue;
    }
    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index];
        const match = current.match(/^(\d+)\.\s+(.*)$/);
        if (!match) break;
        items.push(match[2]);
        index += 1;
      }
      blocks.push({ type: 'list', style: 'number', items });
      continue;
    }
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index];
        if (!/^[-*+]\s+/.test(current)) break;
        items.push(current.replace(/^[-*+]\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'list', style: 'bullet', items });
      continue;
    }
    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      if (
        !current.trim() ||
        /^\s*```/.test(current) ||
        /^#{1,6}\s+/.test(current) ||
        /^>/.test(current) ||
        /^(\d+)\.\s+/.test(current) ||
        /^[-*+]\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') });
  }
  return blocks;
}

export function blocksToHtml(blocks: MessageBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading': {
          const level = Math.min(6, Math.max(1, block.level));
          return `<h${level}>${sanitizeInline(block.text)}</h${level}>`;
        }
        case 'paragraph':
          return `<p>${sanitizeInline(block.text)}</p>`;
        case 'code':
          return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
        case 'quote':
          return `<blockquote>${sanitizeInline(block.text)}</blockquote>`;
        case 'list': {
          const tag = block.style === 'number' ? 'ol' : 'ul';
          const items = block.items.map((item) => `<li>${sanitizeInline(item)}</li>`).join('');
          return `<${tag}>${items}</${tag}>`;
        }
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('');
}
