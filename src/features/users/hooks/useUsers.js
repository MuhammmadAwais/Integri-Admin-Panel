import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';

export default function useUsers() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countryFilter, setCountryFilter] = useState('');

  const subscribe = useCallback(() => {
    setLoading(true);
    setError(null);

    // Assuming the collection name is 'users' based on standard conventions,
    // as per the user's implicit approval to proceed.
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedUsers = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Unknown',
            email: data.email || 'No Email',
            avatar: data.avatar || null, // null will trigger initials fallback
            country: data.country || 'Unknown',
            tokens: data.tokens || 0,
            free_days: data.free_days || 0,
            createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
            status: data.status || 'inactive' // assuming a status field for active/inactive
          };
        });

        setUsers(fetchedUsers);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching users:", error);
        setError(error.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe();
    return () => unsubscribe && unsubscribe();
  }, [subscribe]);

  useEffect(() => {
    if (countryFilter) {
      setFilteredUsers(users.filter((user) => user.country === countryFilter));
    } else {
      setFilteredUsers(users);
    }
  }, [users, countryFilter]);

  return {
    users,
    filteredUsers,
    loading,
    error,
    countryFilter,
    setCountryFilter,
    refresh: subscribe // To manually re-trigger if needed, though onSnapshot is realtime
  };
}
