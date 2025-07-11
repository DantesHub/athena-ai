import { Schema, Node as ProseMirrorNode } from 'prosemirror-model';
import { InputRule } from 'prosemirror-inputrules';
import { EditorView } from 'prosemirror-view';
import { Transaction } from 'prosemirror-state';

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