import React from 'react';
import { Star } from 'lucide-react';
import { recordLinkClick } from '../../lib/recentLinks';

interface FavoriteLink {
  id: string;
  label: string;
  url: string;
}

function getHostname(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return '';
  }
}

export default function FavoritesList({ links }: { links: FavoriteLink[] }) {
  if (links.length === 0) {
    return (
      <p className="text-xs text-zinc-400 dark:text-zinc-500 py-1">
        Star a link in Quick Links to pin it here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => recordLinkClick(link)}
          className="surface-card flex items-center gap-2 px-2.5 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg min-w-0"
        >
          <img
            src={getFaviconUrl(link.url)}
            alt=""
            width={16}
            height={16}
            className="flex-shrink-0 rounded-[3px]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="flex flex-col min-w-0 leading-tight flex-1">
            <span className="text-[12px] font-medium text-zinc-800 dark:text-zinc-100 truncate">{link.label}</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{getHostname(link.url)}</span>
          </span>
          <Star size={11} className="text-amber-500 flex-shrink-0" fill="currentColor" />
        </a>
      ))}
    </div>
  );
}
