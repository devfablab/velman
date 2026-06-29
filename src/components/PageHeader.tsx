import { Stack, Typography } from '@mui/material';

export default function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <Stack spacing={0.5} sx={{ mb: 3 }}>
      <Typography variant="h4" fontWeight={800}>{title}</Typography>
      {description ? <Typography variant="body1" color="text.secondary">{description}</Typography> : null}
    </Stack>
  );
}
