import { useState } from 'react';
import { db, storage } from 'lib/firebase/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

/**
 * useNewsPublisher Hook
 * Handles the media pipeline and document persistence for the News Editor.
 */
export function useNewsPublisher() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Uploads a file to Firebase Storage with progress tracking.
   * @param {File} file - The file to upload.
   * @param {string} path - The storage path (e.g., 'news/covers/filename').
   * @returns {Promise<string>} - The public download URL.
   */
  const uploadFile = (file, path) => {
    return new Promise((resolve, reject) => {
      const fileExtension = file.name.split('.').pop();
      const uniquePath = `${path}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, uniquePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      setIsUploading(true);
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        },
        (error) => {
          console.error("Upload failed:", error);
          setIsUploading(false);
          reject(error);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setIsUploading(false);
            setProgress(0);
            resolve(url);
          } catch (err) {
            setIsUploading(false);
            reject(err);
          }
        }
      );
    });
  };

  /**
   * Persists news data to Firestore.
   * @param {Object} newsData - The complete news record.
   * @param {string} [id] - Existing ID for update mode.
   * @returns {Promise<string>} - The document ID.
   */
  const publishNews = async (newsData, id = null) => {
    try {
      const data = {
        ...newsData,
        updatedAt: serverTimestamp(),
        // Ensure arrays are present even if empty
        tags: newsData.tags || [],
        countries: newsData.countries || [],
        blocks: newsData.blocks || []
      };

      if (id) {
        const newsRef = doc(db, 'News', id);
        await updateDoc(newsRef, data);
        return id;
      } else {
        const docRef = await addDoc(collection(db, 'News'), {
          ...data,
          createdAt: serverTimestamp(),
          views: 0 // Initialize views for new news
        });
        return docRef.id;
      }
    } catch (error) {
      console.error("Failed to publish news:", error);
      throw error;
    }
  };

  return { 
    uploadFile, 
    publishNews, 
    progress, 
    isUploading 
  };
}
