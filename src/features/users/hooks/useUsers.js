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
      let constraints = [];
      
      if (globalFilter.trim()) {
        const search = globalFilter.trim();
        // Smart Redirect: If search looks like email, query email field. Otherwise name.
        const searchField = search.includes('@') ? 'email' : 'name';
        
        constraints.push(where(searchField, '>=', search));
        constraints.push(where(searchField, '<=', search + '\uf8ff'));
        constraints.push(orderBy(searchField, 'asc'));
      }

      // HYBRID FIX: Removed country and status from server constraints to avoid compound index 'FAILED_PRECONDITION' exceptions.
      // These will be resolved instantly on the client via the intelligence engine.

      if (isLoadMore && lastVisible) {
        constraints.push(startAfter(lastVisible));
      }

      constraints.push(limit(100));

      const q = query(collection(db, 'Users'), ...constraints);
      const snapshot = await getDocs(q);
      
      const fetchedUsers = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Guest',
          email: data.email || 'No email',
          avatar: data.avatar || data.profileImage || data.profile_image || data.photoURL || null, // Final forensic asset synchronization
          country: data.country || 'Unknown',
          tokens: data.tokens || 0,
          freeDays: data.freeDays || 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          status: data.status || 'inactive'
        };
      });

      if (isLoadMore) {
         setUsers(prev => [...prev, ...fetchedUsers]);
      } else {
         setUsers(fetchedUsers);
      }
      
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 100);
      
      console.log(`Firebase Action: Fetched ${fetchedUsers.length} users via Server Query.`);
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
  }, [globalFilter, lastVisible]);

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

  useEffect(() => {
    // Reset state for new semantic searches
    setLastVisible(null);
    setHasMore(true);
    setUsers([]);
  }, [globalFilter]);

  // Initial load and reset trigger
  useEffect(() => {
    if (lastVisible === null) {
      fetchUsers(false);
    }
  }, [lastVisible, fetchUsers]);

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
