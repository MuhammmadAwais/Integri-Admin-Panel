import { useState, useCallback, useEffect, useMemo } from 'react';
import { collection, query, limit, startAfter, getDocs, where, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';

/**
 * High-Performance User Identity Structure
 */
export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  country: string;
  tokens: number;
  freeDays: number;
  createdAt: string;
  status: 'active' | 'inactive' | string;
}

export interface UseUsersReturn {
  users: User[];
  filteredUsers: User[];
  loading: boolean;
  error: string | null;
  globalFilter: string;
  setGlobalFilter: (val: string) => void;
  countryFilter: string;
  setCountryFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  refreshUsers: () => void;
  clearFilters: () => void;
  fetchNextBatch: () => void;
  hasMore: boolean;
}

/**
 * useUsers Hook - High Performance Version
 * Built by Senior Firebase Architect.
 * Implements cursor-based pagination and server-side search.
 */
export default function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | 'dual-search-cursor' | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const fetchUsers = useCallback(async (isLoadMore: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      let fetchedDocs: QueryDocumentSnapshot<DocumentData>[] = [];
      
      if (globalFilter.trim()) {
        const search = globalFilter.trim();
        const searchLower = search.toLowerCase();
        
        // Execute parallel queries to unconditionally support BOTH name and email prefix matching
        const qName = query(collection(db, 'Users'), where('name', '>=', search), where('name', '<=', search + '\uf8ff'), limit(100));
        const qEmailLower = query(collection(db, 'Users'), where('email', '>=', searchLower), where('email', '<=', searchLower + '\uf8ff'), limit(100));
        const qEmailExact = query(collection(db, 'Users'), where('email', '>=', search), where('email', '<=', search + '\uf8ff'), limit(100));
        
        const [snapName, snapEmailLower, snapEmailExact] = await Promise.all([getDocs(qName), getDocs(qEmailLower), getDocs(qEmailExact)]);
        
        // Merge results using Map to safely eliminate duplicate documents
        const docMap = new Map<string, QueryDocumentSnapshot<DocumentData>>();
        snapName.docs.forEach(d => docMap.set(d.id, d));
        snapEmailLower.docs.forEach(d => docMap.set(d.id, d));
        snapEmailExact.docs.forEach(d => docMap.set(d.id, d));
        
        fetchedDocs = Array.from(docMap.values());
        
        setLastVisible('dual-search-cursor');
        setHasMore(false);
      } else {
        const constraints: any[] = [];
        if (countryFilter) constraints.push(where('country', '==', countryFilter));
        if (statusFilter) constraints.push(where('status', '==', statusFilter));
        
        if (isLoadMore && lastVisible && lastVisible !== 'dual-search-cursor') {
          constraints.push(startAfter(lastVisible));
        }
        constraints.push(limit(100));
        
        const q = query(collection(db, 'Users'), ...constraints);
        const snapshot = await getDocs(q);
        fetchedDocs = snapshot.docs;
        
        setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMore(snapshot.docs.length === 100);
      }
      
      const fetchedUsers: User[] = fetchedDocs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Guest',
          email: data.email || 'No email',
          avatar: data.avatar || data.profileImage || data.profile_image || data.photoURL || null,
          country: data.country || 'Unknown',
          tokens: data.tokens || 0,
          freeDays: data.freeDays || 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          status: data.status || 'inactive'
        };
      });

      if (isLoadMore && !globalFilter.trim()) {
         setUsers(prev => [...prev, ...fetchedUsers]);
      } else {
         setUsers(fetchedUsers);
      }
      
      console.log(`Firebase Action: Fetched ${fetchedUsers.length} users via Smart Engine.`);
    } catch (err: any) {
      if (err.message && err.message.includes('FAILED_PRECONDITION')) {
         console.error("❌ [API] Firebase Index required for this search query.");
         console.error(err.message);
      } else {
         console.error("Firestore [Users] Fetch Error:", err);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [globalFilter, countryFilter, statusFilter, lastVisible]);

  // Client-Side Semantic Filter
  const filteredUsers = useMemo(() => {
    let result = users;

    if (globalFilter.trim()) {
      const q = globalFilter.toLowerCase().trim();
      result = result.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q) || 
        u.country.toLowerCase().includes(q) ||
        u.tokens.toString().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    }

    if (countryFilter) {
      result = result.filter(u => u.country === countryFilter || (u.country === 'Unknown' && countryFilter === 'Unknown'));
    }

    if (statusFilter) {
      result = result.filter(u => u.status === statusFilter);
    }

    return result;
  }, [users, globalFilter, countryFilter, statusFilter]);

  useEffect(() => {
    setLastVisible(null);
    setHasMore(true);
    setUsers([]);
    fetchUsers(false);
  }, [globalFilter, countryFilter, statusFilter]);

  useEffect(() => {
    if (users.length === 0 && lastVisible === null && !globalFilter && !countryFilter && !statusFilter) {
      fetchUsers(false);
    }
  }, []);

  const fetchNextBatch = () => {
    if (hasMore && !loading) {
      fetchUsers(true);
    }
  };

  const refreshUsers = () => {
    setLastVisible(null);
  };

  const clearFilters = () => {
    setGlobalFilter('');
    setCountryFilter('');
    setStatusFilter('');
    setLastVisible(null);
  };

  return {
    users,
    filteredUsers,
    loading,
    error,
    globalFilter,
    setGlobalFilter,
    countryFilter,
    setCountryFilter,
    statusFilter,
    setStatusFilter,
    refreshUsers,
    clearFilters,
    fetchNextBatch,
    hasMore
  };
}
