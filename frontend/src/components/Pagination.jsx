import { ChevronLeft, ChevronRight } from "lucide-react";

// Page numbers to show: always the first, last, current and its neighbours,
// with "…" for the gaps (e.g. 1 … 4 5 6 … 12).
function pageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [1, currentPage - 1, currentPage, currentPage + 1, totalPages]
    .filter((page) => page >= 1 && page <= totalPages);
  const unique = [...new Set(pages)].sort((a, b) => a - b);

  const items = [];
  unique.forEach((page, index) => {
    if (index > 0 && page - unique[index - 1] > 1) items.push(`gap-${page}`);
    items.push(page);
  });
  return items;
}

// Previous / page numbers / Next, in the shop's yellow and white style.
export default function Pagination({ currentPage, totalPages, onChange }) {
  const button =
    "flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav aria-label="Product pages" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${button} border-gray-300 bg-white text-gray-700 hover:border-yellow-400 hover:bg-yellow-50`}
      >
        <ChevronLeft size={16} />
        Previous
      </button>

      {pageItems(currentPage, totalPages).map((item) =>
        typeof item === "string" ? (
          <span key={item} className="px-1 text-gray-400" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-label={`Page ${item}`}
            aria-current={item === currentPage ? "page" : undefined}
            className={`${button} ${
              item === currentPage
                ? "border-yellow-400 bg-yellow-400 text-gray-900 shadow-sm"
                : "border-gray-300 bg-white text-gray-700 hover:border-yellow-400 hover:bg-yellow-50"
            }`}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${button} border-gray-300 bg-white text-gray-700 hover:border-yellow-400 hover:bg-yellow-50`}
      >
        Next
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
