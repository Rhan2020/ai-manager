declare module 'react-markdown' {
  import * as React from 'react';
  interface ReactMarkdownProps {
    children: string | string[];
    remarkPlugins?: any[];
    rehypePlugins?: any[];
    components?: any;
    className?: string;
  }
  const ReactMarkdown: React.FC<ReactMarkdownProps>;
  export default ReactMarkdown;
}