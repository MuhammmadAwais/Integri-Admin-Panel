import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Default to true (Imperial Obsidian)
  isDark: localStorage.getItem('theme') !== 'light'
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.isDark = !state.isDark;
      localStorage.setItem('theme', state.isDark ? 'dark' : 'light');
    },
    setTheme: (state, action) => {
      state.isDark = action.payload;
      localStorage.setItem('theme', state.isDark ? 'dark' : 'light');
    }
  }
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;
