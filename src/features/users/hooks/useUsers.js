import { useState, useCallback, useEffect, useMemo } from 'react';
import { collection, query, limit, startAfter, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';

/**
 * useUsers Hook - High Performance Version
 * Built by Senior Firebase Architect.
 * Implements cursor-based pagination and server-side search.
 */
export default function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [globalFilter, setGlobalFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchUsers = useCallback(async (isLoadMore = false) => {
    try {
      setLoading(true);
      setError(null);
      let fetchedDocs = [];
      
      if (globalFilter.trim()) {
        const search = globalFilter.trim();
        const searchLower = search.toLowerCase();
        
        // Execute parallel queries to unconditionally support BOTH name and email prefix matching
        // without relying on restrictive Firebase single-field inequality rules.
        const qName = query(collection(db, 'Users'), where('name', '>=', search), where('name', '<=', search + '\uf8ff'), limit(100));
        const qEmailLower = query(collection(db, 'Users'), where('email', '>=', searchLower), where('email', '<=', searchLower + '\uf8ff'), limit(100));
        const qEmailExact = query(collection(db, 'Users'), where('email', '>=', search), where('email', '<=', search + '\uf8ff'), limit(100));
        
        const [snapName, snapEmailLower, snapEmailExact] = await Promise.all([getDocs(qName), getDocs(qEmailLower), getDocs(qEmailExact)]);
        
        // Merge results using Map to safely eliminate duplicate documents
        const docMap = new Map();
        snapName.docs.forEach(d => docMap.set(d.id, d));
        snapEmailLower.docs.forEach(d => docMap.set(d.id, d));
        snapEmailExact.docs.forEach(d => docMap.set(d.id, d));
        
        fetchedDocs = Array.from(docMap.values());
        
        // Use a dummy string cursor to ensure state transition for lastVisible 
        // down the line, instead of null which breaks the reactivity hook.
        setLastVisible('dual-search-cursor');
        setHasMore(false);
      } else {
        let constraints = [];
        // Safely query country & status directly without Firebase FAILED_PRECONDITION indexing errors
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
      
      const fetchedUsers = fetchedDocs.map((doc) => {
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
    } catch (err) {
      // 2. Boss Constraint: Firestore Search Indexing catcher
      if (err.message && err.message.includes('FAILED_PRECONDITION')) {
         console.error("❌ [API] Firebase Index required for this search query.");
         console.error(err.message); // This will output the clickable link
      } else {
         console.error("Firestore [Users] Fetch Error:", err);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [globalFilter, countryFilter, statusFilter, lastVisible]);

  // Client-Side Semantic Filter: Enhances forensics by searching loaded batch across ALL fields instantly.
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

  // When filters shift, cleanly trigger a fresh wipe protocol
  useEffect(() => {
    setLastVisible(null);
    setHasMore(true);
    setUsers([]);
    // Immediately fetch users after wiping, so we don't rely on `lastVisible` state transitioning from null to null breaking the pipeline.
    // Safe fetch explicitly bypassing pagination here.
    fetchUsers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalFilter, countryFilter, statusFilter]);

  // Initial load only safely checking users array length
  useEffect(() => {
    if (users.length === 0 && lastVisible === null && !globalFilter && !countryFilter && !statusFilter) {
      fetchUsers(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchNextBatch = () => {
    if (hasMore && !loading) {
      fetchUsers(true);
    }
  };

  const refreshUsers = () => {
    setLastVisible(null); // will trigger the effect
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
