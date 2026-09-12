import React from 'react';
import { Clock } from 'lucide-react';
import { RecentLink, recordLinkClick } from '../../lib/recentLinks';

function getHostname(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function RecentList({ links }: { links: RecentLink[] }) {
  if (links.length === 0) {
    return (
      <p className="text-xs text-zinc-400 dark:text-zinc-500 py-1">
        Links you open from Quick Links will show up here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {links.slice(0, 6).map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => recordLinkClick(link)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors duration-150 min-w-0"
        >
          <Clock size={12} className="text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
          <span className="text-sm text-zinc-800 dark:text-zinc-100 truncate flex-1">{link.label}</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate flex-shrink-0 max-w-[100px]">{getHostname(link.url)}</span>
        </a>
      ))}
    </div>
  );
}
