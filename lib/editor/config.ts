import { Schema, Node as ProseMirrorNode } from 'prosemirror-model';
import { InputRule } from 'prosemirror-inputrules';
import { EditorView } from 'prosemirror-view';
import { Transaction, Plugin, PluginKey } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { 
  splitListItem, 
  liftListItem, 
  sinkListItem 
} from 'prosemirror-schema-list';

export const documentSchema = new Schema({
  nodes: {
    doc: {
      content: 'block+'
    },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() { return ['p', 0]; }
    },
    heading: {
      attrs: { level: { default: 1 } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } }
      ],
      toDOM(node) { return [`h${node.attrs.level}`, 0]; }
    },
    bullet_list: {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM() { return ['ul', 0]; }
    },
    ordered_list: {
      attrs: { order: { default: 1 } },
      content: 'list_item+',
      group: 'block',
      parseDOM: [{
        tag: 'ol',
        getAttrs(dom: HTMLElement) {
          return { order: dom.hasAttribute('start') ? +dom.getAttribute('start')! : 1 };
        }
      }],
      toDOM(node) {
        return node.attrs.order === 1 ? ['ol', 0] : ['ol', { start: node.attrs.order }, 0];
      }
    },
    list_item: {
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM() { return ['li', 0]; },
      defining: true
    },
    blockquote: {
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() { return ['blockquote', 0]; }
    },
    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() { return ['hr']; }
    },
    code_block: {
      content: 'text*',
      group: 'block',
      code: true,
      defining: true,
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM() { return ['pre', ['code', 0]]; }
    },
    text: {
      group: 'inline'
    },
    ai_suggestion: {
      content: 'inline*',
      group: 'block',
      attrs: {
        originalText: { default: '' }
      },
      parseDOM: [{
        tag: 'div[data-ai-suggestion]',
        getAttrs(dom: HTMLElement) {
          return { originalText: dom.getAttribute('data-original-text') || '' };
        }
      }],
      toDOM(node) {
        const header = ['div', { 
          'class': 'ai-suggestion-header',
          'contenteditable': 'false'
        }, node.attrs.originalText];
        
        const content = ['div', { 'class': 'ai-suggestion-content' }, 0];
        
        const sendButton = ['button', {
          'class': 'ai-suggestion-button ai-suggestion-send',
          'contenteditable': 'false',
          'title': 'Send'
        }, '→'];
        
        const closeButton = ['button', {
          'class': 'ai-suggestion-button ai-suggestion-close',
          'contenteditable': 'false',
          'title': 'Close'
        }, '×'];
        
        const buttons = ['div', { 
          'class': 'ai-suggestion-buttons',
          'contenteditable': 'false'
        }, sendButton, closeButton];
        
        return ['div', {
          'data-ai-suggestion': 'true',
          'data-original-text': node.attrs.originalText,
          'class': 'ai-suggestion-block'
        }, header, content, buttons];
      }
    },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM() { return ['br']; }
    }
  },
  marks: {
    em: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
      toDOM() { return ['em']; }
    },
    strong: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b' },
        { style: 'font-weight', getAttrs: (value: string | HTMLElement) => /^(bold(er)?|[5-9]\\d{2,})$/.test(value as string) && null }
      ],
      toDOM() { return ['strong']; }
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() { return ['code']; }
    }
  }
});

export function headingRule(level: number): InputRule {
  return new InputRule(
    new RegExp(`^(#{${level}})\\s$`),
    (state, match, start, end) => {
      const { tr } = state;
      tr.replaceWith(start - 1, end, documentSchema.nodes.heading.create({ level }));
      return tr;
    }
  );
}

export function bulletListRule(): InputRule {
  return new InputRule(
    /^(\s*)([-*])\s$/,
    (state, match, start, end) => {
      const { tr } = state;
      const indent = match[1].length;
      
      // Create a list item with a paragraph inside
      const listItem = documentSchema.nodes.list_item.create(
        null,
        documentSchema.nodes.paragraph.create()
      );
      
      // Create a bullet list containing the list item
      const bulletList = documentSchema.nodes.bullet_list.create(null, listItem);
      
      // Replace the current block with the bullet list
      const $start = tr.doc.resolve(start);
      const blockStart = $start.before($start.depth);
      tr.replaceWith(blockStart, end, bulletList);
      
      // Set cursor position inside the list item
      const pos = blockStart + 3; // +1 for bullet_list, +1 for list_item, +1 for paragraph
      tr.setSelection(state.selection.constructor.near(tr.doc.resolve(pos)));
      
      return tr;
    }
  );
}

