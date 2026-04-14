# Implementation Tasks

- `[x]` 1. Implement Hybrid Client-Side Filtering in `useUsers.js`
  - Remove server-side `where` constraints for country and status
  - Apply country and status filters client-side in the `filteredUsers` useMemo
- `[x]` 2. Prompts Page Bento Layout Redesign
  - Restructure `PromptsPage.jsx` grid to asymmetrical bento blocks
  - Add pointer cursor states for interactivity
- `[x]` 3. Unified Map and Dash Analytics real-time updates
  - Inject `sections/dashboard/UsersMap` into `UsersPage.jsx`
  - Beef up `useBusinessIntelligence.js` simulation for interval-based "live" numbers
- `[x]` 4. Light Theme Override
  - Inject strong overrides into `global.scss` targeting `[data-pc-theme="light"]`
  - Use Zinc & Silver colors, stark white backgrounds, and refined shadows
