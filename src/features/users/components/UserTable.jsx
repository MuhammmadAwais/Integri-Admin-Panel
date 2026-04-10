import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { MoreVertical, Eye, Search, RotateCw } from 'lucide-react';
import { gsap } from 'gsap';
import Dropdown from 'react-bootstrap/Dropdown';
import useDebounce from 'hooks/useDebounce';

const UserTable = React.memo(({ users, loading, globalFilter, setGlobalFilter, onRefresh }) => {
  const [sorting, setSorting] = useState([]);
  const [localSearch, setLocalSearch] = useState(globalFilter ?? '');
  const debouncedSearch = useDebounce(localSearch, 300);
  
  const tableRef = useRef(null);
  const navigate = useNavigate();

  // Sync debounced search to global filter parent state
  useEffect(() => {
    // Only update if they differ to prevent infinite loops from upstream propagation
    if (debouncedSearch !== globalFilter) {
      setGlobalFilter(debouncedSearch);
    }
  }, [debouncedSearch, globalFilter, setGlobalFilter]);

  // Sync upstream changes back to local (e.g., clearing filter from another component)
  useEffect(() => {
    setLocalSearch(globalFilter ?? '');
  }, [globalFilter]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'avatar',
        header: '',
        cell: info => {
          const avatarUrl = info.getValue();
          const name = info.row.original.name || '?';
          const initial = name.charAt(0).toUpperCase();
          return avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #D4AF37' }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'rgba(212,175,55,0.1)', border: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontWeight: 'bold' }}>
              {initial}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'name',
        header: 'User',
        cell: info => {
          const name = info.getValue();
          const email = info.row.original.email;
          return (
            <div>
              <div style={{ color: '#D4AF37', fontWeight: 600 }}>{name}</div>
              <div style={{ color: '#a8956b', fontSize: '0.8rem' }}>{email}</div>
            </div>
          );
        },
      },
      {
        accessorKey: 'country',
        header: 'Country',
        cell: info => {
          const country = info.getValue();
          // Extremely rudimentary emoji flag generation based on country name logic wouldn't fit here,
          // so we'll just style it as a badge.
          return (
            <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
               {country}
            </span>
          );
        }
      },
      {
        accessorKey: 'freeDays',
        header: 'Free Days',
        cell: info => {
          const days = info.getValue();
          const p = Math.min((days / 30) * 100, 100);
          return (
            <div style={{ width: '100px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px', color: '#a8956b' }}>
                <span>{days}d left</span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${p}%`, height: '100%', backgroundColor: days > 5 ? '#D4AF37' : '#DC143C' }}></div>
              </div>
            </div>
          );
        }
      },
      {
        accessorKey: 'tokens',
        header: 'Tokens',
        cell: info => <span style={{ color: '#D4AF37', textShadow: '0 0 8px rgba(212,175,55,0.4)', fontWeight: 'bold' }}>₮ {info.getValue().toLocaleString()}</span>
      },
      {
        accessorKey: 'createdAt',
        header: 'Joined',
        cell: info => {
          const dateStr = info.getValue();
          if (!dateStr) return 'N/A';
          const d = new Date(dateStr);
          return <span style={{ color: '#e0d5b8' }}>{d.toLocaleDateString()}</span>;
        }
      },
      {
        id: 'actions',
        header: '',
        cell: info => {
          const userId = info.row.original.id;
          return (
            <Dropdown>
              <Dropdown.Toggle as="div" style={{ cursor: 'pointer', color: '#a8956b' }}>
                <MoreVertical size={18} />
              </Dropdown.Toggle>
              <Dropdown.Menu style={{ background: '#1a1a1a', border: '1px solid rgba(212,175,55,0.2)' }}>
                <Dropdown.Item onClick={() => navigate(`/users/${userId}`)} style={{ color: '#e0d5b8', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <Eye size={16} /> View Detail
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          );
        },
      }
    ],
    [navigate]
  );

  const table = useReactTable({
    data: users,
    columns,
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // GSAP animation for table rows
  useEffect(() => {
    if (tableRef.current && !loading && users.length > 0) {
      const rows = tableRef.current.querySelectorAll('tbody tr');
      gsap.killTweensOf(rows); // avoid overlap
      gsap.fromTo(rows, 
        { x: -15, opacity: 0 }, 
        { x: 0, opacity: 1, stagger: 0.04, duration: 0.5, ease: "power2.out", delay: 0.1 }
      );
    }
  }, [loading, users.length]); // filter changes also trigger this via users change

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
        <h5 className="mb-0 text-primary">The Archive</h5>
        <div className="d-flex align-items-center gap-3">
          <button 
            className="btn btn-link p-0 text-primary" 
            onClick={onRefresh}
            title="Refresh Intelligence"
            style={{ transition: 'transform 0.3s ease' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'rotate(180deg)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'rotate(0deg)'}
          >
            <RotateCw size={18} />
          </button>
          <div className="d-flex align-items-center" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '20px', padding: '4px 12px' }}>
            <Search size={16} color="#a8956b" />
            <input
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              className="p-1 font-lg border-0 shadow-none"
              placeholder="Search users..."
              style={{ background: 'transparent', color: '#e0d5b8', outline: 'none', marginLeft: '8px', width: '200px' }}
            />
          </div>
        </div>
      </div>
      
      <div className="card-body p-0">
        {loading ? (
          <div className="p-4 text-center" style={{ color: '#a8956b' }}>Loading intelligence...</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0" ref={tableRef}>
              <thead style={{ background: 'rgba(212,175,55,0.05)' }}>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} onClick={header.column.getToggleSortingHandler()} style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default', color: '#D4AF37', borderBottom: 'none' }}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: ' 🔼',
                          desc: ' 🔽',
                        }[header.column.getIsSorted()] ?? null}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                   <tr><td colSpan={7} className="text-center p-4">No users found.</td></tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr 
                      key={row.id} 
                      className="cursor-pointer"
                      onClick={() => navigate(`/users/${row.original.id}`)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} style={{ verticalAlign: 'middle', borderBottom: 'none', color: '#e0d5b8' }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Pagination Controls */}
      <div className="card-footer d-flex align-items-center justify-content-between">
         <span style={{ color: '#a8956b', fontSize: '0.85rem' }}>
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
         </span>
         <div className="d-flex gap-2">
            <button className="btn btn-sm" style={{ border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', background: 'transparent' }} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Prev</button>
            <button className="btn btn-sm" style={{ border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', background: 'transparent' }} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</button>
         </div>
      </div>
    </div>
  );
});

export default UserTable;
