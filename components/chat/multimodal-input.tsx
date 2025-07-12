'use client';

import { useRef, useEffect, memo, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, Square } from 'lucide-react';

interface MultimodalInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onStop?: () => void;
}

function PureMultimodalInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  onStop,
}: MultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [input]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSubmit();
    }
  };

  return (
    <div className="relative flex items-end w-full gap-2 px-4 pb-4 pt-2">
      <div className="relative flex-1 flex items-end rounded-2xl border bg-background">
        <textarea
          ref={textareaRef}
          placeholder="Send a message..."
          className="w-full resize-none bg-transparent px-4 py-3.5 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none max-h-[200px] min-h-[52px]"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isLoading}
        />
        
        <AnimatePresence mode="wait">
          <motion.div
            key={isLoading ? 'stop' : 'send'}
            className="absolute right-2 bottom-2"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            {isLoading ? (
              <button
                onClick={onStop}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                disabled={!isLoading}
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-30 transition-all"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(PureMultimodalInput);