export function orderedListRule(): InputRule {
  return new InputRule(
    /^(\s*)(\d+)\.\s$/,
    (state, match, start, end) => {
      const { tr } = state;
      const order = parseInt(match[2]);
      
      // Create a list item with a paragraph inside
      const listItem = documentSchema.nodes.list_item.create(
        null,
        documentSchema.nodes.paragraph.create()
      );
      
      // Create an ordered list containing the list item
      const orderedList = documentSchema.nodes.ordered_list.create({ order }, listItem);
      
      // Replace the current block with the ordered list
      const $start = tr.doc.resolve(start);
      const blockStart = $start.before($start.depth);
      tr.replaceWith(blockStart, end, orderedList);
      
      // Set cursor position inside the list item
      const pos = blockStart + 3; // +1 for ordered_list, +1 for list_item, +1 for paragraph
      tr.setSelection(state.selection.constructor.near(tr.doc.resolve(pos)));
      
      return tr;
    }
  );
}

function getPreviousBlockText(state: any): string {
  const { $from } = state.selection;
  const currentBlock = $from.parent;
  
  // Get text content of current block
  return currentBlock.textContent.trim();
}

function handleSpace(state: any, dispatch: any): boolean {
  const { $from, empty } = state.selection;
  
  // Only handle when selection is empty
  if (!empty) return false;
  
  // Check if current line is completely empty
  const currentBlock = $from.parent;
  if (currentBlock.content.size !== 0) return false;
  
  // Don't trigger if we're already in an AI suggestion
  if (currentBlock.type.name === 'ai_suggestion') return false;
  
  // Get the previous block's text (the block before the empty line)
  let previousBlockText = '';
  const blockBefore = $from.doc.resolve($from.before()).nodeBefore;
  if (blockBefore) {
    previousBlockText = blockBefore.textContent.trim();
  }
  
  // Don't create suggestion if there's no previous text
  if (!previousBlockText) return false;
  
  if (dispatch) {
    // Replace the current empty block with an AI suggestion (with empty content)
    const aiSuggestion = documentSchema.nodes.ai_suggestion.create(
      { originalText: previousBlockText }
      // Empty content - user will type in the content area
    );
    
    const from = $from.before();
    const to = $from.after();
    const tr = state.tr.replaceWith(from, to, aiSuggestion);
    
    // Set cursor inside the content area of the AI suggestion
    const newPos = from + 1;
    tr.setSelection(state.selection.constructor.near(tr.doc.resolve(newPos)));
    
    dispatch(tr);
  }
  
  return true;
}

function handleEscape(state: any, dispatch: any): boolean {
  const { $from } = state.selection;
  
  // Check if we're in an AI suggestion block
  if ($from.parent.type.name === 'ai_suggestion') {
    if (dispatch) {
      // Find the AI suggestion block position
      const $pos = state.doc.resolve($from.before());
      const from = $pos.pos;
      const to = $pos.after();
      
      // Delete the AI suggestion block
      const tr = state.tr.delete(from, to);
      dispatch(tr);
    }
    return true;
  }
  
  return false;
}

export function buildListKeymap(): Plugin {
  return keymap({
    'Enter': splitListItem(documentSchema.nodes.list_item),
    'Shift-Tab': liftListItem(documentSchema.nodes.list_item),
    'Tab': sinkListItem(documentSchema.nodes.list_item),
    'Space': handleSpace,
    'Escape': handleEscape,
  });
}

export function buildAISuggestionPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('aiSuggestion'),
    props: {
      handleDOMEvents: {
        click(view, event) {
          const target = event.target as HTMLElement;
          
          // Check if clicked on close button
          if (target.closest('.ai-suggestion-close')) {
            const suggestionBlock = target.closest('.ai-suggestion-block');
            if (suggestionBlock) {
              const pos = view.posAtDOM(suggestionBlock, 0);
              const $pos = view.state.doc.resolve(pos);
              const from = $pos.before();
              const to = $pos.after();
              
              // Replace with empty paragraph
              const tr = view.state.tr.replaceWith(from, to, documentSchema.nodes.paragraph.create());
              view.dispatch(tr);
              view.focus();
              return true;
            }
          }
          
          // Check if clicked on send button
          if (target.closest('.ai-suggestion-send')) {
            const suggestionBlock = target.closest('.ai-suggestion-block');
            if (suggestionBlock) {
              const pos = view.posAtDOM(suggestionBlock, 0);
              const $pos = view.state.doc.resolve(pos);
              const node = $pos.parent;
              
              // Get the content of the suggestion
              const content = node.textContent;
              
              // Replace with a regular paragraph containing the content
              const from = $pos.before();
              const to = $pos.after();
              const paragraph = documentSchema.nodes.paragraph.create(
                null,
                content ? documentSchema.text(content) : null
              );
              
              const tr = view.state.tr.replaceWith(from, to, paragraph);
              view.dispatch(tr);
              view.focus();
              return true;
            }
          }
          
          return false;
        }
      }
    }
  });
}

