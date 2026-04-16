import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';

/**
 * useNews Hook
 * Real-time listener for the /News collection with management capabilities.
 */
export function useNews() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'News'), orderBy('releaseDate', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNews(newsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Permanently delete a news document
   */
  const deleteNews = async (id) => {
    try {
      await deleteDoc(doc(db, 'News', id));
    } catch (error) {
      console.error("Error deleting news:", error);
      throw error;
    }
  };

  /**
   * Update the status of a news item (Draft, Published, etc.)
   */
  const updateStatus = async (id, newStatus) => {
    try {
      const newsRef = doc(db, 'News', id);
      await updateDoc(newsRef, { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
      throw error;
    }
  };

  // Local filtering based on headline, topic, tags, or description
  const filteredNews = news.filter((item) => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      item.heading?.toLowerCase().includes(search) ||
      item.topic?.toLowerCase().includes(search) ||
      item.tags?.some(tag => tag.toLowerCase().includes(search)) ||
      item.description?.toLowerCase().includes(search) ||
      item.countries?.some(c => c.toLowerCase().includes(search))
    );
  });

  return {
    allNews: news,
    news: filteredNews,
    loading,
    setSearchTerm,
    searchTerm,
    deleteNews,
    updateStatus
  };
}
