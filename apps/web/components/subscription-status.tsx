// components/subscription-status.tsx
'use client';

import * as React from "react";
import { useQuery } from '@tanstack/react-query';
import { useSidebar } from "@repo/ui/components/sidebar";

interface MessageData {
  unlimited?: boolean;
  remainingMessages?: number;
  subscriptionTier?: string;
}

async function fetchMessageData(): Promise<MessageData> {
  const res = await fetch('/api/team/limit');
  if (!res.ok) {
    throw new Error('Error loading message count');
  }
  return res.json();
}

export function SubscriptionStatus() {
  const { state } = useSidebar(); // "expanded" or "collapsed"

  const { data: messageData, isLoading: loading, isError, error } = useQuery({
    queryKey: ['team-limit'],
    queryFn: fetchMessageData,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });

  // Determine subscription tier name.
  const tierName =
    messageData && messageData.subscriptionTier && messageData.subscriptionTier.trim() !== ""
      ? messageData.subscriptionTier
      : "Free";

  // Format text based on sidebar state.
  const subscriptionBadgeText =
    state === "collapsed" ? tierName.charAt(0).toUpperCase() : tierName;

  const messagesBadgeText = React.useMemo(() => {
    if (!messageData) return '';
    const { unlimited, remainingMessages } = messageData;
    if (state === "collapsed") {
      return unlimited ? '∞' : String(remainingMessages);
    } else {
      return unlimited ? "Messages: Unlimited" : `Messages: ${remainingMessages} left`;
    }
  }, [messageData, state]);

  // Set badge color: green if unlimited or remaining > 0; red if 0.
  const badgeColorClass = React.useMemo(() => {
    if (!messageData) return '';
    const { unlimited, remainingMessages } = messageData;
    if (unlimited) return 'bg-green-500';
    return (remainingMessages && remainingMessages > 0) ? 'bg-green-500' : 'bg-red-500';
  }, [messageData]);

  return (
    <div className="flex flex-col items-center space-y-2">
      {/* Subscription Tier Badge */}
      <div>
        <span className="rounded-full px-2 py-1 text-xs font-semibold text-white bg-blue-500">
          {subscriptionBadgeText}
        </span>
      </div>
      {/* Messages Left Badge */}
      <div>
        {loading ? (
          <span className="text-xs text-neutral-500">Loading...</span>
        ) : isError ? (
          <span className="text-xs text-neutral-500">
            {error instanceof Error ? error.message : 'Error loading message count'}
          </span>
        ) : (
          <span className={`rounded-full px-2 py-1 text-xs font-semibold text-white ${badgeColorClass}`}>
            {messagesBadgeText}
          </span>
        )}
      </div>
    </div>
  );
}
