// src/components/StreamingChat.tsx
'use client';

import { useChat, Message } from 'ai/react';

export default function StreamingChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat', // Use local API route instead of external URL
    keepLastMessageOnError: true,
  });

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message: Message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg ${
              message.role === 'user'
                ? 'bg-purple-100 ml-8'
                : 'bg-white/50 mr-8'
            }`}
          >
            <div className="font-semibold mb-1">
              {message.role === 'user' ? 'You:' : 'AI:'}
            </div>
            <div className="text-gray-700">{message.content}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white/30">
        <div className="flex gap-2">
          <input
            className="flex-1 p-4 rounded-lg bg-white/50 border border-purple-200 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-inner"
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-4 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}