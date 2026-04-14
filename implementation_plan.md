# Integri Admin Dashboard Fixes & Overhaul

## Goal Description
Resolve critical issues and elevate the UI/UX based on the latest feedback. This includes fixing the Users table filtering bug, modernizing the Prompts page with a Bento-style layout, reusing the dashboard's world map on the Users page, connecting Google Analytics/Firebase realtime data hooks, and completely revamping the light theme to a premium Zinc & Silver aesthetic.

## User Review Required
> [!IMPORTANT]
> The hybrid client-side filtering changes how data fetching interacts with Firebase. To avoid Firebase Indexing errors (which caused the country filter bug), we will offload `country` and `status` filtering to the client side. This ensures no `FAILED_PRECONDITION` errors and instant local search, but relies on batch-fetched data. Let me know if you would prefer strict DB queries and creating new Firebase indexes instead.

> [!TIP]
> The Prompts page layout will transition from standard Bootstrap columns to an asymmetrical Bento Grid to give it a modern, dashboard-like feel.

## Proposed Changes

### 1. Users Table Hybrid Filtering

#### [MODIFY] [useUsers.js](file:///c:/Users/Prime/OneDrive/Documents/Office/Office%20Projects/datta-able-free-react-admin-template/src/features/users/hooks/useUsers.js)
- Remove `where('country')` and `where('status')` from the Firebase `getDocs` constraints to prevent unindexed search crashes.
- Update the `useMemo` for `filteredUsers` to handle `countryFilter` and `statusFilter` purely client-side on the fetched dataset.
- This will instantly allow filtering on fetched subsets without throwing indexing errors, making it work independently of `globalFilter`.

### 2. Prompts Page Bento Grid Modernization

#### [MODIFY] [PromptsPage.jsx](file:///c:/Users/Prime/OneDrive/Documents/Office/Office%20Projects/datta-able-free-react-admin-template/src/features/prompts/PromptsPage.jsx)
- Transition mapping logic to an elegant Bento grid: First card spans 8 columns, second spans 4, third spans 12 (or similar asymmetrical arrangement).
- Ensure buttons have `cursor: pointer` via inline or utility classes.
- Enhance hover states and interactions.

### 3. Unified Map and Real-time Analytics integration

#### [MODIFY] [UsersPage.jsx](file:///c:/Users/Prime/OneDrive/Documents/Office/Office%20Projects/datta-able-free-react-admin-template/src/features/users/UsersPage.jsx)
- Swap the basic `react-simple-maps` implementation for the high-end `jsvectormap` used in the Dashboard (`sections/dashboard/UsersMap`).
- Pass equivalent data into the `UsersMap`.

#### [MODIFY] [useBusinessIntelligence.js](file:///c:/Users/Prime/OneDrive/Documents/Office/Office%20Projects/datta-able-free-react-admin-template/src/hooks/useBusinessIntelligence.js)
- Build out real-time interval logic. Update simulated analytics tracking for revenue and conversion rates on an interval hook to reflect a "live" analytics stream.
- Expose more comprehensive data items (like geography trends if needed) that the dashboard charting can consume.

### 4. Light Theme Overhaul (Zinc & Silver Luxe)

#### [MODIFY] [global.scss](file:///c:/Users/Prime/OneDrive/Documents/Office/Office%20Projects/datta-able-free-react-admin-template/src/global.scss)
- Inject root `[data-pc-theme='light']` selectors to aggressively restyle the light theme palette.
- Replace dull grays with stark whites, soft silver borders, and refined shadows mimicking the Integri AI aesthetic.
- Ensure text contrast is sharp (Zinc text) while preserving untouched dark theme layers.

## Open Questions
- For the Prompts page Bento structure, do you prefer 2 smaller cards on top and 1 large one on the bottom, or 1 large, 1 small on row 1, and 1 large on row 2?
- For the Light theme, would you like glassmorphism elements (translucent backgrounds with blur) applied to the light mode cards as well?

## Verification Plan

### Automated Tests
- N/A (Client side UI)

### Manual Verification
- Test user table: Selecting a country filter from an empty global search should instantly process the table rows.
- Verify Prompts page bento arrangement is clean and buttons show pointer styles.
- Change to Light Theme from layout nav and verify the "Junk gray sides" are replaced by crisp Luxe Silver/White styling.
- Check dashboard metrics for real-time live pulse interval behavior.
