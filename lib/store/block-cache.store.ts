import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface BlockCacheState {
  // Maps pageId -> order -> blockId
  blockCache: Map<string, Map<number, string>>;
  
  // Get or create a block ID for a given position
  getBlockId: (pageId: string, order: number) => string | undefined;
  setBlockId: (pageId: string, order: number, blockId: string) => void;
  clearPageCache: (pageId: string) => void;
  clearAllCache: () => void;
}

export const useBlockCacheStore = create<BlockCacheState>()(
  devtools(
    (set, get) => ({
      blockCache: new Map(),
      
      getBlockId: (pageId: string, order: number) => {
        const pageCache = get().blockCache.get(pageId);
        return pageCache?.get(order);
      },
      
      setBlockId: (pageId: string, order: number, blockId: string) => {
        set((state) => {
          const newCache = new Map(state.blockCache);
          
          if (!newCache.has(pageId)) {
            newCache.set(pageId, new Map());
          }
          
          newCache.get(pageId)!.set(order, blockId);
          
          console.log('📌 Cached block ID:', blockId, 'for page:', pageId, 'order:', order);
          
          return { blockCache: newCache };
        });
      },
      
      clearPageCache: (pageId: string) => {
        set((state) => {
          const newCache = new Map(state.blockCache);
          newCache.delete(pageId);
          console.log('🗑️ Cleared cache for page:', pageId);
          return { blockCache: newCache };
        });
      },
      
      clearAllCache: () => {
        set({ blockCache: new Map() });
        console.log('🗑️ Cleared all block cache');
      },
    }),
    {
      name: 'block-cache',
    }
  )
);