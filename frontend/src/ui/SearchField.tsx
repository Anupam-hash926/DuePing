import React, { forwardRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../lib/cn'

export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, onClear, placeholder = 'Search...', className, ...props },
  ref
) {
  const hasValue = Boolean(value)

  return (
    <div className={cn('relative flex items-center w-full max-w-sm', className)}>
      <Search
        className="absolute left-3 w-4 h-4 text-text-3 pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        aria-label={props['aria-label'] ?? (typeof placeholder === 'string' ? placeholder : 'Search')}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-8 bg-bg-grouped text-text placeholder-text-3 text-sm rounded-pill border border-hairline focus:border-tint focus:bg-surface-solid focus-visible:outline-none transition-colors"
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2.5 p-0.5 text-text-3 hover:text-text rounded-full focus-visible:outline-none"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
})
