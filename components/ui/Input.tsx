import { cn } from '@/lib/utils';
import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, required, id, ...props }, ref) => {
    return (
      <div className="form-group">
        {label && (
          <label htmlFor={id} className={cn('form-label', required && 'required')}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn('form-control', error && 'border-red-400', className)}
          {...props}
        />
        {error && <span className="form-error">{error}</span>}
        {hint && !error && <span className="form-hint">{hint}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea com a mesma interface
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, required, id, ...props }, ref) => {
    return (
      <div className="form-group">
        {label && (
          <label htmlFor={id} className={cn('form-label', required && 'required')}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn('form-control', error && 'border-red-400', className)}
          {...props}
        />
        {error && <span className="form-error">{error}</span>}
        {hint && !error && <span className="form-hint">{hint}</span>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
