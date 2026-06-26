import { cn } from '@/lib/utils';
import { forwardRef, SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, required, id, options, placeholder, ...props }, ref) => {
    return (
      <div className="form-group">
        {label && (
          <label htmlFor={id} className={cn('form-label', required && 'required')}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn('form-control', error && 'border-red-400', className)}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="form-error">{error}</span>}
        {hint && !error && <span className="form-hint">{hint}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
