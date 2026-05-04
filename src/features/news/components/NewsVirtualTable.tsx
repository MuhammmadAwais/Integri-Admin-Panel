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
    : '#52525b';
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 2,
      background: `${color}18`, border: `1px solid ${color}40`,
      color, fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize',
      whiteSpace: 'nowrap', letterSpacing: '0.3px'
    }}>
      {topic || 'general'}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Skeleton row
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonRows = () => (
  <>
    {[...Array(8)].map((_, i) => (
      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <td style={{ padding: '12px 16px' }}>
          <div className="nv-skeleton" style={{ width: 64, height: 42 }} />
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div className="nv-skeleton" style={{ width: '75%', height: 15, marginBottom: 6 }} />
          <div className="nv-skeleton" style={{ width: '40%', height: 11 }} />
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div className="nv-skeleton" style={{ width: 80, height: 15 }} />
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div className="nv-skeleton" style={{ width: 70, height: 22, borderRadius: 2 }} />
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div className="nv-skeleton" style={{ width: 90, height: 15 }} />
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div className="nv-skeleton" style={{ width: 40, height: 15 }} />
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div className="nv-skeleton" style={{ width: 20, height: 20, borderRadius: '50%' }} />
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
  onDelete?: (id: string) => void;
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
            <div style={{ color: '#e4e4e7', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>
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
          return <span style={{ color: '#52525b', fontSize: '0.8rem' }}>Global</span>;
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Globe size={11} style={{ color: '#52525b', flexShrink: 0 }} />
            <span style={{ color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600 }}>
              {countries[0]}
              {countries.length > 1 && <span style={{ color: '#52525b', marginLeft: 4 }}>+{countries.length - 1}</span>}
            </span>
          </div>
        );
      },
      size: 150,
    },
    {
      id: 'topic',
      header: 'Topic',
      accessorFn: (row) => row.topic,
      cell: ({ getValue }) => <TopicBadge topic={String(getValue() || 'general')} />,
      size: 130,
    },
    {
      id: 'date',
      header: 'Date',
      accessorFn: (row) => row.date,
      sortingFn: 'datetime',
      cell: ({ getValue }) => (
        <span style={{ color: '#71717a', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {fmt(getValue() as string)}
        </span>
      ),
      size: 130,
    },
    {
      id: 'views',
      header: 'Views',
      accessorFn: (row) => row.views,
      cell: ({ getValue }) => (
        <span style={{ color: '#a1a1aa', fontSize: '0.85rem', fontWeight: 700 }}>
          {(getValue() as number).toLocaleString()}
        </span>
      ),
      size: 80,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      size: 48,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <Dropdown onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <Dropdown.Toggle as="div" bsPrefix="no-caret" style={{ cursor: 'pointer', color: '#52525b', padding: '4px', display: 'inline-flex' }}>
              <MoreVertical size={17} />
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: 3, padding: '4px', minWidth: 170, boxShadow: '0 10px 40px rgba(0,0,0,0.7)' }}>
              <Dropdown.Item onClick={() => navigate(`/news/preview/${item.id}`)} className="nv-menu-item" style={{ color: '#e4e4e7', padding: '8px 12px', borderRadius: 2, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={13} style={{ color: '#D4AF37' }} /> View Article
              </Dropdown.Item>
              <Dropdown.Item onClick={() => navigate(`/news/edit/${item.id}`)} className="nv-menu-item" style={{ color: '#e4e4e7', padding: '8px 12px', borderRadius: 2, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={13} style={{ color: '#D4AF37' }} /> Edit Article
              </Dropdown.Item>
              {onDelete && (
                <>
                  <Dropdown.Divider style={{ borderColor: '#27272a', margin: '4px 0' }} />
                  <Dropdown.Item onClick={() => onDelete(item.id)} className="nv-menu-item-danger" style={{ color: '#DC143C', padding: '8px 12px', borderRadius: 2, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Trash2 size={13} /> Delete
                  </Dropdown.Item>
                </>
              )}
            </Dropdown.Menu>
          </Dropdown>
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
          background: rgba(212,175,55,0.07);
          border-radius: 2px;
          animation: nvSkeletonPulse 1.8s ease infinite;
        }
        @keyframes nvSkeletonPulse {
          0%,100% { opacity: 0.35; }
          50% { opacity: 0.65; }
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

      <div className="card" style={{ overflow: 'hidden', border: '1px solid #27272a', borderRadius: 3, background: '#000' }}>
        {/* Scrollable wrapper — virtualizer scrolls here */}
        <div
          ref={scrollRef}
          className="table-responsive"
          style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 310px)', minHeight: 300 }}
        >
          <table ref={tableRef} className="table mb-0" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead style={{ background: 'rgba(212,175,55,0.04)', position: 'sticky', top: 0, zIndex: 2, backdropFilter: 'blur(8px)' }}>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} style={{ borderBottom: '1px solid #27272a' }}>
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
              {loading ? (
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
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                        onClick={() => onRowClick(row.original.id)}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td
                            key={cell.id}
                            style={{ padding: '12px 16px', verticalAlign: 'middle', borderBottom: 'none', color: '#e4e4e7' }}
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
        <div style={{ background: 'rgba(0,0,0,0.5)', borderTop: '1px solid #27272a', padding: '11px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#52525b', fontSize: '0.8rem', fontWeight: 600 }}>
            {loading ? 'Fetching…' : (
              <><span style={{ color: '#D4AF37' }}>{articles.length.toLocaleString()}</span> of <span style={{ color: '#a1a1aa' }}>{total.toLocaleString()}</span> articles</>
            )}
          </span>
          <span style={{ color: '#3f3f46', fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Virtualized · {articles.length} rows in DOM-efficient view
          </span>
        </div>
      </div>
    </>
  );
};

export default NewsVirtualTable;
