import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Row, Col, Stack, Badge, Spinner } from 'react-bootstrap';
import { gsap } from 'gsap';
import { doc, getDoc } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';

// project-imports
import MainCard from 'components/MainCard';
import { useNewsPublisher } from 'features/news/hooks/useNewsPublisher';
import { getLocalizedStr, toDate } from 'features/news/hooks/useNews';

// icons
import {
  Type, Image as ImageIcon, Video, Trash2, ArrowUp, ArrowDown,
  GripVertical, UploadCloud, FileCheck, ChevronLeft, X,
  Layers, Settings, Shield, TrendingUp, Globe, CheckCircle,
  Clock, Calendar, Link, Building2, AlignLeft
} from 'lucide-react';

// styles
import 'features/news/styles/news-editor.scss';

// ── Today's date/time defaults ─────────────────────────────────────────────
const todayDate = () => new Date().toISOString().split('T')[0];
const todayTime = () => new Date().toTimeString().slice(0, 5);

// ── Generate a local ID for blocks ────────────────────────────────────────
const uid = () => Math.random().toString(36).substr(2, 9);

// ── Default editor state ──────────────────────────────────────────────────
const defaultMeta = () => ({
  headline: '',
  topic: 'General',
  tags: [],
  forCountries: [],
  specificLocal: [],
  markAsTrending: false,
  addToGeneralTopic: true,
  dateText: todayDate(),
  timeText: todayTime(),
  status: 'Pending',
  coverImage: '',
  coverImageFile: null,
  video: '',
  videoFile: null,
  thumbnailOfVideo: '',
  thumbnailFile: null,
  newsSource: {
    url: '',
    companyName: '',
    companyDescription: '',
    image: '',
    imageFile: null,
  }
});

const defaultBlock = (type = 'description') => ({
  id: uid(),
  type,
  value: '',
  caption: '',
  videoThumbnail: '',
  _file: null,
  _thumbFile: null,
});

// ── Converts a Firestore content block to local editor block ───────────────
const fromFirestoreBlock = (fb) => ({
  id: uid(),
  type: fb.type || 'description',
  value: getLocalizedStr(fb.value),
  caption: getLocalizedStr(fb.caption),
  videoThumbnail: fb.videoThumbnail || '',
  _file: null,
  _thumbFile: null,
});

