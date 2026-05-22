import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { Plus, RotateCw, Calendar, FileText, ChevronDown, Search, Database } from 'lucide-react';
import Button from 'react-bootstrap/Button';

// project-imports
import { useAdminBlogs } from 'features/blogs/hooks/useAdminBlogs';
import { BlogsVirtualTable } from 'features/blogs/components/BlogsVirtualTable';
import { BLOG_CATEGORIES, BlogCategory } from 'features/blogs/types';
import EliteModal from 'components/EliteUI/EliteModal';
import { showToast } from 'components/EliteUI/EliteToastContainer';

// styles
import 'features/news/styles/news.scss';

export default function BlogsPage() {
  const navigate = useNavigate();
  const headerRef = useRef<HTMLDivElement>(null);
  
  // ── Data Hook ─────────────────────────────────────────────────────────────
  const {
    filteredBlogs,
    loading,
    error,
    selectedCategory,
    setSelectedCategory,
    dateRange,
    setDateRange,
    searchQuery,
    setSearchQuery,
    refetch,
    deleteBlog,
    seedSampleBlogs,
    seeding,
  } = useAdminBlogs();

  // ── Local UI States ───────────────────────────────────────────────────────
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  
  // ── Debounced Search Optimization ─────────────────────────────────────────
  const [localSearch, setLocalSearch] = useState(searchQuery);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 200); // 200ms debounce
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);
  
  const categoryDropRef = useRef<HTMLDivElement>(null);
  const dateDropRef = useRef<HTMLDivElement>(null);

  // ── Delete Confirmation Modal State ───────────────────────────────────────
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Entrance Animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current.children,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, stagger: 0.05, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, []);

  // ── Close Dropdowns on Click Outside ──────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (categoryDropdownOpen && categoryDropRef.current && !categoryDropRef.current.contains(target)) {
        setCategoryDropdownOpen(false);
      }
      if (dateDropdownOpen && dateDropRef.current && !dateDropRef.current.contains(target)) {
        setDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [categoryDropdownOpen, dateDropdownOpen]);

  // ── Delete Handlers ──────────────────────────────────────────────────────
  const handleDeleteTrigger = (id: string) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBlog(deleteId);
      showToast('Blog post deleted successfully.', 'success');
    } catch (err) {
      console.error('Failed to delete blog:', err);
      showToast('Failed to delete blog. Please try again.', 'error');
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="news-glass-archive" style={{ minHeight: '100vh' }}>
      
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <header ref={headerRef} className="news-command-header">
        <div>
          <h2 className="news-title-sharp" style={{ color: '#D4AF37' }}>
            Blog Management
          </h2>
          <p
            style={{
              color: 'var(--news-text-muted)',
              margin: 0,
              fontSize: '0.84rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {loading ? (
              <span style={{ color: 'var(--news-text-dim)' }}>Fetching blogs…</span>
            ) : error ? (
              <span style={{ color: '#ef4444' }}>⚠ {error}</span>
            ) : (
              <span style={{ color: 'var(--news-text-dim)' }}>
                Total loaded:{' '}
                <span style={{ color: '#D4AF37', fontWeight: 700 }}>
                  {filteredBlogs.length}
                </span>{' '}
                post{filteredBlogs.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Seed Sample Blogs Button */}
          <Button
            className="btn-publish-gold d-flex align-items-center gap-2"
            onClick={async () => {
              try {
                await seedSampleBlogs();
                showToast('Sample blogs successfully seeded!', 'success');
              } catch (err) {
                showToast('Failed to seed sample blogs.', 'error');
              }
            }}
            disabled={seeding}
            style={{
              background: 'transparent',
              border: '1px solid #D4AF37',
              color: '#D4AF37',
              fontWeight: 700,
              fontSize: '0.85rem',
              borderRadius: 3,
              boxShadow: 'none', // Strictly flat UI
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(212,175,55,0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label="Seed sample blog data"
          >
            <Database size={16} /> {seeding ? 'Seeding...' : 'Seed Sample Blogs'}
          </Button>

          <Button
            className="btn-publish-gold d-flex align-items-center gap-2"
            onClick={() => navigate('/blogs/builder')}
            style={{
              background: '#D4AF37',
              border: 'none',
              color: '#000',
              fontWeight: 700,
              fontSize: '0.85rem',
              borderRadius: 3,
              boxShadow: 'none', // Strictly flat UI
            }}
            onMouseEnter={e => {
              e.currentTarget.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.filter = 'none';
            }}
          >
            <Plus size={16} /> New Blog Post
          </Button>
        </div>
      </header>

      {/* ── Filter Controls ──────────────────────────────────────────────── */}
      <section
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 24,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        {/* Text Search Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1, minWidth: 260 }}>
          <label
            htmlFor="blog-search-input"
            style={{
              color: '#52525b',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Search size={11} style={{ color: '#D4AF37' }} /> Search Posts
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="blog-search-input"
              type="text"
              placeholder="Search headline..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                background: 'var(--news-input-bg)',
                border: '1px solid var(--news-card-border)',
                borderRadius: 3,
                color: 'var(--news-text-main)',
                fontSize: '0.88rem',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#D4AF37';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--news-card-border)';
              }}
            />
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#52525b',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Category Dropdown */}
        <div
          ref={categoryDropRef}
          style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', minWidth: 200 }}
        >
          <label
            htmlFor="blog-category-dropdown"
            style={{
              color: '#52525b',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <FileText size={11} style={{ color: '#D4AF37' }} /> Category Filter
          </label>
          <button
            id="blog-category-dropdown"
            type="button"
            onClick={() => setCategoryDropdownOpen((o) => !o)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--news-input-bg)',
              border: `1px solid ${categoryDropdownOpen ? '#D4AF37' : 'var(--news-card-border)'}`,
              borderRadius: 3,
              color: selectedCategory === 'All' ? 'var(--news-text-dim)' : 'var(--news-text-main)',
              fontSize: '0.88rem',
              fontWeight: selectedCategory === 'All' ? 500 : 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              transition: 'border-color 0.2s ease',
            }}
          >
            <span>{selectedCategory === 'All' ? 'All Categories' : selectedCategory}</span>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--news-text-dim)',
                transition: 'transform 0.2s ease',
                transform: categoryDropdownOpen ? 'rotate(180deg)' : 'none',
                flexShrink: 0,
              }}
            />
          </button>

          {/* Category Dropdown Menu */}
          {categoryDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                zIndex: 200,
                background: 'var(--news-dropdown-bg)',
                border: '1px solid var(--news-card-border)',
                borderRadius: 3,
                minWidth: '100%',
                maxHeight: 280,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                padding: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  setCategoryDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 12px',
                  background: selectedCategory === 'All' ? 'rgba(212,175,55,0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: 2,
                  color: selectedCategory === 'All' ? '#D4AF37' : 'var(--news-text-main)',
                  fontSize: '0.85rem',
                  fontWeight: selectedCategory === 'All' ? 700 : 400,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== 'All') e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== 'All') e.currentTarget.style.background = 'transparent';
                }}
              >
                All Categories
              </button>

              <div style={{ height: 1, background: 'var(--news-card-border)', margin: '4px 0' }} />

              {BLOG_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setCategoryDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 12px',
                    background: selectedCategory === cat ? 'rgba(212,175,55,0.1)' : 'transparent',
                    border: 'none',
                    borderRadius: 2,
                    color: selectedCategory === cat ? '#D4AF37' : 'var(--news-text-main)',
                    fontSize: '0.85rem',
                    fontWeight: selectedCategory === cat ? 700 : 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCategory !== cat) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCategory !== cat) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Window Dropdown */}
        <div
          ref={dateDropRef}
          style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', minWidth: 160 }}
        >
          <label
            htmlFor="blog-date-dropdown"
            style={{
              color: '#52525b',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Calendar size={11} style={{ color: '#D4AF37' }} /> Date Window
          </label>
          <button
            id="blog-date-dropdown"
            type="button"
            onClick={() => setDateDropdownOpen((o) => !o)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--news-input-bg)',
              border: `1px solid ${dateDropdownOpen ? '#D4AF37' : 'var(--news-card-border)'}`,
              borderRadius: 3,
              color: dateRange === 'all' ? 'var(--news-text-dim)' : 'var(--news-text-main)',
              fontSize: '0.88rem',
              fontWeight: dateRange === 'all' ? 500 : 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              transition: 'border-color 0.2s ease',
            }}
          >
            <span>
              {dateRange === 'all'
                ? 'All Time'
                : dateRange === '7days'
                ? 'Last 7 Days'
                : 'Last 30 Days'}
            </span>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--news-text-dim)',
                transition: 'transform 0.2s ease',
                transform: dateDropdownOpen ? 'rotate(180deg)' : 'none',
                flexShrink: 0,
              }}
            />
          </button>

          {/* Date Dropdown Menu */}
          {dateDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                zIndex: 200,
                background: 'var(--news-dropdown-bg)',
                border: '1px solid var(--news-card-border)',
                borderRadius: 3,
                minWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '4px',
              }}
            >
              {[
                { value: 'all', label: 'All Time' },
                { value: '7days', label: 'Last 7 Days' },
                { value: '30days', label: 'Last 30 Days' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setDateRange(item.value as any);
                    setDateDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 12px',
                    background: dateRange === item.value ? 'rgba(212,175,55,0.1)' : 'transparent',
                    border: 'none',
                    borderRadius: 2,
                    color: dateRange === item.value ? '#D4AF37' : 'var(--news-text-main)',
                    fontSize: '0.85rem',
                    fontWeight: dateRange === item.value ? 700 : 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    if (dateRange !== item.value) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (dateRange !== item.value) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            title="Refresh Blogs"
            aria-label="Refresh blog listing"
            onClick={refetch}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px solid var(--news-card-border)',
              color: 'var(--news-text-muted)',
              width: 42,
              height: 42,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = '#D4AF37';
                e.currentTarget.style.color = '#D4AF37';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--news-card-border)';
              e.currentTarget.style.color = 'var(--news-text-muted)';
            }}
          >
            <RotateCw size={16} style={{ animation: loading ? 'spin 1.2s linear infinite' : 'none' }} />
          </button>
        </div>
      </section>

      {/* Spinner animation keyframe scoped styles */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Virtualized Blogs Table ────────────────────────────────────────── */}
      <main>
        <BlogsVirtualTable
          blogs={filteredBlogs}
          loading={loading}
          onRowClick={(id) => navigate(`/blogs/builder?id=${id}`)}
          onDelete={handleDeleteTrigger}
        />
      </main>

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      <EliteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteId(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Blog Post"
        confirmText="Permanently Delete"
      >
        Are you sure you want to delete this blog post? This action is permanent and cannot be undone.
      </EliteModal>
    </div>
  );
}
