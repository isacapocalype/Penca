@if (! empty($notice))
    <native:column class="w-full rounded-2xl bg-theme-success-soft border border-theme-success/30 p-3">
        <native:text class="text-sm text-theme-success" font="body-medium">{{ $notice }}</native:text>
    </native:column>
@endif

@if (! empty($error))
    <native:column class="w-full rounded-2xl bg-theme-danger-soft border border-theme-destructive/30 p-3">
        <native:text class="text-sm text-theme-destructive" font="body-medium">{{ $error }}</native:text>
    </native:column>
@endif
