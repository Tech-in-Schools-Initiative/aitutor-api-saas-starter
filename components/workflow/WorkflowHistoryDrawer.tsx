// components/workflow/WorkflowHistoryDrawer.tsx
'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { HistoryIcon, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HistoryItem {
  id: number;
  input: string;
  output: string;
  createdAt: string;
}

interface WorkflowHistoryDrawerProps {
  onSelectHistory: (input: string, output: string) => void;
}

export function WorkflowHistoryDrawer({ onSelectHistory }: WorkflowHistoryDrawerProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/workflow/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open]);

  const handleSelectHistory = (item: HistoryItem) => {
    onSelectHistory(item.input, item.output);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="ml-2">
          <HistoryIcon className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Ad History</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No generate ads found</p>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div 
                  key={item.id} 
                  className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleSelectHistory(item)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900 truncate max-w-[80%]">{item.input}</h3>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2">{item.output}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
