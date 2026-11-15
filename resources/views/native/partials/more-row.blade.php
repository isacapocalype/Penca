<native:pressable class="w-full rounded-2xl bg-theme-surface border border-theme-outline p-4" @navigate="$path">
    <native:row class="w-full items-center gap-3">
        <native:column class="h-10 w-10 items-center justify-center rounded-full bg-theme-primary-soft">
            <native:icon :ios="$ios" :android="$android" :size="20" class="text-theme-primary-text" />
        </native:column>
        <native:column class="flex-1 gap-1">
            <native:text class="text-base text-theme-on-surface" font="body-semibold">{{ $label }}</native:text>
            <native:text class="text-xs text-theme-secondary">{{ $detail }}</native:text>
        </native:column>
        <native:icon :ios="\App\Icons\Ios::ChevronRight" :android="\App\Icons\Android::ChevronRight" :size="16" class="text-theme-muted" />
    </native:row>
</native:pressable>
