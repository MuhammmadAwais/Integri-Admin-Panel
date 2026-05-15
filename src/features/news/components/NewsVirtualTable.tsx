import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { gsap } from 'gsap';
import Dropdown from 'react-bootstrap/Dropdown';
import { MoreVertical, Edit3, Eye, Trash2, TrendingUp, Globe } from 'lucide-react';
import type { ArticleSummary } from 'api/backendApi';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch {
    return '—';
  }
}

const TopicBadge = ({ topic }: { topic: string }) => {
  const color = topic === 'technology' ? '#7c3aed'
    : topic === 'general' ? '#0ea5e9'
    : '#71717a';
  
  // Truncate topic if it's too long (more than 4 words)
  const words = (topic || 'general').split(' ');
  const truncated = words.length > 4 ? words.slice(0, 4).join(' ') + '...' : topic || 'general';

  return (
    <span 
      title={topic} // Show full topic on hover
      style={{
        padding: '3px 10px', borderRadius: 2,
        background: `${color}15`, border: `1px solid ${color}35`,
        color, fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize',
        whiteSpace: 'nowrap', letterSpacing: '0.3px',
        display: 'inline-block',
      }}
    >
      {truncated}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Skeleton row
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonRows = () => (
  <>
    {[...Array(15)].map((_, i) => (
      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <td style={{ padding: '12px 16px', width: 80 }}>
          <div className="nv-skeleton" style={{ width: 42, height: 42, borderRadius: '50%' }} />
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div className="nv-skeleton" style={{ width: '75%', height: 16, marginBottom: 8 }} />
          <div className="nv-skeleton" style={{ width: '40%', height: 11 }} />
        </td>
        <td style={{ padding: '12px 16px', width: 140 }}>
          <div className="nv-skeleton" style={{ width: 80, height: 14 }} />
        </td>
        <td style={{ padding: '12px 16px', width: 160 }}>
          <div className="nv-skeleton" style={{ width: 70, height: 22, borderRadius: 2 }} />
        </td>
        <td style={{ padding: '12px 16px', width: 120 }}>
          <div className="nv-skeleton" style={{ width: 90, height: 14 }} />
        </td>
        <td style={{ padding: '12px 16px', width: 70 }}>
          <div className="nv-skeleton" style={{ width: 40, height: 14 }} />
        </td>
        <td style={{ padding: '12px 16px', width: 48 }}>
          <div className="nv-skeleton" style={{ width: 16, height: 20 }} />
        </td>
      </tr>
    ))}
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  articles: ArticleSummary[];
  loading: boolean;
  total: number;
  onRowClick: (id: string) => void;
  onDelete?: (id: string, collection: string) => void;
}

const OVERSCAN = 5;
const ROW_HEIGHT = 68; // px — estimated row height for virtualizer

const NewsVirtualTable: React.FC<Props> = ({ articles, loading, total, onRowClick, onDelete }) => {
  const navigate  = useNavigate();
  const tableRef  = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  // ── Column definitions ────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<ArticleSummary>[]>(() => [
    {
      id: 'thumb',
      header: '',
      cell: ({ row }) => {
        const src = row.original.coverImage;
        return src ? (
          <img
            src={src}
            alt="cover"
            loading="lazy"
            style={{ width: 64, height: 42, objectFit: 'cover', borderRadius: 2, border: '1px solid rgba(212,175,55,0.25)', display: 'block', flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 64, height: 42, background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        );
      },
      enableSorting: false,
      size: 80,
    },
    {
      id: 'headline',
      header: 'Headline',
      accessorFn: (row) => row.headline_en || '',
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--news-text-main)', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>
              {a.headline_en || a.headline_de || '—'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {a.markAsTrending && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 10, background: 'rgba(220,20,60,0.1)', border: '1px solid rgba(220,20,60,0.25)', color: '#DC143C', fontSize: '0.68rem', fontWeight: 700 }}>
                  <TrendingUp size={8} /> Trending
                </span>
              )}
              {a.isAiCompiled && (
                <span style={{ padding: '1px 6px', borderRadius: 10, background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.18)', color: '#D4AF37', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.3px' }}>
                  AI
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'country',
      header: 'Country',
      accessorFn: (row) => (row.forCountries || []).join(', '),
      cell: ({ row }) => {
        const countries = row.original.forCountries || [];
        if (countries.length === 0) {
          return <span style={{ color: 'var(--news-text-dim)', fontSize: '0.8rem' }}>Global</span>;
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Globe size={11} style={{ color: 'var(--news-text-dim)', flexShrink: 0 }} />
            <span style={{ color: 'var(--news-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
              {countries[0]}
              {countries.length > 1 && <span style={{ color: 'var(--news-text-dim)', marginLeft: 4 }}>+{countries.length - 1}</span>}
            </span>
          </div>
        );
      },
      size: 140,
    },
    {
      id: 'topic',
      header: 'Topic',
      accessorFn: (row) => row.topic,
      cell: ({ getValue }) => <TopicBadge topic={String(getValue() || 'general')} />,
      size: 160,
    },
    {
      id: 'date',
      header: 'Date',
      accessorFn: (row) => row.date,
      sortingFn: 'datetime',
      cell: ({ getValue }) => (
        <span style={{ color: 'var(--news-text-muted)', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {fmt(getValue() as string)}
        </span>
      ),
      size: 120,
    },
    {
      id: 'views',
      header: 'Views',
      accessorFn: (row) => row.views,
      cell: ({ getValue }) => (
        <span style={{ color: 'var(--news-text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>
          {(getValue() as number).toLocaleString()}
        </span>
      ),
      size: 70,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      size: 80,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div 
              onClick={(e) => { e.stopPropagation(); navigate(`/news/preview/${item.id}`); }}
              style={{ 
                cursor: 'pointer', 
                color: 'var(--news-text-dim)', 
                padding: '6px', 
                display: 'inline-flex',
                transition: 'all 0.2s ease',
                borderRadius: 4
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#D4AF37'; e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--news-text-dim)'; e.currentTarget.style.background = 'transparent'; }}
              title="View Full Article"
            >
              <Eye size={18} />
            </div>
            {onDelete && (
              <div 
                onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.collection || 'News'); }}
                style={{ 
                  cursor: 'pointer', 
                  color: 'var(--news-text-dim)', 
                  padding: '6px', 
                  display: 'inline-flex',
                  transition: 'all 0.2s ease',
                  borderRadius: 4
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--news-text-dim)'; e.currentTarget.style.background = 'transparent'; }}
                title="Delete Article"
              >
                <Trash2 size={18} />
              </div>
            )}
          </div>
        );
      },
    },
  ], [navigate, onDelete]);

  // ── TanStack Table ────────────────────────────────────────────────────────
  const table = useReactTable({
    data: articles,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  // ── Row Virtualizer ───────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop    = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0;

  // ── GSAP entrance on data load ────────────────────────────────────────────
  useEffect(() => {
    if (!loading && articles.length > 0 && tableRef.current) {
      const cells = tableRef.current.querySelectorAll('tbody tr');
      gsap.killTweensOf(cells);
      gsap.fromTo(cells, { opacity: 0, x: -12 }, { opacity: 1, x: 0, stagger: 0.025, duration: 0.35, ease: 'power2.out', delay: 0.04 });
    }
  }, [loading, articles.length]);

  return (
    <>
      <style>{`
        .nv-skeleton {
          background: rgba(212,175,55,0.1);
          border: 1px solid rgba(212,175,55,0.2);
          border-radius: 4px;
          animation: glowPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes glowPulse {
          0% { opacity: 0.3; }
          50% { opacity: 0.7; }
          100% { opacity: 0.3; }
        }
        .nv-row {
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .nv-row:hover { background: rgba(212,175,55,0.03) !important; }
        .nv-row:hover td { border-color: transparent !important; }
        .nv-menu-item:hover { background: rgba(212,175,55,0.08) !important; color: #fff !important; }
        .nv-menu-item-danger:hover { background: rgba(220,20,60,0.1) !important; }
        [bsprefix="no-caret"]::after { display: none !important; }
      `}</style>

      <div className="card" style={{ overflow: 'hidden', border: '1px solid var(--news-card-border)', borderRadius: 3, background: 'var(--news-card-bg)' }}>
        {/* Scrollable wrapper — virtualizer scrolls here */}
        <div
          ref={scrollRef}
          className="table-responsive"
          style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 310px)', minHeight: 300 }}
        >
          <table ref={tableRef} className="table mb-0" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead style={{ background: 'var(--news-table-header-bg)', position: 'sticky', top: 0, zIndex: 2, backdropFilter: 'blur(8px)' }}>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} style={{ borderBottom: '1px solid var(--news-card-border)' }}>
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        padding: '13px 16px',
                        color: '#D4AF37',
                        fontWeight: 700,
                        fontSize: '0.74rem',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        whiteSpace: 'nowrap',
                        width: header.column.columnDef.size ? `${header.column.columnDef.size}px` : 'auto',
                        userSelect: 'none',
                        borderBottom: 'none',
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading && articles.length === 0 ? (
                <SkeletonRows />
              ) : articles.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center', color: '#52525b', fontSize: '0.9rem' }}>
                    No articles found for the selected window.
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr><td colSpan={7} style={{ height: `${paddingTop}px`, padding: 0, border: 'none' }} /></tr>
                  )}
                  {virtualRows.map(virtualRow => {
                    const row = rows[virtualRow.index];
                    return (
                      <tr
                        key={row.id}
                        className="nv-row"
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{ 
                          borderBottom: '1px solid var(--news-card-border)', 
                          opacity: loading ? 0.6 : 1,
                          transition: 'opacity 0.2s ease'
                        }}
                        onClick={() => onRowClick(row.original.id)}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td
                            key={cell.id}
                            style={{ padding: '12px 16px', verticalAlign: 'middle', borderBottom: 'none', color: 'var(--news-text-main)' }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr><td colSpan={7} style={{ height: `${paddingBottom}px`, padding: 0, border: 'none' }} /></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--news-card-border)', padding: '11px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--news-text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
            {loading ? 'Fetching…' : (
              <><span style={{ color: '#D4AF37' }}>{articles.length.toLocaleString()}</span> of <span style={{ color: 'var(--news-text-muted)' }}>{total.toLocaleString()}</span> articles</>
            )}
          </span>
          <span style={{ color: 'var(--news-text-dim)', fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Virtualized · {articles.length} rows
          </span>
        </div>
      </div>
    </>
  );
};

export default NewsVirtualTable;
