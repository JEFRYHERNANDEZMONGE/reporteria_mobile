"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

type CollapsibleListSearchProps = {
  isOpen: boolean;
  query: string;
  onToggle: () => void;
  onQueryChange: (value: string) => void;
  placeholder: string;
};

export default function CollapsibleListSearch({
  isOpen,
  query,
  onToggle,
  onQueryChange,
  placeholder,
}: CollapsibleListSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    inputRef.current?.focus();
  }, [isOpen]);

  return (
    <div className="flex w-full flex-col gap-2 rounded-[12px] border border-[#B3B5B3] bg-white p-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-10 w-full items-center justify-between rounded-[10px] px-2 text-left text-[14px] leading-none font-normal text-[#0D3233]"
      >
        <span>{query ? "Buscar activo" : "Buscar"}</span>
        {isOpen ? <ChevronUp size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
      </button>

      {isOpen ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-[#B3B5B3] bg-[#E9EDE9] px-3">
          <Search size={16} strokeWidth={2.5} className="shrink-0 text-[#5A7984]" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className="h-10 w-full border-0 bg-transparent text-[14px] leading-none font-normal text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
            inputMode="search"
            enterKeyHint="search"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Limpiar busqueda"
              className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#5A7984]"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
