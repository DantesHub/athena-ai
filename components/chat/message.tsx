'use client';

import { motion } from 'framer-motion';
import { memo } from 'react';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

function PureMessage({ role, content, isLoading }: MessageProps) {
  return (
    <motion.div
      className={`group/message mx-auto w-full max-w-3xl px-4 ${
        role === 'user' ? 'pt-4' : ''
      }`}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`flex gap-3 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
        <div className={`size-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
          role === 'assistant' 
            ? 'bg-muted text-muted-foreground' 
            : 'bg-foreground text-background'
        }`}>
          {role === 'assistant' ? 'AI' : 'U'}
        </div>
        
        <div className={`flex-1 ${role === 'user' ? 'flex justify-end' : ''}`}>
          <div
            className={`inline-block rounded-2xl px-4 py-2 max-w-[85%] ${
              role === 'user'
                ? 'bg-foreground text-background'
                : 'bg-muted'
            }`}
          >
            {isLoading ? (
              <div className="flex space-x-1 py-1">
                <motion.div
                  className="size-1.5 rounded-full bg-current opacity-40"
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="size-1.5 rounded-full bg-current opacity-40"
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="size-1.5 rounded-full bg-current opacity-40"
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export const Message = memo(PureMessage);

export function ThinkingMessage() {
  return (
    <motion.div
      className="group/message mx-auto w-full max-w-3xl px-4"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex gap-3">
        <div className="size-8 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">
          AI
        </div>
        
        <div className="flex-1">
          <div className="inline-block rounded-2xl px-4 py-2 bg-muted text-muted-foreground">
            <p className="text-sm">Thinking...</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}