import { Paper, Typography } from '@mui/material';

export default function EmptyState({ message }: { message: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
      <Typography color="text.secondary">{message}</Typography>
    </Paper>
  );
}
