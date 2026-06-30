import { Chip } from '@mui/material';

export default function StatusChip({ label }: { label: string }) {
  const color =
    label.includes('완료') || label === '정상' || label === '결제완료'
      ? 'primary'
      : label.includes('실패') || label.includes('환불') || label.includes('중지') || label.includes('폐쇄')
        ? 'error'
        : 'default';
  return <Chip label={label} color={color} size="small" variant={color === 'default' ? 'outlined' : 'filled'} />;
}
