'use client';

import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 576,
      md: 768,
      lg: 992,
      xl: 1200,
    },
  },
  palette: {
    primary: {
      main: '#EEB400',
      contrastText: '#181818',
    },
    secondary: {
      main: '#FFFFFF',
      contrastText: '#181818',
    },
    error: {
      main: '#FF555D',
      contrastText: '#181818',
    },
  },
  typography: {
    fontFamily: 'var(--pre)',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontFamily: 'var(--pre)',
          fontWeight: 700,
          fontVariationSettings: '"wght" 700',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 0 0 3px rgba(238, 180, 0, .5)',
          },
        },
        outlined: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 0 0 3px rgba(238, 180, 0, .5)',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--neo)',
          fontWeight: 500,
          fontVariationSettings: '"wght" 500',
          '&.Mui-selected': {
            fontWeight: 800,
            fontVariationSettings: '"wght" 800',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '& span': {
            fontFamily: 'var(--neo)',
            fontWeight: 500,
            fontVariationSettings: '"wght" 500',
          },
          '&.Mui-selected, &:hover': {
            '& span': {
              fontWeight: 700,
              fontVariationSettings: '"wght" 700',
            },
          },
          '&.Mui-selected': {
            backgroundColor: '#EEB400',
          },
          '&:hover': {
            backgroundColor: 'rgba(238, 180, 0, .18)',
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: 'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        elevation1: {
          borderRadius: 17,
          padding: 23,
          boxShadow: '0 2px 27px 0 rgba(24, 24, 24, .07)',
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        h1: {
          fontFamily: 'var(--neo)',
          fontWeight: 700,
          fontVariationSettings: '"wght" 700',
        },
        h2: {
          fontFamily: 'var(--neo)',
          fontWeight: 700,
          fontVariationSettings: '"wght" 700',
        },
        h3: {
          fontFamily: 'var(--neo)',
          fontWeight: 800,
          fontVariationSettings: '"wght" 800',
        },
        h4: {
          fontFamily: 'var(--neo)',
          fontWeight: 800,
          fontVariationSettings: '"wght" 800',
        },
        h5: {
          fontFamily: 'var(--neo)',
          fontWeight: 800,
          fontVariationSettings: '"wght" 800',
        },
        h6: {
          fontFamily: 'var(--neo)',
          fontWeight: 800,
          fontVariationSettings: '"wght" 800',
        },
        subtitle1: {
          fontFamily: 'var(--neo)',
          fontWeight: 400,
          fontVariationSettings: '"wght" 400',
        },
        subtitle2: {
          fontFamily: 'var(--neo)',
          fontWeight: 700,
          fontVariationSettings: '"wght" 700',
        },
        body1: {
          fontFamily: 'var(--pre)',
          fontWeight: 400,
          fontVariationSettings: '"wght" 400',
        },
        body2: {
          fontFamily: 'var(--pre)',
          fontWeight: 400,
          fontVariationSettings: '"wght" 400',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontFamily: 'var(--neo)',
          fontWeight: 700,
          fontVariationSettings: '"wght" 700',
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--neo)',
          fontWeight: 600,
          fontVariationSettings: '"wght" 600',
        },
      },
    },
  },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
