import { Box, CircularProgress } from '@mui/material';

export default function LoadingBox() {
  return (
    <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
      <CircularProgress />
    </Box>
  );
}
