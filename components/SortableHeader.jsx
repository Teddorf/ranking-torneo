import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export default function SortableHeader({
  label,
  columnKey,
  currentSort,
  onSort,
  align = "left",
  sticky = false,
  className = "",
}) {
  const isActive = currentSort.column === columnKey;
  const icon = isActive
    ? currentSort.direction === "asc"
      ? <ArrowUp className="w-3 h-3 text-amber-500" />
      : <ArrowDown className="w-3 h-3 text-amber-500" />
    : <ArrowUpDown className="w-3 h-3 opacity-30" />;

  const alignClass =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  return (
    <th
      onClick={() => onSort(columnKey)}
      className={`px-2 py-2 font-medium text-slate-600 cursor-pointer select-none hover:bg-slate-100 ${
        sticky ? "sticky left-0 bg-slate-50 z-10 min-w-[140px] px-3" : ""
      } ${className}`}
    >
      <div className={`flex items-center gap-1 ${alignClass}`}>
        <span>{label}</span>
        {icon}
      </div>
    </th>
  );
}
