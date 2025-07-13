'use client';

import { useEffect, useState } from 'react';

export function DebugConsole() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Intercept console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (type: string, ...args: any[]) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            // Try to stringify with a circular reference handler
            const seen = new WeakSet();
            return JSON.stringify(arg, (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                  return '[Circular Reference]';
                }
                seen.add(value);
              }
              return value;
            }, 2);
          } catch (e) {
            // If it still fails, return a string representation
            return '[Complex Object]';
          }
        }
        return String(arg);
      }).join(' ');
      
      // Defer state update to avoid updating during render
      setTimeout(() => {
        setLogs(prev => [...prev.slice(-100), `[${type}] ${new Date().toLocaleTimeString()}: ${message}`]);
      }, 0);
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('LOG', ...args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('ERROR', ...args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('WARN', ...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 z-50"
      >
        Show Debug Console
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-96 bg-gray-900 text-white overflow-hidden flex flex-col z-50">
      <div className="flex justify-between items-center p-2 bg-gray-800">
        <h3 className="font-semibold">Debug Console</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {logs.map((log, i) => (
          <div 
            key={i} 
            className={`mb-1 ${
              log.includes('[ERROR]') ? 'text-red-400' : 
              log.includes('[WARN]') ? 'text-yellow-400' : 
              'text-gray-300'
            }`}
          >
            {log}
          </div>
        ))}
      </div>
      <div className="p-2 bg-gray-800">
        <button
          onClick={() => setLogs([])}
          className="text-sm text-gray-400 hover:text-white"
        >
          Clear
        </button>
      </div>
    </div>
  );
}