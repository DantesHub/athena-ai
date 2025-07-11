import { Schema, Node as ProseMirrorNode } from 'prosemirror-model';
import { InputRule } from 'prosemirror-inputrules';
import { EditorView } from 'prosemirror-view';
import { Transaction, Plugin } from 'prosemirror-state';
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

export function buildListKeymap(): Plugin {
  return keymap({
    'Enter': splitListItem(documentSchema.nodes.list_item),
    'Shift-Tab': liftListItem(documentSchema.nodes.list_item),
    'Tab': sinkListItem(documentSchema.nodes.list_item),
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