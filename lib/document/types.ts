export interface DocumentNode {
  type: string;
  content?: DocumentNode[] | string;
  attrs?: Record<string, any>;
  marks?: DocumentMark[];
}

export interface DocumentMark {
  type: string;
  attrs?: Record<string, any>;
}

export interface Document {
  id: string;
  title: string;
  content: DocumentNode;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    wordCount?: number;
    characterCount?: number;
    readingTime?: number;
  };
}

export interface DocumentBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'blockquote' | 'codeBlock' | 'bulletList' | 'orderedList' | 'listItem' | 'horizontalRule';
  content?: string | DocumentBlock[];
  attrs?: {
    level?: number;
    language?: string;
    [key: string]: any;
  };
}

export class DocumentModel {
  private document: Document;

  constructor(document?: Partial<Document>) {
    this.document = {
      id: document?.id || this.generateId(),
      title: document?.title || 'Untitled',
      content: document?.content || { type: 'doc', content: [] },
      createdAt: document?.createdAt || new Date(),
      updatedAt: document?.updatedAt || new Date(),
      metadata: document?.metadata || {}
    };
  }

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getDocument(): Document {
    return this.document;
  }

  updateContent(content: DocumentNode): void {
    this.document.content = content;
    this.document.updatedAt = new Date();
    this.updateMetadata();
  }

  updateTitle(title: string): void {
    this.document.title = title;
    this.document.updatedAt = new Date();
  }

  private updateMetadata(): void {
    const text = this.extractText(this.document.content);
    this.document.metadata = {
      wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
      characterCount: text.length,
      readingTime: Math.ceil(text.split(/\s+/).length / 200) // Average reading speed
    };
  }

  private extractText(node: DocumentNode): string {
    if (typeof node.content === 'string') {
      return node.content;
    }
    if (Array.isArray(node.content)) {
      return node.content.map(child => this.extractText(child)).join(' ');
    }
    return '';
  }

  toJSON(): string {
    return JSON.stringify(this.document);
  }

  static fromJSON(json: string): DocumentModel {
    const data = JSON.parse(json);
    return new DocumentModel({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    });
  }
}