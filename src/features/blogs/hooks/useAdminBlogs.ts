import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from 'lib/firebase/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  deleteDoc,
  addDoc,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { BlogPost, BlogCategory } from '../types';

export interface UseAdminBlogsReturn {
  blogs: BlogPost[];
  filteredBlogs: BlogPost[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  selectedCategory: BlogCategory | 'All';
  setSelectedCategory: (cat: BlogCategory | 'All') => void;
  dateRange: 'all' | '7days' | '30days';
  setDateRange: (range: 'all' | '7days' | '30days') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
  deleteBlog: (id: string) => Promise<void>;
  seedSampleBlogs: () => Promise<void>;
  seeding: boolean;
}

const PAGE_SIZE = 15;

export function useAdminBlogs(): UseAdminBlogsReturn {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | 'All'>('All');
  const [dateRange, setDateRange] = useState<'all' | '7days' | '30days'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination Cursor
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Fetch blogs page-by-page
  const fetchBlogs = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
      lastDocRef.current = null;
    }

    try {
      const blogsRef = collection(db, 'Blogs');
      const queryConstraints: any[] = [];

      // 1. Category filter
      if (selectedCategory !== 'All') {
        queryConstraints.push(where('category', '==', selectedCategory));
      }

      // 2. Date range filter
      if (dateRange !== 'all') {
        const now = new Date();
        const days = dateRange === '7days' ? 7 : 30;
        const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        queryConstraints.push(where('createdAt', '>=', Timestamp.fromDate(cutoffDate)));
      }

      // 3. Order constraints (must align with fields filtered by range/inequality)
      queryConstraints.push(orderBy('createdAt', 'desc'));

      // 4. Cursor Pagination constraints
      if (isLoadMore && lastDocRef.current) {
        queryConstraints.push(startAfter(lastDocRef.current));
      }

      // 5. Limit constraint
      queryConstraints.push(limit(PAGE_SIZE));

      const q = query(blogsRef, ...queryConstraints);
      const snapshot = await getDocs(q);

      const parsedBlogs: BlogPost[] = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Parse date safely
        let dateStr = '';
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            dateStr = data.createdAt.toDate().toISOString();
          } else if (data.createdAt instanceof Date) {
            dateStr = data.createdAt.toISOString();
          } else if (data.createdAt.seconds) {
            dateStr = new Date(data.createdAt.seconds * 1000).toISOString();
          } else {
            dateStr = String(data.createdAt);
          }
        }

        return {
          id: doc.id,
          headline: data.headline || '',
          category: data.category || 'General',
          coverImage: data.coverImage || '',
          views: data.views || 0,
          createdAt: dateStr,
          blocks: data.blocks || [],
          status: data.status || 'draft'
        } as BlogPost;
      });

      if (isLoadMore) {
        setBlogs(prev => [...prev, ...parsedBlogs]);
      } else {
        setBlogs(parsedBlogs);
      }

      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      setError(null);
    } catch (err: any) {
      console.error('[useAdminBlogs] Error fetching blogs:', err);
      
      // Specially catch Firestore composite index requirement error and log the direct build URL
      if (err.message && err.message.includes('FAILED_PRECONDITION')) {
        console.error(
          'CRITICAL: Firestore index required! Click the URL below to auto-generate this Composite Index:\n',
          err.message
        );
        setError('Firestore index required. Please contact administrator or check the developer console for the index creation link.');
      } else {
        setError(err.message || 'Failed to fetch blogs');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCategory, dateRange]);

  // Initial load or refetch on filters change
  useEffect(() => {
    fetchBlogs(false);
  }, [fetchBlogs]);

  // Load More handler
  const loadMore = useCallback(async () => {
    if (!loading && !loadingMore && hasMore) {
      await fetchBlogs(true);
    }
  }, [loading, loadingMore, hasMore, fetchBlogs]);

  // Manual refresh / refetch
  const refetch = useCallback(async () => {
    await fetchBlogs(false);
  }, [fetchBlogs]);

  // Delete document
  const deleteBlog = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'Blogs', id));
      setBlogs(prev => prev.filter(b => b.id !== id));
    } catch (err: any) {
      console.error(`[useAdminBlogs] Failed to delete blog with ID: ${id}`, err);
      throw err;
    }
  }, []);

  // Seed sample blogs into Firestore
  const seedSampleBlogs = useCallback(async () => {
    setSeeding(true);
    setError(null);
    try {
      const blogsRef = collection(db, 'Blogs');
      
      const sampleBlogs = [
        {
          headline: "The Rise of Agentic AI: Beyond Simple Large Language Models",
          category: "AI & Deep Learning",
          coverImage: "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80",
          views: 1420,
          createdAt: Timestamp.now(),
          status: "published",
          blocks: [
            {
              id: "b1",
              type: "paragraph",
              value: "Over the past year, the industry has rapidly shifted from passive conversational AI systems to highly active agentic workflows. Instead of merely answering prompts in a single turn, modern agentic frameworks are designed to plan, retrieve information, run tool-based commands, reflect on mistakes, and self-correct entirely in the background."
            },
            {
              id: "b2",
              type: "heading",
              level: 2,
              value: "Key Pillars of Agentic Architectures"
            },
            {
              id: "b3",
              type: "list",
              listStyle: "bullet",
              items: [
                "Autonomous Multi-step Planning: Decomposing a complex user goal into sequential actionable phases.",
                "Deep Tool Integration: Granting agents read/write capabilities on filesystems, browsers, APIs, and terminals.",
                "Robust Reflection Loops: Prompting the model to criticize its own draft, catch syntax errors, and fix them prior to final submission."
              ]
            },
            {
              id: "b4",
              type: "heading",
              level: 3,
              value: "The Performance Bottleneck"
            },
            {
              id: "b5",
              type: "paragraph",
              value: "Because agentic loops involve multiple model calls and recursive verification steps, executing them with zero-lag interfaces is crucial. Frontends must memoize layout layers and virtualize high-frequency tabular lists to stay incredibly responsive while backend threads compute deep reasoning chains."
            }
          ]
        },
        {
          headline: "Next-Gen Web Architecture: Server Components and Edge Rendering",
          category: "Web Development",
          coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
          views: 980,
          createdAt: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)), // 2 days ago
          status: "published",
          blocks: [
            {
              id: "w1",
              type: "paragraph",
              value: "Modern web standards are redefining how we build, deploy, and scale highly performant applications. By blending server-side pre-processing with global edge execution, we can bypass large client-side bundles and achieve sub-100ms time-to-interactive metrics."
            },
            {
              id: "w2",
              type: "heading",
              level: 2,
              value: "Hybrid Rendering Paradigms"
            },
            {
              id: "w3",
              type: "list",
              listStyle: "ordered",
              items: [
                "Zero Client-Side JS overhead: Standard pages load instantly by default, executing static parts on the server.",
                "Edge-Side Fragment Caching: Caching fully dynamic components close to the user at edge nodes globally.",
                "Client-Side Hydration: Selectively loading active interactivity only where needed on components like filters or tables."
              ]
            },
            {
              id: "w4",
              type: "paragraph",
              value: "This architectural shift removes heavy JavaScript processing cycles from the client's browser, preventing frame dropouts and stuttering even on low-powered mobile devices."
            }
          ]
        },
        {
          headline: "Designing Fault-Tolerant Distributed Architectures",
          category: "Software Architecture",
          coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
          views: 2450,
          createdAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)), // 5 days ago
          status: "published",
          blocks: [
            {
              id: "s1",
              type: "paragraph",
              value: "Building resilient distributed systems at scale requires designing for inevitable failure. Under peak traffic loads, external databases, cloud services, and microservice communication will experience packet loss, timeouts, and intermittent outages."
            },
            {
              id: "s2",
              type: "heading",
              level: 2,
              value: "Essential Patterns for Resilient Services"
            },
            {
              id: "s3",
              type: "list",
              listStyle: "bullet",
              items: [
                "Circuit-Breaker Safety: Fast-failing downstream requests if a service begins to stutter, protecting system pools.",
                "Exponential Backoff Retries: Preventing self-inflicted Denial of Service (DoS) attacks on recovering dependencies.",
                "Graceful State Degradation: Serving read-only fallback cache states if the primary write-optimized databases go offline."
              ]
            },
            {
              id: "s4",
              type: "paragraph",
              value: "By systematically embedding these safety boundaries into the state pipeline, architectures can easily maintain 99.99% availability benchmarks even during severe regional network disturbances."
            }
          ]
        }
      ];

      for (const blog of sampleBlogs) {
        await addDoc(blogsRef, blog);
      }
      
      // Force reload the list to show newly seeded documents
      await fetchBlogs(false);
    } catch (err: any) {
      console.error('[useAdminBlogs] Seeding failed:', err);
      setError(err.message || 'Failed to seed sample blogs.');
      throw err;
    } finally {
      setSeeding(false);
    }
  }, [fetchBlogs]);

  // Debounced/Client-side searching over loaded items
  const filteredBlogs = blogs.filter(blog => {
    const headlineMatch = blog.headline.toLowerCase().includes(searchQuery.toLowerCase());
    return headlineMatch;
  });

  return {
    blogs,
    filteredBlogs,
    loading,
    loadingMore,
    hasMore,
    error,
    selectedCategory,
    setSelectedCategory,
    dateRange,
    setDateRange,
    searchQuery,
    setSearchQuery,
    loadMore,
    refetch,
    deleteBlog,
    seedSampleBlogs,
    seeding
  };
}
