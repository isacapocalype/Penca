<native:column class="flex-1 gap-1 rounded-2xl bg-theme-surface border border-theme-outline p-4">
    <native:text class="text-xs text-theme-secondary">{{ $label }}</native:text>
    <native:text class="text-xl text-theme-on-surface" font="heading-bold">{{ $value }}</native:text>
    @if (! empty($hint))
        <native:text class="text-xs text-theme-muted">{{ $hint }}</native:text>
    @endif
</native:column>
