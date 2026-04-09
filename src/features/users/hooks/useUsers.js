import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';

/**
 * useUsers Hook
 * Built by Senior Firebase Architect for Integri App.
 * Manages real-time user stream with global filtering.
 */
export default function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // centralized filter state
  const [globalFilter, setGlobalFilter] = useState('');

  const subscribeToUsers = useCallback(() => {
    setLoading(true);
    console.log("Firebase Action: Initiating real-time subscription to [/Users] collection...");
    
    // Explicitly targeting '/Users' (Capitalized) and removing orderBy to avoid missing documents lacking index fields
    const q = query(collection(db, 'Users'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedUsers = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Guest',
            email: data.email || 'No email',
            avatar: data.avatar || null,
            country: data.country || 'Unknown',
            tokens: data.tokens || 0,
            freeDays: data.freeDays || 0,
            // Handle Firestore Timestamp precisely
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            status: data.status || 'inactive'
          };
        });

        console.log("Firebase Response: Received [Users] payload. Count:", fetchedUsers.length);
        console.table(fetchedUsers.slice(0, 5)); // log first 5 for clarity

        setUsers(fetchedUsers);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore [Users] Subscription Error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const refreshUsers = () => {
    console.log("Manual Action: Refreshing user intelligence data...");
    subscribeToUsers();
  };

  useEffect(() => {
    const unsub = subscribeToUsers();
    return () => unsub && unsub();
  }, [subscribeToUsers]);

  // Derived state for filtering
  const filteredUsers = useMemo(() => {
    if (!globalFilter) return users;

    const lowerFilter = globalFilter.toLowerCase();
    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(lowerFilter) ||
        user.country.toLowerCase() === lowerFilter ||
        user.email.toLowerCase().includes(lowerFilter)
      );
    });
  }, [users, globalFilter]);

  return {
    users,
    filteredUsers,
    loading,
    error,
    globalFilter,
    setGlobalFilter,
    refreshUsers
  };
}
