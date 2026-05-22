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
import { Edit3, Eye, Trash2, Globe, FileText, Calendar, Clock, BarChart2 } from 'lucide-react';
import { BlogPost, BlogCategory } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

const CategoryBadge = ({ category }: { category: BlogCategory }) => {
  const categoryColors: Record<BlogCategory, string> = {
    'General': '#71717a',
    'Trending': '#ef4444',
    'AI & Deep Learning': '#3b82f6',
    'Web Development': '#06b6d4',
    'Software Architecture': '#8b5cf6',
    'Tutorials': '#10b981',
    'Tech Insights': '#f59e0b',
  };

  const color = categoryColors[category] || '#71717a';

  return (
    <span
      title={category}
      style={{
        padding: '3px 10px',
        borderRadius: '2px',
        background: `${color}12`,
        border: `1px solid ${color}33`,
        color,
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
        letterSpacing: '0.3px',
        display: 'inline-block',
      }}
    >
      {category}
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
        <td style={{ padding: '12px 16px', width: 80 }}>
          <div className="bv-skeleton" style={{ width: 64, height: 42, borderRadius: 2 }} />
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div className="bv-skeleton" style={{ width: '65%', height: 16, marginBottom: 8 }} />
          <div className="bv-skeleton" style={{ width: '20%', height: 11 }} />
        </td>
        <td style={{ padding: '12px 16px', width: 150 }}>
          <div className="bv-skeleton" style={{ width: 100, height: 20, borderRadius: 2 }} />
        </td>
        <td style={{ padding: '12px 16px', width: 120 }}>
          <div className="bv-skeleton" style={{ width: 80, height: 14 }} />
        </td>
        <td style={{ padding: '12px 16px', width: 80 }}>
          <div className="bv-skeleton" style={{ width: 45, height: 14 }} />
        </td>
        <td style={{ padding: '12px 16px', width: 80 }}>
          <div className="bv-skeleton" style={{ width: 40, height: 14 }} />
        </td>
        <td style={{ padding: '12px 16px', width: 100 }}>
          <div className="bv-skeleton" style={{ width: 64, height: 28 }} />
        </td>
      </tr>
    ))}
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Memoized Row Component
//  Prevent parent-level re-render cycles during scroll and status/view edits
// ─────────────────────────────────────────────────────────────────────────────
interface BlogTableRowProps {
  row: any;
  virtualRow: any;
  measureElement: (el: HTMLElement | null) => void;
  onRowClick: (id: string) => void;
  onDelete?: (id: string) => void;
  loading: boolean;
}

