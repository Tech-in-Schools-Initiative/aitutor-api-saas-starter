// src/components/StreamingChat.tsx
'use client';

import { useChat, Message } from 'ai/react';
import { Input } from '@repo/ui/components/input';
import { Button } from '@repo/ui/components/button';
import { Loader2, MessageCircle } from 'lucide-react';

export default function StreamingChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat', // Use local API route instead of external URL
    keepLastMessageOnError: true,
  });

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No messages yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Send a message below to start streaming a conversation.
            </p>
          </div>
        ) : (
          messages.map((message: Message) => (
            <div
              key={message.id}
              data-role={message.role}
              className={`p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-purple-100 ml-8'
                  : 'bg-muted mr-8'
              }`}
            >
              <div className="font-semibold mb-1">
                {message.role === 'user' ? 'You:' : 'AI:'}
              </div>
              <div className="text-gray-700">{message.content}</div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          aria-label="Chat message"
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Send'
          )}
        </Button>
      </form>
    </div>
  );
}
