export const BLOG_CATEGORIES = [
  'General',
  'Trending',
  'AI & Deep Learning',
  'Web Development',
  'Software Architecture',
  'Tutorials',
  'Tech Insights'
] as const;

export type BlogCategory = typeof BLOG_CATEGORIES[number];

export type BlockType = 'heading' | 'paragraph' | 'list' | 'image';

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  value: string;
  level: 2 | 3 | 4; // Sub-headings inside blog posts
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  value: string;
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  items: string[];
  listStyle: 'ordered' | 'bullet';
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  value: string; // The URL to the image asset
  caption?: string;
}

export type BlogBlock = HeadingBlock | ParagraphBlock | ListBlock | ImageBlock;

export interface BlogPost {
  id: string;
  headline: string;
  category: BlogCategory;
  coverImage?: string;
  views: number;
  createdAt: any; // Firestore Timestamp
  blocks: BlogBlock[];
  status: 'draft' | 'published';
}