const BlogTableRow = React.memo<BlogTableRowProps>(
  ({ row, virtualRow, measureElement, onRowClick, onDelete, loading }) => {
    return (
      <tr
        className="bv-row"
        data-index={virtualRow.index}
        ref={measureElement}
        style={{
          borderBottom: '1px solid var(--news-card-border)',
          opacity: loading ? 0.6 : 1,
          transition: 'opacity 0.2s ease',
        }}
        onClick={() => onRowClick(row.original.id)}
        role="row"
      >
        {row.getVisibleCells().map((cell: any) => (
          <td
            key={cell.id}
            style={{
              padding: '12px 16px',
              verticalAlign: 'middle',
              borderBottom: 'none',
              color: 'var(--news-text-main)',
            }}
            role="cell"
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    );
  },
  (prev, next) => {
    // Prevent re-render if the core data values we render haven't changed
    const pData = prev.row.original;
    const nData = next.row.original;
    return (
      pData.id === nData.id &&
      pData.headline === nData.headline &&
      pData.category === nData.category &&
      pData.coverImage === nData.coverImage &&
      pData.views === nData.views &&
      pData.status === nData.status &&
      pData.createdAt === nData.createdAt &&
      prev.virtualRow.start === next.virtualRow.start &&
      prev.virtualRow.end === next.virtualRow.end &&
      prev.loading === next.loading
    );
  }
);

BlogTableRow.displayName = 'BlogTableRow';

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  blogs: BlogPost[];
  loading: boolean;
  onRowClick: (id: string) => void;
  onDelete?: (id: string) => void;
}

const ROW_HEIGHT = 68;
const OVERSCAN = 5;

export const BlogsVirtualTable: React.FC<Props> = ({
  blogs,
  loading,
  onRowClick,
  onDelete,
}) => {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Columns definition
  const columns = useMemo<ColumnDef<BlogPost>[]>(
    () => [
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
              style={{
                width: 64,
                height: 42,
                objectFit: 'cover',
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'block',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 42,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={18} style={{ color: '#4b5563' }} />
            </div>
          );
        },
        enableSorting: false,
        size: 80,
      },
      {
        id: 'headline',
        header: 'Headline',
        accessorFn: (row) => row.headline,
        cell: ({ row }) => {
          const b = row.original;
          const isDraft = b.status === 'draft';
          return (
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: 'var(--news-text-main)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  lineHeight: 1.4,
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 400,
                }}
              >
                {b.headline || 'Untitled Post'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: 2,
                    background: isDraft ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                    border: isDraft
                      ? '1px solid rgba(245,158,11,0.2)'
                      : '1px solid rgba(16,185,129,0.2)',
                    color: isDraft ? '#f59e0b' : '#10b981',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                  }}
                >
                  {b.status}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'category',
        header: 'Category',
        accessorFn: (row) => row.category,
        cell: ({ getValue }) => <CategoryBadge category={getValue() as BlogCategory} />,
        size: 150,
      },
      {
        id: 'date',
        header: 'Date',
        accessorFn: (row) => row.createdAt,
        sortingFn: 'datetime',
        cell: ({ getValue }) => (
          <span
            style={{
              color: 'var(--news-text-muted)',
              fontSize: '0.8rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {formatDate(getValue() as string)}
          </span>
        ),
        size: 120,
      },
      {
        id: 'time',
        header: 'Time',
        accessorFn: (row) => row.createdAt,
        cell: ({ getValue }) => (
          <span
            style={{
              color: 'var(--news-text-muted)',
              fontSize: '0.8rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {formatTime(getValue() as string)}
          </span>
        ),
        size: 80,
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
        size: 80,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        size: 100,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="bv-btn-action"
                onClick={() => navigate(`/blogs/builder?id=${item.id}`)}
                aria-label={`Edit blog post: ${item.headline}`}
                title="Edit Post"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--news-text-dim)',
                  padding: '6px',
                  display: 'inline-flex',
                  transition: 'all 0.2s ease',
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#D4AF37';
                  e.currentTarget.style.background = 'rgba(212,175,55,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--news-text-dim)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Edit3 size={18} />
              </button>
              {onDelete && (
                <button
                  type="button"
                  className="bv-btn-action bv-btn-danger"
                  onClick={() => onDelete(item.id)}
                  aria-label={`Delete blog post: ${item.headline}`}
                  title="Delete Post"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--news-text-dim)',
                    padding: '6px',
                    display: 'inline-flex',
                    transition: 'all 0.2s ease',
                    borderRadius: 4,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ef4444';
                    e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--news-text-dim)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [navigate, onDelete]
  );

  // TanStack table initialization
  const table = useReactTable({
    data: blogs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  // React Virtualizer setup
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  // GSAP intro animation on load
  useEffect(() => {
    if (!loading && blogs.length > 0 && tableRef.current) {
      const rowElements = tableRef.current.querySelectorAll('tbody tr');
      gsap.killTweensOf(rowElements);
      gsap.fromTo(
        rowElements,
        { opacity: 0, x: -10 },
        {
          opacity: 1,
          x: 0,
          stagger: 0.02,
          duration: 0.3,
          ease: 'power1.out',
          delay: 0.02,
        }
      );
    }
  }, [loading, blogs.length]);

  return (
    <>
      <style>{`
        .bv-skeleton {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 2px;
          animation: flatPulse 1.8s ease-in-out infinite;
        }
        @keyframes flatPulse {
          0% { opacity: 0.4; }
          50% { opacity: 0.8; }
          100% { opacity: 0.4; }
        }
        .bv-row {
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .bv-row:hover {
          background: rgba(255, 255, 255, 0.02) !important;
        }
        .bv-row:hover td {
          border-color: transparent !important;
        }
        .bv-btn-action:focus-visible {
          outline: 2px solid #D4AF37 !important;
          outline-offset: 1px !important;
          background: rgba(212,175,55,0.08) !important;
        }
        .bv-btn-danger:focus-visible {
          outline: 2px solid #ef4444 !important;
          outline-offset: 1px !important;
          background: rgba(239,68,68,0.1) !important;
        }
      `}</style>

      <section
        className="card"
        style={{
          overflow: 'hidden',
          border: '1px solid var(--news-card-border)',
          borderRadius: 3,
          background: 'var(--news-card-bg)',
          boxShadow: 'none', // Strictly flat UI
        }}
      >
        {/* Scrollable table container */}
        <div
          ref={scrollRef}
          className="table-responsive"
          style={{
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 310px)',
            minHeight: 300,
          }}
        >
          <table
            ref={tableRef}
            className="table mb-0"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
            }}
            role="table"
          >
            <thead
              style={{
                background: 'var(--news-table-header-bg)',
                position: 'sticky',
                top: 0,
                zIndex: 2,
                backdropFilter: 'blur(8px)',
              }}
            >
              {table.getHeaderGroups().map((hg) => (
                <tr
                  key={hg.id}
                  style={{ borderBottom: '1px solid var(--news-card-border)' }}
                  role="row"
                >
                  {hg.headers.map((header) => (
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
                        width: header.column.columnDef.size
                          ? `${header.column.columnDef.size}px`
                          : 'auto',
                        userSelect: 'none',
                        borderBottom: 'none',
                      }}
                      role="columnheader"
                      aria-sort={
                        header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : 'none'
                      }
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody role="rowgroup">
              {loading && blogs.length === 0 ? (
                <SkeletonRows />
              ) : blogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: '60px 20px',
                      textAlign: 'center',
                      color: '#52525b',
                      fontSize: '0.9rem',
                    }}
                    role="cell"
                  >
                    No blog posts found matching your search.
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ height: `${paddingTop}px`, padding: 0, border: 'none' }}
                        role="presentation"
                      />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                      <BlogTableRow
                        key={row.id}
                        row={row}
                        virtualRow={virtualRow}
                        measureElement={virtualizer.measureElement}
                        onRowClick={onRowClick}
                        onDelete={onDelete}
                        loading={loading}
                      />
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ height: `${paddingBottom}px`, padding: 0, border: 'none' }}
                        role="presentation"
                      />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <footer
          style={{
            background: 'rgba(0,0,0,0.02)',
            borderTop: '1px solid var(--news-card-border)',
            padding: '11px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              color: 'var(--news-text-dim)',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {loading ? (
              'Fetching…'
            ) : (
              <>
                <span style={{ color: '#D4AF37' }}>{blogs.length.toLocaleString()}</span> of{' '}
                <span style={{ color: 'var(--news-text-muted)' }}>{blogs.length.toLocaleString()}</span> posts
              </>
            )}
          </span>
          <span
            style={{
              color: 'var(--news-text-dim)',
              fontSize: '0.74rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}
          >
            Virtualized · {blogs.length} rows
          </span>
        </footer>
      </section>
    </>
  );
};
