import { Box, CircularProgress } from '@mui/material';

export default function LoadingBox() {
  return (
    <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
      <svg width={0} height={0}>
        <defs>
          <linearGradient id="loading_gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e01cd5" />
            <stop offset="100%" stopColor="#1CB5E0" />
          </linearGradient>
        </defs>
      </svg>
      <CircularProgress
        aria-label="데이터를 불러오는 중입니다"
        size={32}
        sx={{ 'svg circle': { stroke: 'url(#loading_gradient)' } }}
      />
    </Box>
  );
}
