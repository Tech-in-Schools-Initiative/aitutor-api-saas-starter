// components/subscription-status.tsx
'use client';

import * as React from "react";
import { useSidebar } from "@/components/ui/sidebar";

interface MessageData {
  unlimited?: boolean;
  remainingMessages?: number;
  subscriptionTier?: string;
}

export function SubscriptionStatus() {
  const { state } = useSidebar(); // "expanded" or "collapsed"
  const [messageData, setMessageData] = React.useState<MessageData | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>("");

  // Function to fetch message data from your API endpoint.
  const fetchMessageData = React.useCallback(() => {
    fetch('/api/team/limit')
      .then((res) => res.json())
      .then((data) => {
        setMessageData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Error loading message count');
        setLoading(false);
      });
  }, []);

  // Initial fetch.
  React.useEffect(() => {
    fetchMessageData();
  }, [fetchMessageData]);

  // Poll every 10 seconds to update the badge.
  React.useEffect(() => {
    const interval = setInterval(fetchMessageData, 20000);
    return () => clearInterval(interval);
  }, [fetchMessageData]);

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
        ) : error ? (
          <span className="text-xs text-neutral-500">{error}</span>
        ) : (
          <span className={`rounded-full px-2 py-1 text-xs font-semibold text-white ${badgeColorClass}`}>
            {messagesBadgeText}
          </span>
        )}
      </div>
    </div>
  );
}
