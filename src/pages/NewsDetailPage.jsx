import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';
import { gsap } from 'gsap';
import Dropdown from 'react-bootstrap/Dropdown';
import Spinner from 'react-bootstrap/Spinner';
import Logo from 'components/Logo';
import {
  Edit3, Trash2, MoreVertical, ChevronLeft,
  Globe, Calendar, Tag, ExternalLink, TrendingUp,
  CheckCircle, Eye, Clock
} from 'lucide-react';
import { getLocalizedStr, toDate } from 'features/news/hooks/useNews';
import { deleteDoc } from 'firebase/firestore';

// ══════════════════════════════════════════════════════════════════════════════
//  NewsDetailPage — Full-width immersive article view
//  Reads from Flutter/Firestore News schema:
//    article.headline       → Map {en, ar, ...}
//    article.coverImage     → string URL
//    article.content[]      → [{type, value:{en}, videoThumbnail, caption:{en}}]
//    article.forCountries[] → string[]
//    article.newsSource     → {url, company:{ar}, description:{ar}, image}
//    article.date           → Firestore Timestamp
//    article.status         → "Approved" | "Pending"
// ══════════════════════════════════════════════════════════════════════════════
export default function NewsDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const headerRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const snap = await getDoc(doc(db, 'News', id));
        if (snap.exists()) setArticle({ id: snap.id, ...snap.data() });
      } catch (e) {
        console.error('Failed to load article:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [id]);

  // GSAP entrance
  useEffect(() => {
    if (!loading && article) {
      if (headerRef.current) {
        gsap.fromTo(headerRef.current,
          { opacity: 0, y: -20 },
          { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }
        );
      }
      if (contentRef.current) {
        gsap.fromTo(Array.from(contentRef.current.children),
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out', delay: 0.2 }
        );
      }
    }
  }, [loading, article]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <Spinner animation="border" style={{ color: '#D4AF37', width: 40, height: 40 }} />
        <span style={{ color: '#71717a', fontSize: '0.85rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
          Loading Article…
        </span>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!article) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 20 }}>
        <Logo width={100} />
        <h3 style={{ color: '#fff', fontWeight: 800, marginBottom: 8 }}>Article Not Found</h3>
        <p style={{ color: '#71717a' }}>This article may have been removed or the link is invalid.</p>
        <button
          onClick={() => navigate('/news')}
          style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '10px 24px', fontWeight: 700, borderRadius: 3, cursor: 'pointer' }}
        >
          Back to Archive
        </button>
      </div>
    );
  }

  // ── Derived display values from real schema ────────────────────────────────
  const headline   = getLocalizedStr(article.headline, 'Untitled Article');
  const isApproved = article.status === 'Approved';
  const articleDate = toDate(article.date);
  const formattedDate = articleDate
    ? articleDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const formattedTime = article.timeText || (articleDate
    ? articleDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null);

  // newsSource display
  const sourceName  = getLocalizedStr(article.newsSource?.company) || article.newsSource?.companyName || '';
  const sourceDesc  = getLocalizedStr(article.newsSource?.description) || article.newsSource?.companyDescription || '';
  const sourceUrl   = article.newsSource?.url || '';
  const sourceLogo  = article.newsSource?.image || '';

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'News', id));
      navigate('/news');
    } catch (e) {
      console.error('Delete failed:', e);
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 20px 80px' }}>

      {/* ── Top Control Bar ──────────────────────────────────────────────── */}
      <div ref={headerRef} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 0 32px', borderBottom: '1px solid #27272a', marginBottom: 40
      }}>
        {/* Back */}
        <button
          onClick={() => navigate('/news')}
          style={{
            background: 'transparent', border: '1px solid #27272a', color: '#a1a1aa',
            padding: '8px 16px', borderRadius: 3, fontSize: '0.82rem', fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#a1a1aa'; }}
        >
          <ChevronLeft size={16} /> Back to Archive
        </button>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Status badge */}
          <span style={{
            padding: '4px 12px', borderRadius: 12, fontSize: '0.72rem',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
            background: isApproved ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
            color: isApproved ? '#22c55e' : '#eab308',
            border: `1px solid ${isApproved ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`
          }}>
            {isApproved ? 'Approved' : 'Pending'}
          </span>

          {/* Trending badge */}
          {article.markAsTrending && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 12px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 1,
              background: 'rgba(220,20,60,0.1)', color: '#DC143C', border: '1px solid rgba(220,20,60,0.3)'
            }}>
              <TrendingUp size={11} /> Trending
            </span>
          )}

          <button
            onClick={() => navigate(`/news/edit/${id}`)}
            style={{
              background: '#D4AF37', color: '#000', border: 'none', padding: '8px 20px',
              borderRadius: 3, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; }}
          >
            <Edit3 size={14} /> Edit Article
          </button>

          {/* 3-Dots More Menu */}
          <Dropdown>
            <Dropdown.Toggle
              as="div"
              bsPrefix="no-caret"
              style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: '1px solid #27272a', borderRadius: 3,
                cursor: 'pointer', color: '#71717a', transition: 'all 0.2s ease'
              }}
            >
              <MoreVertical size={16} />
            </Dropdown.Toggle>
            <Dropdown.Menu style={{
              background: '#09090b', border: '1px solid #27272a', borderRadius: 4,
              padding: '4px', minWidth: 170, boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
            }}>
              <Dropdown.Item
                onClick={() => navigate(`/news/edit/${id}`)}
                style={{ color: '#e4e4e7', padding: '9px 12px', borderRadius: 3, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}
                className="news-menu-item"
              >
                <Edit3 size={14} style={{ color: '#D4AF37' }} /> Edit Article
              </Dropdown.Item>
              <Dropdown.Divider style={{ borderColor: '#27272a', margin: '4px 0' }} />
              <Dropdown.Item
                onClick={() => setShowDeleteConfirm(true)}
                style={{ color: '#DC143C', padding: '9px 12px', borderRadius: 3, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}
                className="news-menu-item-danger"
              >
                <Trash2 size={14} /> Delete Article
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {/* ── Article Content ──────────────────────────────────────────────── */}
      <article ref={contentRef}>

        {/* Topic & Date meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ color: '#D4AF37', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, fontSize: '0.72rem' }}>
            {article.topic || 'General'}
          </span>
          {formattedDate && (
            <>
              <span style={{ color: '#27272a' }}>·</span>
              <span style={{ color: '#71717a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={13} /> {formattedDate}
              </span>
            </>
          )}
          {formattedTime && (
            <>
              <span style={{ color: '#27272a' }}>·</span>
              <span style={{ color: '#71717a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={13} /> {formattedTime}
              </span>
            </>
          )}
          {article.views !== undefined && (
            <>
              <span style={{ color: '#27272a' }}>·</span>
              <span style={{ color: '#71717a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Eye size={13} /> {article.views?.toLocaleString() ?? 0} views
              </span>
            </>
          )}
        </div>

        {/* Headline — from headline.en */}
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.15, color: '#fff', marginBottom: 24, letterSpacing: '-1px' }}>
          {headline}
        </h1>

        {/* Region + Tag chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
          {(article.forCountries || []).map(c => (
            <span key={c} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: '1px solid #27272a', color: '#a1a1aa',
              fontSize: '0.78rem', fontWeight: 600
            }}>
              <Globe size={11} /> {c}
            </span>
          ))}
          {(article.tags || []).map(t => (
            <span key={t} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 12,
              background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)',
              color: '#D4AF37', fontSize: '0.78rem', fontWeight: 600
            }}>
              <Tag size={11} /> {t}
            </span>
          ))}
        </div>

        {/* Cover Image — field name: coverImage (not coverImageUrl) */}
        {article.coverImage && (
          <div style={{ borderRadius: 4, overflow: 'hidden', marginBottom: 40, border: '1px solid #27272a', aspectRatio: '16/7' }}>
            <img
              src={article.coverImage}
              alt={headline}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}

        {/* Hero Video (article-level — not a content block) */}
        {article.video && (
          <div style={{ borderRadius: 4, overflow: 'hidden', marginBottom: 40, border: '1px solid #27272a', aspectRatio: '16/9', background: '#000' }}>
            <video
              src={article.video}
              controls
              poster={article.thumbnailOfVideo || undefined}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid #27272a', marginBottom: 40 }} />

        {/* ── Content Blocks ─────────────────────────────────────────────── */}
        {/* Flutter schema: content[].type = "description" | "image" | "video"  */}
        {/*                 content[].value = {en: "text or URL"}               */}
        {/*                 content[].caption = {en: "..."}  (image only)       */}
        {/*                 content[].videoThumbnail = "url" (video only)       */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {(article.content || []).map((block, idx) => {
            const blockValue = getLocalizedStr(block.value);
            const blockCaption = getLocalizedStr(block.caption);

            if (block.type === 'description') {
              return (
                <p key={idx} style={{ color: '#d4d4d8', fontSize: '1.05rem', lineHeight: 1.85, fontWeight: 400, margin: 0 }}>
                  {blockValue}
                </p>
              );
            }

            if (block.type === 'image') {
              return (
                <figure key={idx} style={{ margin: 0 }}>
                  <div style={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #27272a' }}>
                    <img
                      src={blockValue}
                      alt={blockCaption || `Image ${idx + 1}`}
                      style={{ width: '100%', display: 'block', maxHeight: 520, objectFit: 'cover' }}
                    />
                  </div>
                  {blockCaption && (
                    <figcaption style={{ color: '#71717a', fontSize: '0.82rem', marginTop: 10, fontStyle: 'italic', textAlign: 'center' }}>
                      {blockCaption}
                    </figcaption>
                  )}
                </figure>
              );
            }

            if (block.type === 'video') {
              return (
                <div key={idx} style={{
                  borderRadius: 4, overflow: 'hidden',
                  border: '1px solid #27272a', background: '#000',
                  aspectRatio: '16/9', position: 'relative'
                }}>
                  {blockValue ? (
                    <video
                      src={blockValue}
                      controls
                      poster={block.videoThumbnail || undefined}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#52525b', flexDirection: 'column', gap: 12 }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/>
                      </svg>
                      <span style={{ fontSize: '0.8rem' }}>Video asset unavailable</span>
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>

        {/* ── News Source Section ────────────────────────────────────────── */}
        {(sourceName || sourceDesc || sourceUrl || sourceLogo) && (
          <div style={{
            marginTop: 56, padding: '28px 32px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid #27272a', borderRadius: 4
          }}>
            <p style={{ color: '#52525b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>
              Source
            </p>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              {sourceLogo && (
                <img
                  src={sourceLogo}
                  alt={sourceName}
                  style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid #27272a', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1 }}>
                {sourceName && (
                  <p style={{ color: '#e4e4e7', fontWeight: 700, margin: '0 0 4px', fontSize: '1rem' }}>
                    {sourceName}
                  </p>
                )}
                {sourceDesc && (
                  <p style={{ color: '#71717a', margin: '0 0 12px', fontSize: '0.88rem', lineHeight: 1.6 }}>
                    {sourceDesc}
                  </p>
                )}
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#D4AF37', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                  >
                    <ExternalLink size={14} /> View Original Source
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </article>

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#09090b', border: '1px solid #27272a', borderRadius: 4,
            padding: '40px', maxWidth: 420, width: '90%', textAlign: 'center'
          }}>
            <div style={{ marginBottom: 20 }}>
              <Trash2 size={36} style={{ color: '#DC143C' }} />
            </div>
            <h4 style={{ color: '#fff', fontWeight: 800, marginBottom: 10 }}>Delete Article?</h4>
            <p style={{ color: '#71717a', fontSize: '0.9rem', marginBottom: 28, lineHeight: 1.6 }}>
              This will permanently remove <strong style={{ color: '#fff' }}>"{headline}"</strong> from the archive. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                style={{ background: 'transparent', border: '1px solid #27272a', color: '#a1a1aa', padding: '10px 24px', borderRadius: 3, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{ background: '#DC143C', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 3, fontWeight: 700, cursor: 'pointer', minWidth: 140 }}
              >
                {isDeleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .news-menu-item:hover { background: rgba(212,175,55,0.08) !important; color: #fff !important; }
        .news-menu-item-danger:hover { background: rgba(220,20,60,0.1) !important; }
        [bsprefix="no-caret"]::after { display: none !important; }
      `}</style>
    </div>
  );
}
