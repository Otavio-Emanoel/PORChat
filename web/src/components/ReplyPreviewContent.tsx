'use client';

import React from 'react';
import { BarChart3, FileText, Image as ImageIcon, Mic } from 'lucide-react';
import type { ReplyPreviewMeta } from '@/lib/chatHelpers';

interface ReplyPreviewContentProps {
  meta: ReplyPreviewMeta;
  iconSizeClass?: string;
}

/**
 * Renders the media icon and label inside reply preview cards.
 */
export const ReplyPreviewContent: React.FC<ReplyPreviewContentProps> = ({
  meta,
  iconSizeClass = 'w-3 h-3',
}) => {
  if (meta.kind === 'image') {
    return (
      <>
        <ImageIcon className={`${iconSizeClass} text-brand-primary shrink-0`} />
        <span className="truncate">{meta.label}</span>
      </>
    );
  }
  if (meta.kind === 'voice') {
    return (
      <>
        <Mic className={`${iconSizeClass} text-brand-primary shrink-0`} />
        <span className="truncate">{meta.label}</span>
      </>
    );
  }
  if (meta.kind === 'file') {
    return (
      <>
        <FileText className={`${iconSizeClass} text-brand-primary shrink-0`} />
        <span className="truncate">{meta.label}</span>
      </>
    );
  }
  if (meta.kind === 'poll') {
    return (
      <>
        <BarChart3 className={`${iconSizeClass} text-brand-primary shrink-0`} />
        <span className="truncate">{meta.label}</span>
      </>
    );
  }
  return <span className="truncate">{meta.label}</span>;
};
