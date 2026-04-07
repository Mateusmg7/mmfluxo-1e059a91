import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Masked currency input for pt-BR (R$).
 * Internally stores the raw numeric string (e.g. "1234.56")
 * but displays formatted: "1.234,56".
 */
export function CurrencyInput({ value, onChange, placeholder = '0,00', className }: CurrencyInputProps) {
  const [display, setDisplay] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display when value changes externally
  useEffect(() => {
    if (value === '' || value === undefined || value === null) {
      setDisplay('');
      return;
    }
    const num = parseFloat(value);
    if (isNaN(num)) {
      setDisplay('');
      return;
    }
    // Format to pt-BR without currency symbol
    const formatted = num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setDisplay(formatted);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Allow only digits, dots, and commas
    raw = raw.replace(/[^\d.,]/g, '');

    // Replace comma with dot for internal parsing
    // Remove thousand separators (dots) and treat comma as decimal
    const cleaned = raw.replace(/\./g, '').replace(',', '.');

    if (raw === '' || raw === ',' || raw === '.') {
      setDisplay(raw);
      onChange('');
      return;
    }

    const num = parseFloat(cleaned);
    if (isNaN(num)) {
      setDisplay(raw);
      return;
    }

    // Store raw numeric value (dot as decimal)
    onChange(cleaned);
    setDisplay(raw);
  };

  const handleBlur = () => {
    if (value === '' || value === undefined) {
      setDisplay('');
      return;
    }
    const num = parseFloat(value);
    if (isNaN(num)) {
      setDisplay('');
      return;
    }
    const formatted = num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setDisplay(formatted);
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
}