interface HandleTransactionProps {
  transaction: Transaction;
  editorRef: React.MutableRefObject<EditorView | null>;
  onSaveContent: (content: string, debounce: boolean) => void;
}

export function handleTransaction({
  transaction,
  editorRef,
  onSaveContent,
}: HandleTransactionProps) {
  if (!editorRef.current) return;

  const newState = editorRef.current.state.apply(transaction);
  editorRef.current.updateState(newState);

  if (transaction.docChanged && !transaction.getMeta('no-save')) {
    const content = buildContentFromDocument(newState.doc);
    onSaveContent(content, true);
  }
}

export function buildContentFromDocument(doc: ProseMirrorNode): string {
  const content: any[] = [];
  
  doc.content.forEach((node) => {
    if (node.type.name === 'paragraph') {
      content.push({
        type: 'paragraph',
        content: node.textContent
      });
    } else if (node.type.name === 'heading') {
      content.push({
        type: 'heading',
        level: node.attrs.level,
        content: node.textContent
      });
    } else if (node.type.name === 'bullet_list') {
      const items: string[] = [];
      node.content.forEach((listItem) => {
        items.push(listItem.textContent);
      });
      content.push({
        type: 'bullet_list',
        items
      });
    } else if (node.type.name === 'ordered_list') {
      const items: string[] = [];
      node.content.forEach((listItem) => {
        items.push(listItem.textContent);
      });
      content.push({
        type: 'ordered_list',
        order: node.attrs.order,
        items
      });
    } else if (node.type.name === 'code_block') {
      content.push({
        type: 'code_block',
        content: node.textContent
      });
    } else if (node.type.name === 'blockquote') {
      content.push({
        type: 'blockquote',
        content: node.textContent
      });
    } else if (node.type.name === 'ai_suggestion') {
      content.push({
        type: 'ai_suggestion',
        content: node.textContent,
        originalText: node.attrs.originalText
      });
    }
  });
  
  return JSON.stringify(content);
}

export function buildDocumentFromContent(content: string): ProseMirrorNode {
  try {
    const parsed = JSON.parse(content);
    const nodes: ProseMirrorNode[] = [];
    
    parsed.forEach((item: any) => {
      if (item.type === 'paragraph') {
        nodes.push(documentSchema.nodes.paragraph.create(null, documentSchema.text(item.content || '')));
      } else if (item.type === 'heading') {
        nodes.push(documentSchema.nodes.heading.create(
          { level: item.level || 1 },
          documentSchema.text(item.content || '')
        ));
      } else if (item.type === 'bullet_list') {
        const listItems: ProseMirrorNode[] = [];
        if (item.items && Array.isArray(item.items)) {
          item.items.forEach((itemText: string) => {
            listItems.push(documentSchema.nodes.list_item.create(
              null,
              documentSchema.nodes.paragraph.create(null, documentSchema.text(itemText || ''))
            ));
          });
        }
        if (listItems.length > 0) {
          nodes.push(documentSchema.nodes.bullet_list.create(null, listItems));
        }
      } else if (item.type === 'ordered_list') {
        const listItems: ProseMirrorNode[] = [];
        if (item.items && Array.isArray(item.items)) {
          item.items.forEach((itemText: string) => {
            listItems.push(documentSchema.nodes.list_item.create(
              null,
              documentSchema.nodes.paragraph.create(null, documentSchema.text(itemText || ''))
            ));
          });
        }
        if (listItems.length > 0) {
          nodes.push(documentSchema.nodes.ordered_list.create(
            { order: item.order || 1 },
            listItems
          ));
        }
      } else if (item.type === 'code_block') {
        nodes.push(documentSchema.nodes.code_block.create(null, documentSchema.text(item.content || '')));
      } else if (item.type === 'blockquote') {
        nodes.push(documentSchema.nodes.blockquote.create(
          null,
          documentSchema.nodes.paragraph.create(null, documentSchema.text(item.content || ''))
        ));
      } else if (item.type === 'ai_suggestion') {
        nodes.push(documentSchema.nodes.ai_suggestion.create(
          { originalText: item.originalText || '' },
          documentSchema.text(item.content || '')
        ));
      }
    });
    
    if (nodes.length === 0) {
      nodes.push(documentSchema.nodes.paragraph.create());
    }
    
    return documentSchema.nodes.doc.create(null, nodes);
  } catch {
    return documentSchema.nodes.doc.create(null, documentSchema.nodes.paragraph.create());
  }
}