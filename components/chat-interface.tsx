'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Message, ThinkingMessage } from './chat/message';
import { MultimodalInput } from './chat/multimodal-input';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  initialMessage?: string;
  onClose: () => void;
}

export function ChatInterface({ initialMessage, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMessage && !hasInitialized) {
      setHasInitialized(true);
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: initialMessage,
      };
      setMessages([userMessage]);
      
      // Show thinking message
      setShowThinking(true);
      setIsLoading(true);
      
      // Simulate AI response
      const timeoutId = setTimeout(() => {
        setShowThinking(false);
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `I'll help you with: "${initialMessage}". What specific aspects would you like to explore?`,
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsLoading(false);
      }, 1500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [initialMessage, hasInitialized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showThinking]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setShowThinking(true);
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      setShowThinking(false);
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `You said: "${userMessage.content}". Let me help you with that...`,
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleStop = () => {
    setIsLoading(false);
    setShowThinking(false);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b shrink-0">
        <h2 className="text-base font-medium">New chat</h2>
        <button
          onClick={onClose}
          className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="flex flex-col gap-4 py-4">
          {messages.length === 0 && !showThinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center px-4 py-16"
            >
              <h3 className="text-xl font-semibold mb-2">How can I help you today?</h3>
              <p className="text-muted-foreground">Ask me anything or choose a suggestion below</p>
            </motion.div>
          )}
          
          {messages.map((message, index) => (
            <Message
              key={message.id}
              role={message.role}
              content={message.content}
              isLoading={false}
            />
          ))}
          
          {showThinking && <ThinkingMessage />}
          
          <div ref={messagesEndRef} className="h-px" />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 mx-auto w-full max-w-3xl">
        <MultimodalInput
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}