import { useState, useCallback, useEffect } from 'react';
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
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchUsers = useCallback(async (isLoadMore = false) => {
    try {
      setLoading(true);
      setError(null);
      let constraints = [];
      
      if (globalFilter.trim()) {
        const search = globalFilter.trim();
        // Server-side search logic. (Requires composite index)
        constraints.push(where('name', '>=', search));
        constraints.push(where('name', '<=', search + '\uf8ff'));
        constraints.push(orderBy('name', 'asc')); // Firestore requires orderBy on the filtered field
      }

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
          avatar: data.avatar || data.profileImage || null, // Synchronizing multi-source asset fields
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

  useEffect(() => {
    // Treat as mount / filter change effect. Reset state for new searches.
    setLastVisible(null);
    setHasMore(true);
    setUsers([]);
    // We intentionally ignore lastVisible in deps to avoid loop. 
    // Effect runs when globalFilter changes.
  }, [globalFilter]);

  // Actually invoke fetch when the page resets or changes
  useEffect(() => {
    // Only load from scratch when lastVisible is null (meaning array empty / reset)
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

  return {
    users,
    filteredUsers: users, // For backward compatibility with the prop drills
    loading,
    error,
    globalFilter,
    setGlobalFilter,
    refreshUsers,
    fetchNextBatch,
    hasMore
  };
}
