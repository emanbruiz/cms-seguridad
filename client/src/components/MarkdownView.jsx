import Markdown from 'react-markdown';

const MEDIA_URL = /^\/api\/media\/[a-f0-9-]{36}\.(png|jpg|webp)$/;

const components = {
  a: ({ href, title, children }) => (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) =>
    typeof src === 'string' && MEDIA_URL.test(src) ? (
      <img src={src} alt={alt ?? ''} loading="lazy" />
    ) : (
      <span className="text-slate-500">[imagen externa bloqueada]</span>
    ),
};

export default function MarkdownView({ children }) {
  return (
    <div className="markdown">
      <Markdown components={components}>{children}</Markdown>
    </div>
  );
}