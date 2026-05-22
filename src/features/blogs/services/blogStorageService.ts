import { storage } from 'lib/firebase/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads an image asset to the Firebase Storage bucket under the 'blogs/' folder.
 * Returns the download URL of the uploaded image.
 * 
 * @param file The image file to be uploaded.
 * @returns Promise<string> The download URL.
 */
export async function uploadBlogAsset(file: File): Promise<string> {
  // Replace non-alphanumeric characters in the filename to ensure clean storage path
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const uniqueName = `blogs/${Date.now()}_${sanitizedName}`;
  
  const storageRef = ref(storage, uniqueName);
  
  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error) {
    console.error('Failed to upload blog asset to Firebase Storage:', error);
    throw error;
  }
}
