import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { Plus, Search, RotateCw } from 'lucide-react';

// project-imports
import Logo from 'components/Logo';
import { useNews } from 'features/news/hooks/useNews';
import NewsTable from 'features/news/components/NewsTable';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { db } from 'lib/firebase/firebase';
import { collection, addDoc } from 'firebase/firestore';
import ParticleBackground from 'components/ParticleBackground';
// styles
import 'features/news/styles/news.scss';

// ══════════════════════════════════════════════════════════════════════════════
//  NewsPage — Main archive with table layout
// ══════════════════════════════════════════════════════════════════════════════
export default function NewsPage() {
  const navigate = useNavigate();
  const {
    news,
    loading,
    searchTerm,
    setSearchTerm,
    deleteNews,
    updateStatus
  } = useNews();

  const [activeTab, setActiveTab] = useState('All');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const headerRef = useRef(null);

  // Entrance animation for page header
  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current.children,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, []);

  // Tab filtering
  const tabItems = {
    All: news,
    Published: news.filter(n => n.status === 'Published' || n.status === 'Active'),
    Drafts: news.filter(n => n.status === 'Draft' || !n.status),
    Economy: news.filter(n => n.topic === 'Economy'),
    Technology: news.filter(n => n.topic === 'Technology'),
  };

  const filtered = (tabItems[activeTab] || news).filter(n => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (n.heading || '').toLowerCase().includes(q) ||
      (n.topic || '').toLowerCase().includes(q) ||
      (n.sourceName || '').toLowerCase().includes(q) ||
      (n.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (n.countries || []).some(c => c.toLowerCase().includes(q))
    );
  });

  const handleDeleteRequest = (id) => {
    setItemToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteNews(itemToDelete);
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  const seedDummyData = async () => {
    const dummyNews = [
      {
        heading: "Global Markets Pivot: Interdependent Economies Signal Resilience Amid Quantitative Shifts",
        topic: "Economy",
        tags: ["Finance", "Global", "Markets"],
        countries: ["United Kingdom", "United States", "Germany"],
        sourceName: "Financial Narrative",
        sourceUrl: "https://example.com/finance",
        status: "Published",
        releaseDate: new Date().toISOString().split('T')[0],
        coverImageUrl: "https://images.unsplash.com/photo-1611974717482-536412f7169a?q=80&w=1000",
        blocks: [
          { type: 'text', content: 'Leading analysts suggest a shift in quantitative measures as major central banks maintain a cautious stance on interest rate adjustments.' },
          { type: 'image', url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?q=80&w=1000', caption: 'Central Bank Headquarters Analysis' }
        ]
      },
      {
        heading: "Neural-Mesh Integration: The Frontier of Silicon-Biological Interfaces",
        topic: "Technology",
        tags: ["BioTech", "Silicon", "Integration"],
        countries: ["Japan", "South Korea"],
        sourceName: "Tech Horizon",
        sourceUrl: "https://example.com/tech",
        status: "Published",
        releaseDate: new Date().toISOString().split('T')[0],
        coverImageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000",
        blocks: [
          { type: 'text', content: 'The integration of biological neural pathways with high-speed silicon mesh platforms has reached a critical milestone in pilot testing.' },
          { type: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4', thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000' }
        ]
      },
      {
        heading: "Infrastructure Recalibration: Urban Density and Transit-Oriented Development",
        topic: "Regional",
        tags: ["Urban", "Transit", "Infrastructure"],
        countries: ["Pakistan", "UAE"],
        sourceName: "Metropolis Update",
        sourceUrl: "https://example.com/regional",
        status: "Draft",
        releaseDate: new Date().toISOString().split('T')[0],
        coverImageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1000",
        blocks: [
          { type: 'text', content: 'Future urban planning initiatives are focusing on high-density mixed-use developments to reduce transit friction.' }
        ]
      }
    ];

    try {
      for (const item of dummyNews) {
        await addDoc(collection(db, 'News'), item);
      }
      alert("Dummy data seeded successfully!");
    } catch (error) {
      console.error("Error seeding data:", error);
      alert("Failed to seed data.");
    }
  };

  const TABS = ['All', 'Published', 'Drafts', 'Economy', 'Technology'];

  return (
    <div className="news-glass-archive">
      <ParticleBackground />
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div ref={headerRef} className="news-command-header">
        <div>
          <h2 className="news-title-sharp">News Management</h2>
          <p style={{ color: '#71717a', margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>
            {news.length} article{news.length !== 1 ? 's' : ''} in the archive
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button
            variant="outline-secondary"
            className="d-flex align-items-center gap-2"
            style={{ borderRadius: 4, fontWeight: 600, fontSize: '0.85rem' }}
            onClick={seedDummyData}
          >
            Seed UI Data
          </Button>
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
            placeholder="Search by headline, topic, region or tag..."
            className="search-input-sharp"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 0 }}
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
            width: 42, height: 42, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#71717a'; }}
        >
          <RotateCw size={16} />
        </button>
      </div>

      {/* ── Filter Tabs ──────────────────────────────────────────────────── */}
      <div className="news-pills-nav">
        {TABS.map(tab => (
          <div key={tab} className="nav-item">
            <button
              className={`nav-link${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tab !== 'All' && (
                <span style={{
                  marginLeft: 6,
                  fontSize: '0.7rem',
                  opacity: 0.7
                }}>
                  {tabItems[tab]?.length || 0}
                </span>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* ── Table or Empty State ─────────────────────────────────────────── */}
      {!loading && filtered.length === 0 ? (
        <EmptyState onPublish={() => navigate('/news/create')} isFiltered={searchTerm.trim().length > 0 || activeTab !== 'All'} />
      ) : (
        <NewsTable
          news={filtered}
          loading={loading}
          searchTerm={searchTerm}
          onDelete={handleDeleteRequest}
          onStatusToggle={updateStatus}
        />
      )}

      {/* ── Delete Modal ─────────────────────────────────────────────────── */}
      <Modal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        centered
        contentClassName="news-delete-modal-content"
      >
        <Modal.Header closeButton closeVariant="white" style={{ border: 'none', paddingBottom: 0 }}>
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
            style={{ background: 'transparent', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 3, fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            style={{ background: '#DC143C', border: 'none', color: '#fff', borderRadius: 3, fontWeight: 700, padding: '8px 24px' }}
          >
            Delete Permanently
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onPublish, isFiltered }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 40px',
      background: '#000',
      border: '0.5px solid #27272a',
      borderRadius: 4,
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle top accent line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
        opacity: 0.25
      }} />

      {/* Logo */}
      <div style={{ marginBottom: 28, opacity: 0.6 }}>
        <Logo width={80} />
      </div>

      {/* Newspaper icon */}
      <div style={{ marginBottom: 20 }}>
        <svg
          width="52" height="52"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#27272a"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
          <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>
        </svg>
      </div>

      <h3 style={{
        color: '#fff',
        fontWeight: 800,
        fontSize: '1.4rem',
        marginBottom: 10,
        letterSpacing: '-0.5px'
      }}>
        {isFiltered ? 'No results found' : 'We have no news at the moment'}
      </h3>

      <p style={{
        color: '#52525b',
        fontSize: '0.9rem',
        marginBottom: 28,
        maxWidth: 380,
        lineHeight: 1.7,
        margin: '0 0 28px'
      }}>
        {isFiltered
          ? 'No articles match your current search or filter. Try a different query.'
          : 'The archive is empty. Publish your first article to get started.'}
      </p>

      {!isFiltered && (
        <button
          onClick={onPublish}
          style={{
            background: 'transparent',
            border: '1px solid #D4AF37',
            color: '#D4AF37',
            padding: '10px 28px',
            borderRadius: 3,
            fontWeight: 700,
            fontSize: '0.85rem',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            textTransform: 'uppercase'
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
