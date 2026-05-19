import { createTheme } from '@mui/material/styles';

export const adminTheme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#2e7d32',
    },
    warning: {
      main: '#ed6c02',
    },
    info: {
      main: '#0288d1',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#f0f7ff',
          },
        },
      },
    },
  },
});

export const tableCellStyle = {
  fontWeight: 'bold',
  backgroundColor: '#f5f5f5',
  borderBottom: '2px solid #e0e0e0'
};

export const avatarColors = {
  admin: '#f44336',
  employee: '#1976d2',
  pending: '#ff9800',
  completed: '#4caf50'
};