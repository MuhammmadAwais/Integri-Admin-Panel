import { useState } from 'react';
import { db, storage } from 'lib/firebase/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';

// ══════════════════════════════════════════════════════════════════════════════
//  useNewsPublisher Hook
//  Serialises the editor state into the exact Flutter/Firestore News schema and
//  persists it. Field-by-field mapping:
//
//  Editor state         → Firestore field
//  ─────────────────────────────────────────────────────────────────────────
//  headline (string)    → headline: { en: headline }
//  topic (string)       → topic
//  tags (string[])      → tags
//  forCountries[]       → forCountries
//  specificLocal[]      → specificLocal (language codes, e.g. ["ar"])
//  markAsTrending bool  → markAsTrending
//  addToGeneralTopic    → addToGeneralTopic
//  dateText 'yyyy-MM-dd'→ dateText
//  timeText 'HH:mm'     → timeText  +  date (Timestamp from dateText+timeText)
//  coverImage URL       → coverImage
//  video URL            → video
//  thumbnailOfVideo URL → thumbnailOfVideo
//  status string        → status  ("Approved" | "Pending")
//  newsSource obj       → newsSource: { url, companyName, company:{ar:name},
//                                       companyDescription, description:{ar:desc}, image }
//  blocks[]             → content[]: { type, value:{en:text|url}, videoThumbnail, caption:{en:cap} }
// ══════════════════════════════════════════════════════════════════════════════
export function useNewsPublisher() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // ── File upload to Firebase Storage ────────────────────────────────────────
  /**
   * Uploads a File to Firebase Storage and returns its download URL.
   * Mirror of Flutter's uploadImageToFirebase("News", bytes).
   *
   * @param {File} file
   * @param {string} folder  — storage folder, e.g. "News" or "NewsContent"
   * @returns {Promise<string>} download URL
   */
  const uploadFile = (file, folder = 'News') => {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop();
      const uniqueName = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
      const storageRef = ref(storage, uniqueName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      setIsUploading(true);
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        },
        (error) => {
          console.error('[useNewsPublisher] Upload failed:', error);
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

  // ── Serialise a content block to the Firestore format ──────────────────────
  /**
   * Converts a local editor block  →  Firestore ContentBlock sub-object.
   *
   * Local block shape:
   *   { type: 'description'|'image'|'video', value: string,
   *     caption: string, videoThumbnail: string,
   *     _file?: File, _thumbFile?: File }
   *
   * Firestore shape:
   *   { type, value: {en: string}, caption: {en: string}, videoThumbnail: string }
   */
  const serializeBlock = async (block) => {
    let value = block.value || '';
    let videoThumbnail = block.videoThumbnail || '';

    // Upload new image/video file if present
    if (block.type !== 'description' && block._file instanceof File) {
      value = await uploadFile(block._file, 'NewsContent');
    }

    // Upload new video thumbnail if present
    if (block.type === 'video' && block._thumbFile instanceof File) {
      videoThumbnail = await uploadFile(block._thumbFile, 'NewsContent');
    }

    return {
      type: block.type,
      value: { en: value },                         // multilingual map — we write 'en'
      caption: { en: block.caption || '' },          // always present as map
      videoThumbnail,
    };
  };

  // ── Main publish / update function ─────────────────────────────────────────
  /**
   * Persists news data to Firestore using the Flutter schema.
   *
   * @param {Object} editorData  — the full editor state (see EditorState below)
   * @param {string|null} id     — Firestore document ID for updates, null for creates
   * @returns {Promise<string>}  — document ID
   *
   * EditorState shape expected by this function:
   * {
   *   headline: string,
   *   topic: string,
   *   tags: string[],
   *   forCountries: string[],
   *   specificLocal: string[],       // language codes e.g. ["ar", "fr"]
   *   markAsTrending: boolean,
   *   addToGeneralTopic: boolean,
   *   dateText: string,              // "yyyy-MM-dd"
   *   timeText: string,              // "HH:mm"
   *   status: string,                // "Approved" | "Pending"
   *   coverImage: string,            // existing URL (empty string = none)
   *   coverImageFile?: File,         // new file to upload
   *   video: string,
   *   videoFile?: File,
   *   thumbnailOfVideo: string,
   *   thumbnailFile?: File,
   *   newsSource: {
   *     url: string,
   *     companyName: string,
   *     companyDescription: string,
   *     image: string,               // logo URL
   *     imageFile?: File,            // new logo file
   *   },
   *   blocks: Array<{
   *     id: string,                  // local only, not persisted
   *     type: 'description'|'image'|'video',
   *     value: string,
   *     caption: string,
   *     videoThumbnail: string,
   *     _file?: File,
   *     _thumbFile?: File,
   *   }>
   * }
   */
  const publishNews = async (editorData, id = null) => {
    setIsUploading(true);
    try {
      // ── 1. Upload cover image if a new file was selected ─────────────────
      let coverImage = editorData.coverImage || '';
      if (editorData.coverImageFile instanceof File) {
        coverImage = await uploadFile(editorData.coverImageFile, 'News');
      }

      // ── 2. Upload hero video ──────────────────────────────────────────────
      let video = editorData.video || '';
      if (editorData.videoFile instanceof File) {
        video = await uploadFile(editorData.videoFile, 'News');
      }

      // ── 3. Upload video thumbnail ─────────────────────────────────────────
      let thumbnailOfVideo = editorData.thumbnailOfVideo || '';
      if (editorData.thumbnailFile instanceof File) {
        thumbnailOfVideo = await uploadFile(editorData.thumbnailFile, 'News');
      }

      // ── 4. Upload newsSource logo ─────────────────────────────────────────
      let sourceImage = editorData.newsSource?.image || '';
      if (editorData.newsSource?.imageFile instanceof File) {
        sourceImage = await uploadFile(editorData.newsSource.imageFile, 'News');
      }

      // ── 5. Serialize content blocks ───────────────────────────────────────
      const content = await Promise.all(
        (editorData.blocks || []).map(serializeBlock)
      );

      // ── 6. Build the Firestore date Timestamp ─────────────────────────────
      let dateTimestamp = Timestamp.now();
      if (editorData.dateText && editorData.timeText) {
        try {
          const parsed = new Date(`${editorData.dateText}T${editorData.timeText}:00`);
          if (!isNaN(parsed)) {
            dateTimestamp = Timestamp.fromDate(parsed);
          }
        } catch (_) {
          // fallback: use now
        }
      } else if (editorData.dateText) {
        try {
          const parsed = new Date(editorData.dateText);
          if (!isNaN(parsed)) dateTimestamp = Timestamp.fromDate(parsed);
        } catch (_) {}
      }

      // ── 7. Build newsSource sub-object ────────────────────────────────────
      const ns = editorData.newsSource || {};
      const newsSource = {
        url: ns.url || '',
        companyName: ns.companyName || '',
        company: { ar: ns.companyName || '' },            // Arabic fallback = same value
        companyDescription: ns.companyDescription || '',
        description: { ar: ns.companyDescription || '' }, // Arabic fallback = same value
        image: sourceImage,
      };

      // ── 8. Build final Firestore document ─────────────────────────────────
      const firestoreData = {
        headline: { en: editorData.headline || '' },
        topic: editorData.topic || 'General',
        tags: editorData.tags || [],
        forCountries: editorData.forCountries || [],
        specificLocal: editorData.specificLocal || [],
        markAsTrending: Boolean(editorData.markAsTrending),
        addToGeneralTopic: Boolean(editorData.addToGeneralTopic ?? true),
        date: dateTimestamp,
        dateText: editorData.dateText || '',
        timeText: editorData.timeText || '',
        status: editorData.status || 'Pending',
        coverImage,
        video,
        thumbnailOfVideo,
        content,
        newsSource,
        updatedAt: serverTimestamp(),
      };

      // ── 9. Create or Update ───────────────────────────────────────────────
      if (id) {
        const newsRef = doc(db, 'News', id);
        await updateDoc(newsRef, firestoreData);
        return id;
      } else {
        const docRef = await addDoc(collection(db, 'News'), {
          ...firestoreData,
          createdAt: serverTimestamp(),
          views: 0,
        });
        return docRef.id;
      }
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return {
    uploadFile,
    publishNews,
    serializeBlock,
    progress,
    isUploading,
  };
}
