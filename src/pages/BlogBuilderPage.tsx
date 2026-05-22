import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from 'lib/firebase/firebase';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { 
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Upload, 
  Image as ImageIcon, Save, List, Type, Heading2, AlignLeft 
} from 'lucide-react';
import { uploadBlogAsset } from 'features/blogs/services/blogStorageService';
import { BlogPost, BlogBlock, BlogCategory, BLOG_CATEGORIES } from 'features/blogs/types';
import { showToast } from 'components/EliteUI/EliteToastContainer';

export default function BlogBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const blogId = searchParams.get('id');

  // ── Core Blog Info State ──────────────────────────────────────────────────
  const [headline, setHeadline] = useState('');
  const [category, setCategory] = useState<BlogCategory>('General');
  const [coverImage, setCoverImage] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [blocks, setBlocks] = useState<BlogBlock[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);

  // ── Fetch existing blog if editing ────────────────────────────────────────
  useEffect(() => {
    if (!blogId) return;

    const fetchBlog = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'Blogs', blogId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setHeadline(data.headline || '');
          setCategory(data.category || 'General');
          setCoverImage(data.coverImage || '');
          setStatus(data.status || 'draft');
          setBlocks(data.blocks || []);
        } else {
          showToast('Blog post not found.', 'error');
          navigate('/blogs');
        }
      } catch (err) {
        console.error('Error fetching blog:', err);
        showToast('Failed to load blog post.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [blogId, navigate]);

  // ── Cover Image Upload Handler ───────────────────────────────────────────
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const downloadUrl = await uploadBlogAsset(file);
      setCoverImage(downloadUrl);
      showToast('Cover image uploaded successfully.', 'success');
    } catch (err) {
      console.error('Failed to upload cover image:', err);
      showToast('Cover image upload failed.', 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  // ── Block Modification Handlers ──────────────────────────────────────────
  const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addBlock = (type: 'heading' | 'paragraph' | 'list' | 'image') => {
    const newBlock: BlogBlock = (() => {
      switch (type) {
        case 'heading':
          return { id: generateId(), type: 'heading', value: '', level: 2 };
        case 'paragraph':
          return { id: generateId(), type: 'paragraph', value: '' };
        case 'list':
          return { id: generateId(), type: 'list', items: [''], listStyle: 'bullet' };
        case 'image':
          return { id: generateId(), type: 'image', value: '', caption: '' };
      }
    })();

    setBlocks(prev => [...prev, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;

    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(index, 1);
    newBlocks.splice(newIndex, 0, removed);
    setBlocks(newBlocks);
  };

  const updateBlockValue = (id: string, val: string) => {
    setBlocks(prev =>
      prev.map(b => (b.id === id ? { ...b, value: val } : b) as BlogBlock)
    );
  };

  const updateHeadingLevel = (id: string, lvl: 2 | 3 | 4) => {
    setBlocks(prev =>
      prev.map(b => (b.id === id && b.type === 'heading' ? { ...b, level: lvl } : b) as BlogBlock)
    );
  };

  const updateListStyle = (id: string, style: 'ordered' | 'bullet') => {
    setBlocks(prev =>
      prev.map(b => (b.id === id && b.type === 'list' ? { ...b, listStyle: style } : b) as BlogBlock)
    );
  };

  const updateListItems = (blockId: string, itemIdx: number, val: string) => {
    setBlocks(prev =>
      prev.map(b => {
        if (b.id === blockId && b.type === 'list') {
          const newItems = [...b.items];
          newItems[itemIdx] = val;
          return { ...b, items: newItems };
        }
        return b;
      })
    );
  };

  const addListItem = (blockId: string) => {
    setBlocks(prev =>
      prev.map(b => {
        if (b.id === blockId && b.type === 'list') {
          return { ...b, items: [...b.items, ''] };
        }
        return b;
      })
    );
  };

  const removeListItem = (blockId: string, itemIdx: number) => {
    setBlocks(prev =>
      prev.map(b => {
        if (b.id === blockId && b.type === 'list') {
          const newItems = b.items.filter((_, idx) => idx !== itemIdx);
          return { ...b, items: newItems.length > 0 ? newItems : [''] };
        }
        return b;
      })
    );
  };

  const updateImageCaption = (id: string, cap: string) => {
    setBlocks(prev =>
      prev.map(b => (b.id === id && b.type === 'image' ? { ...b, caption: cap } : b) as BlogBlock)
    );
  };

  const handleBlockImageUpload = async (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBlockId(blockId);
    try {
      const downloadUrl = await uploadBlogAsset(file);
      updateBlockValue(blockId, downloadUrl);
      showToast('Block image uploaded successfully.', 'success');
    } catch (err) {
      console.error('Block image upload failed:', err);
      showToast('Block image upload failed.', 'error');
    } finally {
      setUploadingBlockId(null);
    }
  };

  // ── Save/Publish to Firestore ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!headline.trim()) {
      showToast('Headline is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const blogData = {
        headline,
        category,
        coverImage,
        status,
        blocks,
        updatedAt: serverTimestamp(),
      };

      if (blogId) {
        // Edit flow
        const docRef = doc(db, 'Blogs', blogId);
        await updateDoc(docRef, blogData);
        showToast('Blog post updated successfully.', 'success');
      } else {
        // Create flow
        await addDoc(collection(db, 'Blogs'), {
          ...blogData,
          views: 0,
          createdAt: serverTimestamp(),
        });
        showToast('Blog post created successfully.', 'success');
      }
      navigate('/blogs');
    } catch (err) {
      console.error('Failed to save blog post:', err);
      showToast('Failed to save blog post. Check console.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div 
        style={{ 
          height: '60vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'var(--news-text-dim)' 
        }}
      >
        <span style={{ fontSize: '1rem', fontWeight: 600 }}>Loading post data...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto', color: 'var(--news-text-main)' }}>
      {/* SCOPED CUSTOM WORKSPACE CSS */}
      <style>{`
        .builder-container input, .builder-container textarea, .builder-container select {
          background: #000;
          border: 1px solid var(--news-card-border);
          color: var(--news-text-main);
          border-radius: 3px;
          outline: none;
          transition: border-color 0.2s ease;
          width: 100%;
        }
        .builder-container input:focus, .builder-container textarea:focus, .builder-container select:focus {
          border-color: #D4AF37;
        }
        .flat-btn-primary {
          background: #D4AF37;
          border: none;
          color: #000;
          font-weight: 700;
          cursor: pointer;
          transition: filter 0.2s ease;
        }
        .flat-btn-primary:hover {
          filter: brightness(1.1);
        }
        .flat-btn-primary:focus-visible {
          outline: 2px solid #D4AF37;
          outline-offset: 2px;
        }
        .flat-btn-outline {
          background: transparent;
          border: 1px solid var(--news-card-border);
          color: var(--news-text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .flat-btn-outline:hover {
          border-color: #D4AF37;
          color: #D4AF37;
        }
        .flat-btn-danger:hover {
          border-color: #ef4444;
          color: #ef4444;
        }
        .builder-block {
          background: #09090b;
          border: 1px solid var(--news-card-border);
          border-radius: 4px;
          padding: 16px;
          margin-bottom: 16px;
          position: relative;
          transition: border-color 0.2s ease;
        }
        .builder-block:hover {
          border-color: rgba(212,175,55,0.2);
        }
        .block-action-btn {
          background: transparent;
          border: none;
          color: var(--news-text-dim);
          padding: 4px;
          border-radius: 4px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .block-action-btn:hover {
          color: #D4AF37;
          background: rgba(212,175,55,0.08);
        }
        .block-action-btn.danger:hover {
          color: #ef4444;
          background: rgba(239,68,68,0.1);
        }
        .builder-info-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 16px;
        }
        @media (max-width: 768px) {
          .builder-info-grid {
            grid-template-columns: 1fr;
          }
        }
        .builder-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--news-card-border);
          padding-bottom: 16px;
          gap: 12px;
        }
        @media (max-width: 576px) {
          .builder-toolbar {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .builder-toolbar > div {
            width: 100%;
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }
        }
      `}</style>

      {/* Header toolbar */}
      <div className="builder-toolbar">
        <button
          type="button"
          onClick={() => navigate('/blogs')}
          aria-label="Back to blogs list"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--news-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.9rem',
            fontWeight: 600
          }}
        >
          <ArrowLeft size={16} /> Back to Blogs
        </button>

        <div style={{ display: 'flex', gap: 12 }}>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as any)}
            aria-label="Publication Status"
            style={{
              padding: '6px 12px',
              width: 'auto',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: '#000',
              border: '1px solid var(--news-card-border)',
              borderRadius: 3,
              color: status === 'published' ? '#10b981' : '#f59e0b'
            }}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>

          <button
            type="button"
            className="flat-btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 3,
              fontSize: '0.85rem'
            }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : blogId ? 'Update Post' : 'Publish Post'}
          </button>
        </div>
      </div>

      <div className="builder-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Headline Input Section */}
        <div>
          <label 
            htmlFor="builder-headline" 
            style={{ 
              display: 'block', 
              color: 'var(--news-text-muted)', 
              fontSize: '0.74rem', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '1px',
              marginBottom: 8
            }}
          >
            Blog Headline *
          </label>
          <input
            id="builder-headline"
            type="text"
            placeholder="Enter post headline..."
            value={headline}
            onChange={e => setHeadline(e.target.value)}
            style={{ padding: '12px 16px', fontSize: '1.2rem', fontWeight: 700 }}
            required
          />
        </div>

        {/* Category & Cover image Row */}
        <div className="builder-info-grid">
          
          {/* Category selection */}
          <div>
            <label 
              htmlFor="builder-category" 
              style={{ 
                display: 'block', 
                color: 'var(--news-text-muted)', 
                fontSize: '0.74rem', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '1px',
                marginBottom: 8
              }}
            >
              Category
            </label>
            <select
              id="builder-category"
              value={category}
              onChange={e => setCategory(e.target.value as BlogCategory)}
              style={{ padding: '10px 14px', fontSize: '0.88rem' }}
            >
              {BLOG_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Cover image editor */}
          <div>
            <label 
              style={{ 
                display: 'block', 
                color: 'var(--news-text-muted)', 
                fontSize: '0.74rem', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '1px',
                marginBottom: 8
              }}
            >
              Cover Image URL
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                type="text"
                placeholder="https://..."
                value={coverImage}
                onChange={e => setCoverImage(e.target.value)}
                style={{ padding: '10px 14px', fontSize: '0.88rem', flexGrow: 1 }}
                aria-label="Cover Image URL string"
              />
              <div style={{ position: 'relative' }}>
                <input
                  type="file"
                  id="cover-file-input"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="flat-btn-outline"
                  onClick={() => document.getElementById('cover-file-input')?.click()}
                  disabled={uploadingCover}
                  style={{ 
                    padding: '10px 14px', 
                    fontSize: '0.88rem', 
                    whiteSpace: 'nowrap', 
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Upload size={14} /> {uploadingCover ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Cover image preview */}
        {coverImage && (
          <div style={{ position: 'relative', width: '100%', height: '200px', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--news-card-border)' }}>
            <img src={coverImage} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              type="button"
              onClick={() => setCoverImage('')}
              style={{
                position: 'absolute', right: 12, top: 12,
                background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', padding: '6px', borderRadius: 4, cursor: 'pointer',
                display: 'inline-flex'
              }}
              title="Remove Cover Image"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {/* ── Composed Blocks Section ──────────────────────────────────────── */}
        <div>
          <h4 style={{ fontSize: '0.95rem', color: '#D4AF37', borderBottom: '1px solid var(--news-card-border)', paddingBottom: '8px', marginBottom: '16px' }}>
            Content Composition Blocks
          </h4>

          {blocks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', border: '1px dashed var(--news-card-border)', borderRadius: 4, color: 'var(--news-text-dim)' }}>
              No content blocks created yet. Click one of the buttons below to start drafting your content.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {blocks.map((block, index) => (
                <div key={block.id} className="builder-block" role="group" aria-label={`Content block ${index + 1}`}>
                  
                  {/* Block Actions Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--news-text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {block.type === 'heading' && <Heading2 size={12} />}
                      {block.type === 'paragraph' && <AlignLeft size={12} />}
                      {block.type === 'list' && <List size={12} />}
                      {block.type === 'image' && <ImageIcon size={12} />}
                      Block {index + 1}: {block.type}
                    </span>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="block-action-btn"
                        onClick={() => moveBlock(index, 'up')}
                        disabled={index === 0}
                        aria-label="Move block up"
                        title="Move Block Up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="block-action-btn"
                        onClick={() => moveBlock(index, 'down')}
                        disabled={index === blocks.length - 1}
                        aria-label="Move block down"
                        title="Move Block Down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="block-action-btn danger"
                        onClick={() => removeBlock(block.id)}
                        aria-label="Delete block"
                        title="Delete Block"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Block Editors */}
                  {block.type === 'heading' && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <select
                        aria-label="Heading Level"
                        value={block.level}
                        onChange={e => updateHeadingLevel(block.id, parseInt(e.target.value) as any)}
                        style={{ width: '80px', padding: '8px 10px', fontSize: '0.85rem' }}
                      >
                        <option value={2}>H2</option>
                        <option value={3}>H3</option>
                        <option value={4}>H4</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Heading text..."
                        value={block.value}
                        onChange={e => updateBlockValue(block.id, e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.88rem', flexGrow: 1 }}
                        aria-label={`Heading ${block.level} text`}
                      />
                    </div>
                  )}

                  {block.type === 'paragraph' && (
                    <textarea
                      placeholder="Write your paragraph details..."
                      value={block.value}
                      onChange={e => updateBlockValue(block.id, e.target.value)}
                      rows={4}
                      style={{ padding: '10px 14px', fontSize: '0.88rem', fontFamily: 'inherit', resize: 'vertical' }}
                      aria-label="Paragraph contents"
                    />
                  )}

                  {block.type === 'list' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--news-text-muted)' }}>List Style:</label>
                        <select
                          aria-label="List display style"
                          value={block.listStyle}
                          onChange={e => updateListStyle(block.id, e.target.value as any)}
                          style={{ width: '130px', padding: '6px 10px', fontSize: '0.82rem' }}
                        >
                          <option value="bullet">Bullet (•)</option>
                          <option value="ordered">Ordered (1, 2, 3)</option>
                        </select>
                      </div>

                      {/* Render each list item */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: '8px' }}>
                        {block.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--news-text-dim)', minWidth: '20px' }}>
                              {block.listStyle === 'ordered' ? `${idx + 1}.` : '•'}
                            </span>
                            <input
                              type="text"
                              placeholder={`List item ${idx + 1}...`}
                              value={item}
                              onChange={e => updateListItems(block.id, idx, e.target.value)}
                              style={{ padding: '8px 12px', fontSize: '0.85rem', flexGrow: 1 }}
                              aria-label={`List item ${idx + 1}`}
                            />
                            <button
                              type="button"
                              className="block-action-btn danger"
                              onClick={() => removeListItem(block.id, idx)}
                              aria-label={`Delete list item ${idx + 1}`}
                              title="Delete Item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="flat-btn-outline"
                        onClick={() => addListItem(block.id)}
                        style={{ 
                          alignSelf: 'flex-start', 
                          padding: '6px 12px', 
                          fontSize: '0.78rem', 
                          borderRadius: 3, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 4,
                          marginTop: '4px'
                        }}
                      >
                        <Plus size={12} /> Add Item
                      </button>
                    </div>
                  )}

                  {block.type === 'image' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <input
                          type="text"
                          placeholder="Image URL (https://...)"
                          value={block.value}
                          onChange={e => updateBlockValue(block.id, e.target.value)}
                          style={{ padding: '8px 12px', fontSize: '0.85rem', flexGrow: 1 }}
                          aria-label="Block image URL"
                        />
                        <div style={{ position: 'relative' }}>
                          <input
                            type="file"
                            id={`image-file-${block.id}`}
                            accept="image/*"
                            onChange={e => handleBlockImageUpload(block.id, e)}
                            style={{ display: 'none' }}
                          />
                          <button
                            type="button"
                            className="flat-btn-outline"
                            onClick={() => document.getElementById(`image-file-${block.id}`)?.click()}
                            disabled={uploadingBlockId === block.id}
                            style={{ 
                              padding: '8px 12px', 
                              fontSize: '0.85rem', 
                              whiteSpace: 'nowrap', 
                              borderRadius: 3,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <Upload size={13} /> {uploadingBlockId === block.id ? 'Uploading...' : 'Upload Image'}
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Image caption (optional)..."
                        value={block.caption || ''}
                        onChange={e => updateImageCaption(block.id, e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                        aria-label="Image Caption"
                      />

                      {block.value && (
                        <div style={{ width: '100%', maxHeight: '180px', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--news-card-border)', alignSelf: 'flex-start' }}>
                          <img src={block.value} alt="Preview block asset" style={{ width: 'auto', maxHeight: '180px', objectFit: 'contain' }} />
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Blocks Addition Controls ── */}
        <section 
          style={{ 
            background: '#09090b',
            border: '1px dashed var(--news-card-border)',
            borderRadius: 4,
            padding: '20px',
            textAlign: 'center'
          }}
        >
          <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--news-text-muted)', marginBottom: '12px' }}>
            Click to Insert an Element Block
          </h5>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="flat-btn-outline"
              onClick={() => addBlock('heading')}
              style={{ padding: '8px 16px', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
            >
              <Type size={14} /> Sub Heading
            </button>
            <button
              type="button"
              className="flat-btn-outline"
              onClick={() => addBlock('paragraph')}
              style={{ padding: '8px 16px', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
            >
              <AlignLeft size={14} /> Paragraph
            </button>
            <button
              type="button"
              className="flat-btn-outline"
              onClick={() => addBlock('list')}
              style={{ padding: '8px 16px', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
            >
              <List size={14} /> Bulleted / Ordered List
            </button>
            <button
              type="button"
              className="flat-btn-outline"
              onClick={() => addBlock('image')}
              style={{ padding: '8px 16px', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
            >
              <ImageIcon size={14} /> Inline Image
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
