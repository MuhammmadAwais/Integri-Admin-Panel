import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { Plus, Search, RotateCw } from 'lucide-react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';

// project-imports
import Logo from 'components/Logo';
import { useNews } from 'features/news/hooks/useNews';
import NewsTable from 'features/news/components/NewsTable';
import ParticleBackground from 'components/ParticleBackground';

// styles
import 'features/news/styles/news.scss';

// ──────────────────────────────────────────────────────────────────────────────
//  Tab definitions — mirroring Flutter's General / Others / Pending structure
// ──────────────────────────────────────────────────────────────────────────────
const TABS = ['General', 'Others', 'Pending', 'All'];

// ══════════════════════════════════════════════════════════════════════════════
//  NewsPage — Main archive with table layout
// ══════════════════════════════════════════════════════════════════════════════
export default function NewsPage() {
  const navigate = useNavigate();
  const {
    allNews,
    loading,
    loadingMore,
    totalLoaded,
    allLoaded,
    searchTerm,
    setSearchTerm,
    filterByTab,
    filterBySearch,
    deleteNews,
    approveNews,
  } = useNews();

  const [activeTab, setActiveTab] = useState('General');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const headerRef = useRef(null);

  // Entrance animation
  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current.children,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, []);

  // ── Tab counts (computed from allNews) ────────────────────────────────────
  const tabCounts = {};
  TABS.forEach(tab => {
    tabCounts[tab] = filterBySearch(filterByTab(tab)).length;
  });

  // ── Visible rows = tab filter + search ───────────────────────────────────
  const visibleNews = filterBySearch(filterByTab(activeTab));

  // ── Delete flow ───────────────────────────────────────────────────────────
  const handleDeleteRequest = (id) => {
    setItemToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteNews(itemToDelete);
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  // ── Approve flow (Pending tab) ────────────────────────────────────────────
  const handleApprove = async (id) => {
    try {
      await approveNews(id);
    } catch (e) {
      console.error('Approve failed:', e);
    }
  };

  return (
    <div className="news-glass-archive">
      <ParticleBackground />

      {/* ── Progressive load progress bar (top of page) ──────────────── */}
      {loadingMore && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          height: 2, zIndex: 9999,
          background: 'rgba(212,175,55,0.15)'
        }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, #D4AF37, #f5d27a)',
            width: '100%',
            animation: 'progressPulse 1.4s ease-in-out infinite',
            transformOrigin: 'left'
          }} />
          <style>{`
            @keyframes progressPulse {
              0%   { transform: scaleX(0.15); opacity: 1; }
              50%  { transform: scaleX(0.75); opacity: 0.8; }
              100% { transform: scaleX(0.95); opacity: 0.5; }
            }
          `}</style>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div ref={headerRef} className="news-command-header">
        <div>
          <h2 className="news-title-sharp">News Management</h2>
          <p style={{ color: '#71717a', margin: 0, fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? (
              <span>Loading archive…</span>
            ) : (
              <>
                <span style={{ color: '#a1a1aa' }}>{totalLoaded.toLocaleString()} article{totalLoaded !== 1 ? 's' : ''} loaded</span>
                {loadingMore && (
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: 1, color: '#D4AF37',
                    display: 'inline-flex', alignItems: 'center', gap: 5
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4AF37', display: 'inline-block', animation: 'dotBlink 1s ease infinite' }} />
                    Indexing more…
                    <style>{`@keyframes dotBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
                  </span>
                )}
                {allLoaded && !loadingMore && (
                  <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    ✓ Fully indexed
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button
            className="btn-publish-gold d-flex align-items-center gap-2"
            onClick={() => navigate('/news/create')}
          >
            <Plus size={16} /> Publish New Article
          </Button>
        </div>
      </div>

      {/* ── Control Bar ─────────────────────────────────────────────────── */}
      <div className="news-command-bar">
        {/* Search */}
        <div className="search-command-wrapper">
          <Search size={16} className="search-icon-gold" />
          <input
            type="text"
            placeholder="Search by headline, topic, region or tag…"
            className="search-input-sharp"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                color: '#71717a', cursor: 'pointer', padding: 0
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Refresh */}
        <button
          title="Refresh Archive"
          onClick={() => window.location.reload()}
          style={{
            background: 'transparent', border: '1px solid #27272a', color: '#71717a',
            width: 42, height: 42, borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#71717a'; }}
        >
          <RotateCw size={16} />
        </button>
      </div>

      {/* ── Filter Tabs (General / Others / Pending / All) ────────────────── */}
      <div className="news-pills-nav">
        {TABS.map(tab => (
          <div key={tab} className="nav-item">
            <button
              className={`nav-link${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              <span style={{ marginLeft: 6, fontSize: '0.7rem', opacity: 0.65 }}>
                {tabCounts[tab] ?? 0}
              </span>
            </button>
          </div>
        ))}
      </div>

      {/* ── Table or Empty State ──────────────────────────────────────────── */}
      {!loading && visibleNews.length === 0 ? (
        <EmptyState
          onPublish={() => navigate('/news/create')}
          isFiltered={searchTerm.trim().length > 0 || activeTab !== 'All'}
          activeTab={activeTab}
        />
      ) : (
        <NewsTable
          news={visibleNews}
          loading={loading}
          searchTerm={searchTerm}
          onDelete={handleDeleteRequest}
          onApprove={activeTab === 'Pending' ? handleApprove : undefined}
        />
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      <Modal
        show={showDeleteModal}
        onHide={() => !isDeleting && setShowDeleteModal(false)}
        centered
        contentClassName="news-delete-modal-content"
      >
        <Modal.Header closeButton={!isDeleting} closeVariant="white" style={{ border: 'none', paddingBottom: 0 }}>
          <Modal.Title style={{ color: '#DC143C', fontWeight: 800, textTransform: 'uppercase', fontSize: '1rem', letterSpacing: 1 }}>
            Delete Article
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '20px 24px 8px' }}>
          <p style={{ color: '#a1a1aa', margin: 0, lineHeight: 1.7 }}>
            Are you sure you want to permanently delete this article from the archive? This action cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer style={{ border: 'none', padding: '16px 24px 24px', gap: 10 }}>
          <Button
            onClick={() => setShowDeleteModal(false)}
            disabled={isDeleting}
            style={{ background: 'transparent', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 3, fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            disabled={isDeleting}
            style={{ background: '#DC143C', border: 'none', color: '#fff', borderRadius: 3, fontWeight: 700, padding: '8px 24px', minWidth: 140 }}
          >
            {isDeleting ? 'Deleting…' : 'Delete Permanently'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onPublish, isFiltered, activeTab }) {
  const tabMessages = {
    Pending: { title: 'No pending articles', body: 'There are no articles awaiting approval at this time.' },
    General: { title: 'No general articles', body: 'The general topics archive is empty. Publish your first general article.' },
    Others:  { title: 'No other articles', body: 'No articles in the Others category yet.' },
  };
  const msg = isFiltered
    ? { title: 'No results found', body: 'No articles match your current search or filter. Try a different query.' }
    : (tabMessages[activeTab] || { title: 'The archive is empty', body: 'Publish your first article to get started.' });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 40px', background: '#000', border: '0.5px solid #27272a',
      borderRadius: 4, textAlign: 'center', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)', opacity: 0.2 }} />
      <div style={{ marginBottom: 28, opacity: 0.5 }}><Logo width={72} /></div>
      <div style={{ marginBottom: 20 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#27272a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
          <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>
        </svg>
      </div>
      <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '1.3rem', marginBottom: 10, letterSpacing: '-0.5px' }}>
        {msg.title}
      </h3>
      <p style={{ color: '#52525b', fontSize: '0.9rem', marginBottom: 28, maxWidth: 360, lineHeight: 1.7, margin: '0 0 28px' }}>
        {msg.body}
      </p>
      {!isFiltered && activeTab !== 'Pending' && (
        <button
          onClick={onPublish}
          style={{
            background: 'transparent', border: '1px solid #D4AF37', color: '#D4AF37',
            padding: '10px 28px', borderRadius: 3, fontWeight: 700, fontSize: '0.85rem',
            letterSpacing: '0.5px', cursor: 'pointer', transition: 'all 0.25s ease', textTransform: 'uppercase'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#D4AF37'; e.currentTarget.style.color = '#000'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#D4AF37'; }}
        >
          Publish First Article
        </button>
      )}
      <ParticleBackground />
    </div>
  );
}
