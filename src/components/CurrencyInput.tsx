import React, { useCallback } from 'react';
import { Input } from '@/components/ui/input';

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Currency input using cents-based masking for pt-BR.
 * User types digits only; the component auto-formats as "1.234,56".
 * The onChange callback receives the raw numeric string with dot decimal (e.g. "1234.56").
 */
export function CurrencyInput({ value, onChange, placeholder = '0,00', className }: CurrencyInputProps) {
  // Convert stored value (e.g. "1234.56") to cents integer
  const numericValue = value ? Math.round(parseFloat(value) * 100) || 0 : 0;

  // Format cents to display string
  const formatCents = (cents: number): string => {
    if (cents === 0) return '';
    const reais = (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return reais;
  };

  const displayValue = formatCents(numericValue);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip everything except digits
    const digits = e.target.value.replace(/\D/g, '');
    
    if (digits === '' || digits === '0' || digits === '00') {
      onChange('');
      return;
    }

    const cents = parseInt(digits, 10);
    // Convert cents to dot-decimal string for storage
    const dotValue = (cents / 100).toFixed(2);
    onChange(dotValue);
  }, [onChange]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
}
