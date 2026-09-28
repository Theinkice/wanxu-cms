import type { FC } from 'hono/jsx';
import type { Lang } from '../types';

interface CopyableProps {
  value: string;
  lang: Lang;
  href?: string;
}

export const Copyable: FC<CopyableProps> = ({ value, lang, href }) => {
  const title = lang === 'zh' ? '点击复制' : 'Click to copy';
  const copiedLabel = lang === 'zh' ? '已复制' : 'Copied';
  if (href) {
    return (
      <a
        class="copy-value"
        href={href}
        data-copy={value}
        data-copied={copiedLabel}
        title={title}
      >
        {value}
      </a>
    );
  }
  return (
    <span
      class="copy-value"
      role="button"
      tabIndex={0}
      data-copy={value}
      data-copied={copiedLabel}
      title={title}
    >
      {value}
    </span>
  );
};