// ══════════════════════════════════════════════════════════════════════════════
//  NewsEditorPage
// ══════════════════════════════════════════════════════════════════════════════
export default function NewsEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const { uploadFile, publishNews, progress, isUploading } = useNewsPublisher();

  const [meta, setMeta] = useState(defaultMeta());
  const [blocks, setBlocks] = useState([defaultBlock('description')]);
  const [currentTag, setCurrentTag] = useState('');
  const [currentCountry, setCurrentCountry] = useState('');
  const [currentLang, setCurrentLang] = useState('');
  const [isInitializing, setIsInitializing] = useState(isEditMode);
  const [saveError, setSaveError] = useState('');
  const blocksRef = useRef(null);

  // ── Hydrate editor from Firestore (Edit mode) ────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'News', id));
        if (snap.exists()) {
          const d = snap.data();
          const articleDate = toDate(d.date);

          setMeta({
            headline: getLocalizedStr(d.headline),
            topic: d.topic || 'General',
            tags: d.tags || [],
            forCountries: d.forCountries || [],
            specificLocal: d.specificLocal || [],
            markAsTrending: Boolean(d.markAsTrending),
            addToGeneralTopic: d.addToGeneralTopic ?? true,
            dateText: d.dateText || (articleDate ? articleDate.toISOString().split('T')[0] : todayDate()),
            timeText: d.timeText || (articleDate ? articleDate.toTimeString().slice(0, 5) : todayTime()),
            status: d.status || 'Pending',
            coverImage: d.coverImage || '',
            coverImageFile: null,
            video: d.video || '',
            videoFile: null,
            thumbnailOfVideo: d.thumbnailOfVideo || '',
            thumbnailFile: null,
            newsSource: {
              url: d.newsSource?.url || '',
              companyName: getLocalizedStr(d.newsSource?.company) || d.newsSource?.companyName || '',
              companyDescription: getLocalizedStr(d.newsSource?.description) || d.newsSource?.companyDescription || '',
              image: d.newsSource?.image || '',
              imageFile: null,
            }
          });

          if (d.content && d.content.length > 0) {
            setBlocks(d.content.map(fromFirestoreBlock));
          }
        }
      } catch (err) {
        console.error('Error fetching article for edit:', err);
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [id]);

  // ── Meta helpers ─────────────────────────────────────────────────────────
  const setMetaField = (key, value) => setMeta(prev => ({ ...prev, [key]: value }));

  const toggleBool = (key) => setMeta(prev => ({ ...prev, [key]: !prev[key] }));

  const setSourceField = (key, value) =>
    setMeta(prev => ({ ...prev, newsSource: { ...prev.newsSource, [key]: value } }));

  // ── Tag / Country / Language helpers ─────────────────────────────────────
  const addToArray = (field, value, setter) => {
    const trimmed = value.trim();
    if (trimmed && !meta[field].includes(trimmed)) {
      setMetaField(field, [...meta[field], trimmed]);
    }
    setter('');
  };

  const removeFromArray = (field, value) =>
    setMetaField(field, meta[field].filter(i => i !== value));

  // ── File pick → preview URL helper ───────────────────────────────────────
  const filePreviewUrl = (file, fallback) => {
    if (file instanceof File) return URL.createObjectURL(file);
    return fallback || '';
  };

  // ── Block management ──────────────────────────────────────────────────────
  const addBlock = (type) => {
    const b = defaultBlock(type);
    setBlocks(prev => [...prev, b]);
    setTimeout(() => {
      const els = blocksRef.current?.querySelectorAll('.block-card-sharp');
      if (els?.length) {
        const last = els[els.length - 1];
        gsap.from(last, { opacity: 0, y: 28, duration: 0.4, ease: 'expo.out' });
      }
    }, 0);
  };

  const removeBlock = (bid) => setBlocks(prev => prev.filter(b => b.id !== bid));

  const updateBlock = (bid, patch) =>
    setBlocks(prev => prev.map(b => b.id === bid ? { ...b, ...patch } : b));

  const moveBlock = (index, dir) => {
    const next = [...blocks];
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target >= 0 && target < next.length) {
      [next[index], next[target]] = [next[target], next[index]];
      setBlocks(next);
    }
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const [dragIdx, setDragIdx] = useState(null);

  const handleDrop = (e, idx) => {
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...blocks];
    const item = next.splice(dragIdx, 1)[0];
    next.splice(idx, 0, item);
    setBlocks(next);
    setDragIdx(null);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (statusOverride = null) => {
    setSaveError('');
    if (!meta.headline.trim()) {
      setSaveError('Article headline is required.');
      return;
    }

    const editorData = {
      ...meta,
      status: statusOverride || meta.status,
      blocks,
    };

    try {
      await publishNews(editorData, id || null);
      navigate('/news');
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError('Failed to save. Check console and Firebase permissions.');
    }
  };

  if (isInitializing) {
    return (
      <div className="p-5 text-center text-white d-flex align-items-center gap-3 justify-content-center">
        <Spinner animation="border" size="sm" style={{ color: '#D4AF37' }} />
        <span style={{ color: '#71717a', fontWeight: 600, fontSize: '0.9rem' }}>Loading article pipeline…</span>
      </div>
    );
  }

  return (
    <div className="news-editor-container">

      {/* ── 1. Header Toolbar ─────────────────────────────────────────────── */}
      <Stack direction="horizontal" gap={3} className="mb-5 align-items-center">
        <Button variant="link" className="text-silver p-0" onClick={() => navigate('/news')}>
          <ChevronLeft size={24} />
        </Button>
        <h2 className="editor-title-sharp mb-0">
          {isEditMode ? 'Edit Article' : 'Publish New Article'}
        </h2>
        {isUploading && (
          <div className="ms-auto" style={{ minWidth: 200 }}>
            <div className="upload-progress-wrap">
              <div className="progress-bar-gold" style={{ width: `${progress}%` }} />
            </div>
            <small className="text-gold d-block text-end fw-bold" style={{ fontSize: '0.72rem' }}>
              UPLOADING… {Math.round(progress)}%
            </small>
          </div>
        )}
      </Stack>

      {saveError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(220,20,60,0.1)', border: '1px solid rgba(220,20,60,0.3)', borderRadius: 3, color: '#DC143C', fontSize: '0.85rem', fontWeight: 600 }}>
          {saveError}
        </div>
      )}

      <Row>
        {/* ── LEFT: Content Blocks ─────────────────────────────────────── */}
        <Col lg={8}>
          <div className="blocks-management" ref={blocksRef}>
            <div className="mb-3 d-flex align-items-center gap-2 opacity-40 small fw-bold text-uppercase" style={{ color: '#a1a1aa', letterSpacing: 1 }}>
              <Layers size={14} /> Content Blocks
            </div>

            {blocks.map((block, index) => (
              <div
                key={block.id}
                className={`block-card-sharp${dragIdx === index ? ' opacity-30' : ''}`}
                draggable
                onDragStart={(e) => { setDragIdx(index); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, index)}
              >
                {/* Block toolbar */}
                <div className="block-tools-top">
                  <Button variant="link" size="sm" className="text-silver p-1" onClick={() => moveBlock(index, 'up')} disabled={index === 0}>
                    <ArrowUp size={16} />
                  </Button>
                  <Button variant="link" size="sm" className="text-silver p-1" onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1}>
                    <ArrowDown size={16} />
                  </Button>
                  <Button variant="link" size="sm" className="text-danger p-1" onClick={() => removeBlock(block.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>

                <div className="d-flex w-100">
                  <div className="block-drag-handle pe-4 d-flex align-items-center">
                    <GripVertical size={20} />
                  </div>
                  <div className="flex-grow-1">

                    {/* ── Description block ────────────────────────────── */}
                    {block.type === 'description' && (
                      <div>
                        <label className="form-label d-flex align-items-center gap-2">
                          <Type size={14} /> Paragraph
                        </label>
                        <Form.Control
                          as="textarea"
                          rows={5}
                          className="editor-input-sharp"
                          placeholder="Write your article paragraph here…"
                          value={block.value}
                          onChange={e => updateBlock(block.id, { value: e.target.value })}
                        />
                      </div>
                    )}

                    {/* ── Image block ───────────────────────────────────── */}
                    {block.type === 'image' && (
                      <div className="d-flex gap-4">
                        {/* Preview / Upload zone */}
                        <div className="upload-zone-sharp" style={{ width: 220, minHeight: 130, flexShrink: 0 }}>
                          {(block._file || block.value) ? (
                            <div style={{ position: 'relative' }}>
                              <img
                                src={filePreviewUrl(block._file, block.value)}
                                alt="preview"
                                style={{ width: '100%', borderRadius: 3, border: '1px solid #27272a', display: 'block' }}
                              />
                              <Button
                                variant="link" size="sm"
                                className="text-danger position-absolute top-0 end-0 p-1"
                                onClick={() => updateBlock(block.id, { value: '', _file: null })}
                                style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 2 }}
                              >
                                <X size={14} />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <ImageIcon size={24} className="mb-2 opacity-30" />
                              <Form.Control
                                type="file"
                                accept="image/*"
                                className="d-none"
                                id={`img-${block.id}`}
                                onChange={e => {
                                  const f = e.target.files[0];
                                  if (f) updateBlock(block.id, { _file: f });
                                }}
                              />
                              <label htmlFor={`img-${block.id}`} className="d-block small text-gold fw-bold" style={{ cursor: 'pointer' }}>
                                SELECT IMAGE
                              </label>
                            </>
                          )}
                        </div>
                        {/* Caption */}
                        <div className="flex-grow-1">
                          <label className="form-label">Image Caption <span style={{ color: '#52525b', fontSize: '0.78rem' }}>(optional)</span></label>
                          <Form.Control
                            type="text"
                            className="editor-input-sharp"
                            placeholder="Descriptive caption for this image…"
                            value={block.caption}
                            onChange={e => updateBlock(block.id, { caption: e.target.value })}
                          />
                          {/* Also accept URL directly */}
                          <label className="form-label mt-3">Or paste image URL</label>
                          <Form.Control
                            type="url"
                            className="editor-input-sharp"
                            placeholder="https://…"
                            value={block._file ? '' : (block.value || '')}
                            disabled={Boolean(block._file)}
                            onChange={e => updateBlock(block.id, { value: e.target.value, _file: null })}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── Video block ───────────────────────────────────── */}
                    {block.type === 'video' && (
                      <div className="d-flex gap-4 flex-wrap">
                        <div className="flex-grow-1">
                          <label className="form-label d-flex align-items-center gap-2">
                            <Video size={14} /> Video URL or Upload
                          </label>
                          <Form.Control
                            type="url"
                            className="editor-input-sharp mb-2"
                            placeholder="Paste video stream URL…"
                            value={block._file ? '' : (block.value || '')}
                            disabled={Boolean(block._file)}
                            onChange={e => updateBlock(block.id, { value: e.target.value, _file: null })}
                          />
                          <Form.Control
                            type="file"
                            accept="video/*"
                            className="bg-black border-secondary text-silver small"
                            onChange={e => {
                              const f = e.target.files[0];
                              if (f) updateBlock(block.id, { _file: f, value: '' });
                            }}
                          />
                          {block._file && (
                            <small className="text-gold d-block mt-1">
                              📎 {block._file.name} — will upload on save
                            </small>
                          )}
                        </div>
                        {/* Thumbnail */}
                        <div style={{ width: 180, flexShrink: 0 }}>
                          <label className="form-label">Video Thumbnail</label>
                          {(block._thumbFile || block.videoThumbnail) ? (
                            <div style={{ position: 'relative' }}>
                              <img
                                src={filePreviewUrl(block._thumbFile, block.videoThumbnail)}
                                alt="thumb"
                                style={{ width: '100%', borderRadius: 3, border: '1px solid #27272a' }}
                              />
                              <Button
                                variant="link" size="sm"
                                className="text-danger position-absolute top-0 end-0 p-1"
                                onClick={() => updateBlock(block.id, { videoThumbnail: '', _thumbFile: null })}
                                style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 2 }}
                              >
                                <X size={14} />
                              </Button>
                            </div>
                          ) : (
                            <div className="upload-zone-sharp p-2">
                              <Form.Control
                                type="file"
                                accept="image/*"
                                className="d-none"
                                id={`thumb-${block.id}`}
                                onChange={e => {
                                  const f = e.target.files[0];
                                  if (f) updateBlock(block.id, { _thumbFile: f });
                                }}
                              />
                              <label htmlFor={`thumb-${block.id}`} className="small text-silver" style={{ cursor: 'pointer' }}>
                                Upload Thumbnail
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add block buttons */}
          <div className="add-block-panel">
            <button className="btn-add-modular" onClick={() => addBlock('description')}>
              <Type size={16} /> Add Paragraph
            </button>
            <button className="btn-add-modular" onClick={() => addBlock('image')}>
              <ImageIcon size={16} /> Add Image
            </button>
            <button className="btn-add-modular" onClick={() => addBlock('video')}>
              <Video size={16} /> Add Video
            </button>
          </div>
        </Col>

        {/* ── RIGHT: Metadata Panel ──────────────────────────────────────── */}
        <Col lg={4}>
          <Stack gap={4}>

            {/* ── Publication Metadata Card ──────────────────────────────── */}
            <MainCard
              title={<span className="text-gold fw-bold"><Settings size={14} className="me-2" />METADATA</span>}
              className="bg-black border-secondary"
            >
              <Stack gap={3}>

                {/* Headline */}
                <div>
                  <label className="form-label">Article Headline *</label>
                  <Form.Control
                    className="editor-input-sharp"
                    value={meta.headline}
                    onChange={e => setMetaField('headline', e.target.value)}
                    placeholder="Official press headline…"
                  />
                </div>

                {/* Topic */}
                <div>
                  <label className="form-label"><Layers size={13} className="me-1" /> Topic / Category</label>
                  <Form.Control
                    className="editor-input-sharp"
                    value={meta.topic}
                    onChange={e => setMetaField('topic', e.target.value)}
                    placeholder="e.g. Economy, Technology, Regional…"
                  />
                </div>

                {/* Date + Time */}
                <Row>
                  <Col>
                    <label className="form-label"><Calendar size={13} className="me-1" /> Release Date</label>
                    <Form.Control
                      type="date"
                      className="editor-input-sharp"
                      value={meta.dateText}
                      onChange={e => setMetaField('dateText', e.target.value)}
                    />
                  </Col>
                  <Col>
                    <label className="form-label"><Clock size={13} className="me-1" /> Time</label>
                    <Form.Control
                      type="time"
                      className="editor-input-sharp"
                      value={meta.timeText}
                      onChange={e => setMetaField('timeText', e.target.value)}
                    />
                  </Col>
                </Row>

                {/* Status */}
                <div>
                  <label className="form-label"><Shield size={13} className="me-1" /> Status</label>
                  <Form.Select
                    className="editor-input-sharp"
                    value={meta.status}
                    onChange={e => setMetaField('status', e.target.value)}
                  >
                    <option value="Pending">Pending (awaiting approval)</option>
                    <option value="Approved">Approved (live)</option>
                  </Form.Select>
                </div>

                {/* Flags */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <ToggleChip
                    label="General Topic"
                    active={meta.addToGeneralTopic}
                    onToggle={() => toggleBool('addToGeneralTopic')}
                    color="#D4AF37"
                  />
                  <ToggleChip
                    label={<><TrendingUp size={11} className="me-1" />Trending</>}
                    active={meta.markAsTrending}
                    onToggle={() => toggleBool('markAsTrending')}
                    color="#DC143C"
                  />
                </div>

              </Stack>
            </MainCard>

            {/* ── Tags ───────────────────────────────────────────────────── */}
            <MainCard title={<span className="text-silver fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: 1 }}>Tags &amp; Keywords</span>} className="bg-black border-secondary">
              <div className="d-flex flex-wrap gap-2 mb-3">
                {meta.tags.map(tag => (
                  <Badge key={tag} bg="dark" className="border d-flex align-items-center gap-2 py-2 px-3 rounded-0"
                    style={{ borderColor: 'rgba(212,175,55,0.3)', color: '#D4AF37' }}>
                    {tag} <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeFromArray('tags', tag)} />
                  </Badge>
                ))}
              </div>
              <div className="d-flex gap-2">
                <Form.Control
                  className="editor-input-sharp"
                  placeholder="Add tag…"
                  value={currentTag}
                  onChange={e => setCurrentTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addToArray('tags', currentTag, setCurrentTag)}
                />
                <Button
                  style={{ background: 'transparent', border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37', borderRadius: 3, flexShrink: 0, fontWeight: 700, fontSize: '0.8rem' }}
                  onClick={() => addToArray('tags', currentTag, setCurrentTag)}
                >
                  Add
                </Button>
              </div>
            </MainCard>

            {/* ── Countries ──────────────────────────────────────────────── */}
            <MainCard title={<span className="text-silver fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: 1 }}><Globe size={12} className="me-1" />Geographic Target</span>} className="bg-black border-secondary">
              <div className="d-flex flex-wrap gap-2 mb-3">
                {meta.forCountries.map(c => (
                  <Badge key={c} bg="dark" className="border d-flex align-items-center gap-2 py-2 px-3 rounded-0"
                    style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#a1a1aa' }}>
                    {c} <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeFromArray('forCountries', c)} />
                  </Badge>
                ))}
              </div>
              <div className="d-flex gap-2">
                <Form.Control
                  className="editor-input-sharp"
                  placeholder="Enter country name…"
                  value={currentCountry}
                  onChange={e => setCurrentCountry(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addToArray('forCountries', currentCountry, setCurrentCountry)}
                />
                <Button
                  style={{ background: 'transparent', border: '1px solid #3f3f46', color: '#a1a1aa', borderRadius: 3, flexShrink: 0, fontWeight: 700, fontSize: '0.8rem' }}
                  onClick={() => addToArray('forCountries', currentCountry, setCurrentCountry)}
                >
                  Add
                </Button>
              </div>
            </MainCard>

            {/* ── Cover Image ────────────────────────────────────────────── */}
            <MainCard title={<span className="text-silver fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: 1 }}>Cover Image</span>} className="bg-black border-secondary">
              <div className="upload-zone-sharp py-4">
                {(meta.coverImageFile || meta.coverImage) ? (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={filePreviewUrl(meta.coverImageFile, meta.coverImage)}
                      alt="cover"
                      style={{ width: '100%', borderRadius: 3, border: '1px solid rgba(212,175,55,0.2)', display: 'block' }}
                    />
                    <Button
                      variant="danger" size="sm"
                      className="position-absolute top-0 end-0 m-2 rounded-0"
                      onClick={() => setMeta(prev => ({ ...prev, coverImage: '', coverImageFile: null }))}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <UploadCloud size={22} className="mb-2 opacity-30" />
                    <Form.Control type="file" accept="image/*" className="d-none" id="cover-upload"
                      onChange={e => { const f = e.target.files[0]; if (f) setMetaField('coverImageFile', f); }} />
                    <label htmlFor="cover-upload" className="btn btn-sm d-block m-auto"
                      style={{ background: 'transparent', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', borderRadius: 3, maxWidth: 160, cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                      UPLOAD COVER
                    </label>
                  </>
                )}
              </div>
            </MainCard>

            {/* ── Hero Video ─────────────────────────────────────────────── */}
            <MainCard title={<span className="text-silver fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: 1 }}>Hero Video (optional)</span>} className="bg-black border-secondary">
              <Stack gap={2}>
                <Form.Control
                  type="url"
                  className="editor-input-sharp"
                  placeholder="Paste video URL…"
                  value={meta.videoFile ? '' : (meta.video || '')}
                  disabled={Boolean(meta.videoFile)}
                  onChange={e => setMetaField('video', e.target.value)}
                />
                <Form.Control
                  type="file"
                  accept="video/*"
                  className="bg-black border-secondary text-silver small"
                  onChange={e => { const f = e.target.files[0]; if (f) setMetaField('videoFile', f); }}
                />
                {meta.videoFile && <small className="text-gold">📎 {meta.videoFile.name} — uploads on save</small>}

                <label className="form-label mt-2 mb-1">Video Thumbnail</label>
                {(meta.thumbnailFile || meta.thumbnailOfVideo) ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={filePreviewUrl(meta.thumbnailFile, meta.thumbnailOfVideo)}
                      alt="thumbnail"
                      style={{ width: '100%', borderRadius: 3, border: '1px solid #27272a', display: 'block' }}
                    />
                    <Button
                      variant="link" size="sm" className="text-danger position-absolute top-0 end-0 p-1"
                      onClick={() => setMeta(prev => ({ ...prev, thumbnailOfVideo: '', thumbnailFile: null }))}
                      style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 2 }}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <div className="upload-zone-sharp p-2">
                    <Form.Control type="file" accept="image/*" className="d-none" id="thumb-upload"
                      onChange={e => { const f = e.target.files[0]; if (f) setMetaField('thumbnailFile', f); }} />
                    <label htmlFor="thumb-upload" className="small text-silver" style={{ cursor: 'pointer' }}>Upload thumbnail</label>
                  </div>
                )}
              </Stack>
            </MainCard>

            {/* ── News Source ────────────────────────────────────────────── */}
            <MainCard
              title={<span className="text-silver fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: 1 }}><Building2 size={12} className="me-1" />News Source</span>}
              className="bg-black border-secondary"
            >
              <Stack gap={3}>
                {/* Logo */}
                <div>
                  <label className="form-label">Source Logo</label>
                  {(meta.newsSource.imageFile || meta.newsSource.image) ? (
                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
                      <img
                        src={filePreviewUrl(meta.newsSource.imageFile, meta.newsSource.image)}
                        alt="logo"
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #27272a', display: 'block' }}
                      />
                      <Button
                        variant="link" size="sm" className="text-danger position-absolute top-0 end-0 p-0"
                        onClick={() => setMeta(prev => ({ ...prev, newsSource: { ...prev.newsSource, image: '', imageFile: null } }))}
                        style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 2, width: 18, height: 18 }}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Form.Control type="file" accept="image/*" className="d-none" id="source-logo"
                        onChange={e => { const f = e.target.files[0]; if (f) setSourceField('imageFile', f); }} />
                      <label htmlFor="source-logo" className="btn btn-sm d-inline-block"
                        style={{ background: 'transparent', border: '1px solid #27272a', color: '#52525b', borderRadius: 3, cursor: 'pointer', fontWeight: 600, fontSize: '0.77rem' }}>
                        Upload Logo
                      </label>
                    </>
                  )}
                </div>

                {/* Company Name */}
                <div>
                  <label className="form-label"><Building2 size={13} className="me-1" /> Company Name</label>
                  <Form.Control
                    className="editor-input-sharp"
                    placeholder="e.g. Reuters, Al Jazeera…"
                    value={meta.newsSource.companyName}
                    onChange={e => setSourceField('companyName', e.target.value)}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="form-label"><AlignLeft size={13} className="me-1" /> Description</label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    className="editor-input-sharp"
                    placeholder="Short description of the source…"
                    value={meta.newsSource.companyDescription}
                    onChange={e => setSourceField('companyDescription', e.target.value)}
                  />
                </div>

                {/* URL */}
                <div>
                  <label className="form-label"><Link size={13} className="me-1" /> Source URL</label>
                  <Form.Control
                    type="url"
                    className="editor-input-sharp"
                    placeholder="https://…"
                    value={meta.newsSource.url}
                    onChange={e => setSourceField('url', e.target.value)}
                  />
                </div>
              </Stack>
            </MainCard>

          </Stack>
        </Col>
      </Row>

      {/* ── Sticky Save Bar ──────────────────────────────────────────────── */}
      <div className="editor-sticky-footer">
        <Stack direction="horizontal" gap={4} className="text-silver small fw-bold text-uppercase">
          <div className="d-flex align-items-center gap-2">
            <Shield size={14} className="text-gold" />
            Status: <span className="text-white">{meta.status}</span>
          </div>
          <div className="opacity-20 mx-1">|</div>
          <div>
            Blocks: <span className="text-white">{blocks.length}</span>
          </div>
          {meta.addToGeneralTopic && (
            <>
              <div className="opacity-20 mx-1">|</div>
              <div className="text-gold">General</div>
            </>
          )}
          {meta.markAsTrending && (
            <>
              <div className="opacity-20 mx-1">|</div>
              <div style={{ color: '#DC143C' }}><TrendingUp size={12} className="me-1" />Trending</div>
            </>
          )}
        </Stack>
        <Stack direction="horizontal" gap={3}>
          <Button
            variant="outline-secondary"
            className="rounded-0 text-uppercase fw-bold"
            disabled={isUploading}
            onClick={() => handleSave('Pending')}
          >
            Save as Pending
          </Button>
          <Button
            className="px-5 d-flex align-items-center gap-2 rounded-0 text-uppercase fw-bold"
            style={{ background: '#D4AF37', border: 'none', color: '#000' }}
            disabled={isUploading}
            onClick={() => handleSave('Approved')}
          >
            {isUploading ? <Spinner size="sm" /> : <CheckCircle size={18} />}
            {isEditMode ? 'Save Changes' : 'Publish Article'}
          </Button>
        </Stack>
      </div>
    </div>
  );
}

// ── Toggle Chip helper ────────────────────────────────────────────────────────
function ToggleChip({ label, active, onToggle, color = '#D4AF37' }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        background: active ? `${color}18` : 'transparent',
        border: `1px solid ${active ? color : '#3f3f46'}`,
        color: active ? color : '#52525b',
        padding: '5px 14px',
        borderRadius: 20,
        fontSize: '0.78rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4
      }}
    >
      {active && <CheckCircle size={11} />}
      {label}
    </button>
  );
}

// ── Local preview URL helper (also used internally) ───────────────────────────
function filePreviewUrl(file, fallback) {
  if (file instanceof File) return URL.createObjectURL(file);
  return fallback || '';
}
