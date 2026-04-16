import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable
} from '@tanstack/react-table';
import { gsap } from 'gsap';
import Dropdown from 'react-bootstrap/Dropdown';
import { MoreVertical, Edit3, Trash2, Eye } from 'lucide-react';

// ── Highlight helper ────────────────────────────────────────────────────────
const Hl = ({ text, q }) => {
  if (!q || !text) return <>{text}</>;
  const parts = String(text).split(new RegExp(`(${q})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase()
          ? <span key={i} style={{ color: '#DC143C', fontWeight: 900 }}>{p}</span>
          : p
      )}
    </>
  );
};

// ── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const isActive = status === 'Published' || status === 'Active';
  return (
    <span style={{
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '0.7rem',
      textTransform: 'uppercase',
      fontWeight: 700,
      letterSpacing: '0.5px',
      backgroundColor: isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(113, 113, 122, 0.15)',
      color: isActive ? '#22c55e' : '#71717a',
      border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'rgba(113,113,122,0.3)'}`
    }}>
      {isActive ? 'Published' : 'Draft'}
    </span>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  NewsTable Component
// ══════════════════════════════════════════════════════════════════════════════
const NewsTable = ({ news, loading, searchTerm, onDelete, onStatusToggle }) => {
  const navigate = useNavigate();
  const tableRef = useRef(null);
  const [sorting, setSorting] = useState([]);

  const columns = useMemo(() => [
    {
      id: 'thumb',
      header: '',
      cell: ({ row }) => {
        const src = row.original.coverImageUrl;
        return src ? (
          <img
            src={src}
            alt="cover"
            style={{
              width: 64,
              height: 42,
              objectFit: 'cover',
              borderRadius: 2,
              border: '1px solid rgba(212,175,55,0.3)',
              display: 'block'
            }}
          />
        ) : (
          <div style={{
            width: 64, height: 42,
            background: 'rgba(212,175,55,0.05)',
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        );
      },
      enableSorting: false,
      size: 80
    },
    {
      accessorKey: 'heading',
      header: 'Headline',
      cell: ({ row, getValue }) => (
        <div>
          <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '0.95rem', marginBottom: 3 }}>
            <Hl text={getValue()} q={searchTerm} />
          </div>
          <div style={{ color: '#71717a', fontSize: '0.78rem', fontWeight: 600 }}>
            {row.original.topic || 'General'}
            {row.original.sourceName && ` · ${row.original.sourceName}`}
          </div>
        </div>
      )
    },
    {
      accessorKey: 'countries',
      header: 'Region',
      cell: ({ getValue }) => {
        const countries = getValue() || [];
        return countries.length > 0 ? (
          <span style={{
            padding: '3px 10px', borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.8rem', color: '#e4e4e7'
          }}>
            {countries[0]}{countries.length > 1 && ` +${countries.length - 1}`}
          </span>
        ) : (
          <span style={{ color: '#52525b', fontSize: '0.8rem' }}>Global</span>
        );
      },
      size: 130
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ getValue }) => {
        const tags = getValue() || [];
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tags.slice(0, 2).map(tag => (
              <span key={tag} style={{
                padding: '2px 8px', borderRadius: 12,
                background: 'rgba(212,175,55,0.08)',
                border: '1px solid rgba(212,175,55,0.2)',
                fontSize: '0.72rem', color: '#D4AF37', fontWeight: 600
              }}>
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span style={{ color: '#52525b', fontSize: '0.72rem' }}>+{tags.length - 2}</span>
            )}
          </div>
        );
      },
      size: 160,
      enableSorting: false
    },
    {
      accessorKey: 'releaseDate',
      header: 'Release Date',
      cell: ({ getValue }) => {
        const v = getValue();
        if (!v) return <span style={{ color: '#52525b' }}>—</span>;
        return (
          <span style={{ color: '#a1a1aa', fontSize: '0.85rem', fontWeight: 600 }}>
            {new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        );
      },
      size: 130
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      size: 110
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <Dropdown onClick={e => e.stopPropagation()}>
            <Dropdown.Toggle
              as="div"
              style={{ cursor: 'pointer', color: '#52525b', padding: '4px', display: 'inline-flex' }}
              bsPrefix="no-caret"
            >
              <MoreVertical size={18} />
            </Dropdown.Toggle>
            <Dropdown.Menu style={{
              background: '#09090b',
              border: '1px solid #27272a',
              borderRadius: 4,
              padding: '4px',
              minWidth: 160,
              boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
            }}>
              <Dropdown.Item
                onClick={() => navigate(`/news/preview/${item.id}`)}
                style={{ color: '#e4e4e7', padding: '8px 12px', borderRadius: 3, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}
                className="news-menu-item"
              >
                <Eye size={14} style={{ color: '#D4AF37' }} /> View Article
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => navigate(`/news/edit/${item.id}`)}
                style={{ color: '#e4e4e7', padding: '8px 12px', borderRadius: 3, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}
                className="news-menu-item"
              >
                <Edit3 size={14} style={{ color: '#D4AF37' }} /> Edit Article
              </Dropdown.Item>
              <Dropdown.Divider style={{ borderColor: '#27272a', margin: '4px 0' }} />
              <Dropdown.Item
                onClick={() => onDelete(item.id)}
                style={{ color: '#DC143C', padding: '8px 12px', borderRadius: 3, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}
                className="news-menu-item-danger"
              >
                <Trash2 size={14} /> Delete
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        );
      },
      enableSorting: false,
      size: 50
    }
  ], [navigate, searchTerm, onDelete, onStatusToggle]);

  const table = useReactTable({
    data: news,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } }
  });

  // GSAP row stagger
  useEffect(() => {
    if (tableRef.current && !loading && news.length > 0) {
      const rows = tableRef.current.querySelectorAll('tbody tr');
      gsap.killTweensOf(rows);
      gsap.fromTo(rows,
        { x: -15, opacity: 0 },
        { x: 0, opacity: 1, stagger: 0.04, duration: 0.45, ease: 'power2.out', delay: 0.05 }
      );
    }
  }, [loading, news.length]);

  return (
    <>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        .skeleton-cell {
          background: rgba(212,175,55,0.08);
          border-radius: 3px;
          height: 20px;
          animation: skeletonPulse 1.8s ease infinite;
        }
        .news-table-row {
          cursor: pointer;
          transition: background 0.15s ease;
          border-bottom: 1px solid rgba(255,255,255,0.04) !important;
        }
        .news-table-row:hover {
          background: rgba(212,175,55,0.04) !important;
        }
        .news-table-row:hover td { border-color: transparent !important; }
        .news-menu-item:hover { background: rgba(212,175,55,0.08) !important; color: #fff !important; }
        .news-menu-item-danger:hover { background: rgba(220,20,60,0.1) !important; }
        [bsprefix="no-caret"]::after { display: none !important; }
      `}</style>

      <div className="card" style={{ overflow: 'hidden', borderRadius: 4, border: '1px solid #27272a', background: '#000' }}>
        <div className="card-body p-0">
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table ref={tableRef} className="table mb-0" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'rgba(212,175,55,0.05)', position: 'sticky', top: 0, zIndex: 2, backdropFilter: 'blur(8px)' }}>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id} style={{ borderBottom: '1px solid #27272a' }}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          padding: '14px 16px',
                          color: '#D4AF37',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                          borderBottom: 'none',
                          whiteSpace: 'nowrap',
                          width: header.column.columnDef.size ? `${header.column.columnDef.size}px` : 'auto'
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted()] ?? null}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {[80, 300, 130, 160, 130, 110, 50].map((w, j) => (
                        <td key={j} style={{ padding: '14px 16px', borderBottom: 'none', verticalAlign: 'middle' }}>
                          <div className="skeleton-cell" style={{ width: j === 0 ? '64px' : `${Math.min(w * 0.7, 180)}px`, height: j === 0 ? '42px' : '18px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : table.getRowModel().rows.length === 0 ? null : (
                  table.getRowModel().rows.map(row => (
                    <tr
                      key={row.id}
                      className="news-table-row"
                      onClick={() => navigate(`/news/preview/${row.original.id}`)}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} style={{ padding: '12px 16px', verticalAlign: 'middle', borderBottom: 'none', color: '#e4e4e7' }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="card-footer d-flex align-items-center justify-content-between" style={{
          background: 'rgba(0,0,0,0.5)',
          borderTop: '1px solid #27272a',
          padding: '12px 20px'
        }}>
          <span style={{ color: '#71717a', fontSize: '0.82rem' }}>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
            &nbsp;·&nbsp;
            <span style={{ color: '#a1a1aa' }}>{news.length} articles</span>
          </span>
          <div className="d-flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              style={{
                background: 'transparent',
                border: '1px solid #27272a',
                color: table.getCanPreviousPage() ? '#D4AF37' : '#3f3f46',
                padding: '5px 16px',
                borderRadius: 3,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: table.getCanPreviousPage() ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
              }}
            >
              Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              style={{
                background: 'transparent',
                border: '1px solid #27272a',
                color: table.getCanNextPage() ? '#D4AF37' : '#3f3f46',
                padding: '5px 16px',
                borderRadius: 3,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: table.getCanNextPage() ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NewsTable;
