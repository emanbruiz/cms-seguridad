import Markdown from 'react-markdown';

const components = {
  a: ({ href, title, children }) => (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export default function MarkdownView({ children }) {
  return (
    <div className="markdown">
      <Markdown components={components}>{children}</Markdown>
    </div>
  );
}