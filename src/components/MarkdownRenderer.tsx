import * as React from 'react';
import type { FC, ChangeEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  markdown: string;
}

export default function MarkdownRenderer({ markdown }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm as any]}
      className="prose prose-sm dark:prose-invert max-w-none"
    >
      {markdown}
    </ReactMarkdown>
  );
}