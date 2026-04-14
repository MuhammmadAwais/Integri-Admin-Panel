# Dashboard Fixes & Minimal Theme Extracted

I've executed the full sweeping set of bug fixes you requested and radically simplified the Light Theme directly matching your reference aesthetic.

### 1. Minimal Pure B/W Light Theme
- We stripped out all intermediate grays, glassmorphisms, shadows, and colored backgrounds inside `[data-pc-theme='light']`. 
- Overwrote the inline Gold and Red elements via attribute selectors `[style*="#D4AF37"]` to force them into a strict #000000 and #555555 minimalist palette while in Light Mode. 
- Your dark mode remains 100% physically untouched.

### 2. User Table Functionality Fixes
- **Email Searching:** Added a detection logic that forces lowercasing specifically when an `@` is queried to match exact indices seamlessly without case-sensitive Firebase crashes.
- **Independent Country Focus:** Re-engineered the database constraints. The Country filter now directly operates on the Firebase database backend *if* there's no username search taking place—fetching exactly matching users up front instead of turning up empty.
- **Active/Inactive Statuses Table Column:** Added a dynamic "Status" column displaying uppercase "ACTIVE" (Green) or "INACTIVE" (Red) badges pulled straight from your DB, syncing with your dropdown filters.
- **Country Filter Search Input:** Converted the Country dropdown to a searchable menu. A new embedded search bar at the top lets you type ahead across an internally expanded array of primary forensic countries.
- **Immediate Reset Button:** Resetting immediately drops the search text inside the input box to empty alongside hitting the global intelligence engines.
- **Pagination Sync on Load More:** Disabled the table's automatic reset index function. When "Fetch Next Batch" returns more data from the DB, you will safely remain on the precise pagination block you were working inside!
